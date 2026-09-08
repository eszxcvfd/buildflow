import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  PRJ_ATTACHMENT_REPOSITORY,
  AttachmentRepositoryPort,
} from '../../domain/repository/attachment-repository.port';
import {
  PRJ_ATTACHMENT_STORAGE,
  AttachmentStoragePort,
} from '../../domain/service/attachment-storage.port';
import { AttachmentEntity } from '../../domain/entity/attachment.entity';
import { normalizeRetireReason } from '../../domain/service/attachment.policy';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';

export interface AttachmentScopeInput {
  projectId?: string;
  workOrderId?: string;
  actorUserId: string;
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface ListAttachmentsOutput {
  data: AttachmentEntity[];
}

export interface DownloadAttachmentOutput {
  entity: AttachmentEntity;
  data: Buffer;
}

export interface RetireAttachmentOutput {
  entity: AttachmentEntity;
  /** True khi đã retire trước đó: không mutation, không audit mới. */
  alreadyInactive: boolean;
}

function retireFieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * Resolve project chứa target (project trực tiếp hoặc WO extension), role-aware:
 * non-ADMIN + WO missing → 403 (không leak); ADMIN + missing → 404.
 */
async function resolveScopeProject(
  attachments: AttachmentRepositoryPort,
  input: AttachmentScopeInput,
): Promise<{ projectId: string; workOrderId: string | null }> {
  const actorRoles = input.actorRoles ?? [];
  if (input.workOrderId) {
    const wo = await attachments.findWorkOrderProjectById(input.workOrderId);
    if (!wo) {
      if (isAdminRole(actorRoles)) throw new NotFoundException('Không tìm thấy công việc');
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    }
    return { projectId: wo.projectId, workOrderId: wo.id };
  }
  if (input.projectId) return { projectId: input.projectId, workOrderId: null };
  throw retireFieldError('projectId', 'Thiếu phạm vi dự án của tệp đính kèm');
}

/**
 * PRJ-SRS-009 (issue #40) — list/download metadata + content (member scope).
 * - List: metadata cả active + inactive (history giữ), `no-store` ở controller.
 * - Download: verify attachment thuộc đúng scope (project/WO) — member project
 *   A không đọc được file project B (404, không leak bytes).
 * - Read-only: không tx, không audit nghiệp vụ (mirror GetWorkOrderUseCase).
 */
@Injectable()
export class ListAttachmentsUseCase {
  constructor(
    @Inject(PRJ_ATTACHMENT_REPOSITORY) private readonly attachments: AttachmentRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: AttachmentScopeInput): Promise<ListAttachmentsOutput> {
    const { projectId, workOrderId } = await resolveScopeProject(this.attachments, input);
    await this.scope.assertProjectMemberScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const data = workOrderId
      ? await this.attachments.listByWorkOrderId(workOrderId)
      : await this.attachments.listByProjectId(projectId);
    return { data };
  }
}

/**
 * PRJ-SRS-009 (issue #40) — download content (member scope). Inactive vẫn tải
 * được (history giữ — file vật lý không bị xóa khi retire).
 */
@Injectable()
export class DownloadAttachmentUseCase {
  constructor(
    @Inject(PRJ_ATTACHMENT_REPOSITORY) private readonly attachments: AttachmentRepositoryPort,
    @Inject(PRJ_ATTACHMENT_STORAGE) private readonly storage: AttachmentStoragePort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(
    input: AttachmentScopeInput & { attachmentId: string },
  ): Promise<DownloadAttachmentOutput> {
    const { projectId, workOrderId } = await resolveScopeProject(this.attachments, input);
    await this.scope.assertProjectMemberScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const entity = await this.attachments.findById(input.attachmentId);
    if (!entity) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    // Scope-bind: file phải thuộc đúng project/WO trên path.
    if (workOrderId ? entity.workOrderId !== workOrderId : entity.projectId !== projectId) {
      throw new NotFoundException('Không tìm thấy tệp đính kèm');
    }
    try {
      const data = await this.storage.read(entity.storageKey);
      return { entity, data };
    } catch {
      throw new InternalServerErrorException('Không thể đọc tệp đính kèm, vui lòng thử lại');
    }
  }
}

/**
 * PRJ-SRS-009 (issue #40) — retire (soft, write scope).
 * - `is_active=false` + deactivated_by/at/reason trong tx + audit
 *   `PRJ_RETIRE...` → `PRJ_ATTACHMENT_RETIRED`; audit fail → 500 rollback.
 * - Idempotent: đã inactive → `alreadyInactive: true`, không mutation mới,
 *   không audit mới (mirror `alreadyInState` semantics).
 * - KHÔNG xóa file vật lý — history/download giữ nguyên.
 */
@Injectable()
export class RetireAttachmentUseCase {
  constructor(
    @Inject(PRJ_ATTACHMENT_REPOSITORY) private readonly attachments: AttachmentRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(
    input: AttachmentScopeInput & { attachmentId: string; reason?: string | null },
  ): Promise<RetireAttachmentOutput> {
    let reason: string | null;
    try {
      reason = normalizeRetireReason(input.reason);
    } catch (e) {
      throw retireFieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }
    const { projectId, workOrderId } = await resolveScopeProject(this.attachments, input);
    await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const current = await this.attachments.findById(input.attachmentId);
    if (!current) throw new NotFoundException('Không tìm thấy tệp đính kèm');
    if (workOrderId ? current.workOrderId !== workOrderId : current.projectId !== projectId) {
      throw new NotFoundException('Không tìm thấy tệp đính kèm');
    }
    if (!this.attachments.retireWithClient) {
      throw new InternalServerErrorException('Không thể ngừng sử dụng tệp, vui lòng thử lại');
    }
    const retire = this.attachments.retireWithClient.bind(this.attachments);
    const actorUserId = input.actorUserId;
    const audit = this.audit;
    let result: RetireAttachmentOutput;
    await this.tx.withTransaction(async (client: PoolClient) => {
      const now = new Date();
      const retired = await retire(client, current.id, {
        deactivatedBy: actorUserId,
        deactivatedAt: now,
        reason,
      });
      if (!retired.alreadyInactive) {
        try {
          const payload = {
            actorUserId,
            action: 'PRJ_ATTACHMENT_RETIRED',
            entityType: 'ATTACHMENT',
            entityId: current.id,
            beforeData: current.toPublic(),
            afterData: retired.entity.toPublic(),
            result: 'SUCCESS' as const,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            correlationId: input.correlationId ?? null,
          };
          if (!audit.logWithClient) {
            throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
          }
          await audit.logWithClient(client, payload);
        } catch {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
      }
      result = { entity: retired.entity, alreadyInactive: retired.alreadyInactive };
    });
    return result!;
  }
}
