import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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
import {
  assertUploadableFile,
  sanitizeFileName,
  normalizeAttachmentCaption,
  normalizeAttachmentRequestKey,
} from '../../domain/service/attachment.policy';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface UploadAttachmentInput {
  /** Project scope trực tiếp. */
  projectId?: string;
  /** WO extension: resolve project chứa WO rồi dùng cùng scope service. */
  workOrderId?: string;
  file: UploadFileInput;
  caption?: string | null;
  requestKey?: string | null;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UploadAttachmentOutput {
  entity: AttachmentEntity;
  /**
   * True khi `requestKey` đã tồn tại (kể cả race 23505 đồng thời): trả về
   * attachment HIỆN CÓ, KHÔNG ghi file mới, KHÔNG audit mới (mirror WO #41).
   */
  idempotentReplay: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * PRJ-SRS-009 (issue #40) — upload attachment (project scope; WO extension
 * cùng service).
 * - U1 scope-first (lesson P1-1 #37): `assertProjectWriteScope` TRƯỚC replay
 *   check và mọi existence check khác — non-member luôn 403 kể cả project/WO
 *   không tồn tại (không leak); ADMIN giữ 404 qua resolve/scope exists-check.
 * - U2 replay trước khi ghi file: `requestKey` trùng → 200 row hiện có,
 *   không file mới, không audit mới. Race đồng thời (23505
 *   `ux_attachments_request_key`) → orphan-cleanup file vừa ghi rồi replay.
 * - U3 validate server-side: size ≤10MB + mime allowlist + magic sniff (không
 *   tin header) + sanitize tên file (path traversal) — TẤT CẢ trước khi ghi.
 * - U4 file operation NGOÀI tx: ghi file trước, DB tx (insert + audit
 *   `PRJ_ATTACHMENT_UPLOADED`) sau; DB/audit fail → 500 + xóa file vừa ghi.
 * - U5 `attachmentType` server-fixed `DOCUMENT`; owner PROJECT → owner_id =
 *   project_id; owner WORK_ORDER → owner_id = work_order_id.
 */
@Injectable()
export class UploadAttachmentUseCase {
  constructor(
    @Inject(PRJ_ATTACHMENT_REPOSITORY) private readonly attachments: AttachmentRepositoryPort,
    @Inject(PRJ_ATTACHMENT_STORAGE) private readonly storage: AttachmentStoragePort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: UploadAttachmentInput): Promise<UploadAttachmentOutput> {
    if (!input.file || !input.file.buffer) {
      throw fieldError('file', 'Vui lòng chọn tệp đính kèm');
    }
    let caption: string | null;
    try {
      caption = normalizeAttachmentCaption(input.caption);
    } catch (e) {
      throw fieldError('caption', e instanceof Error ? e.message : 'Mô tả tệp không hợp lệ');
    }
    let requestKey: string | null;
    try {
      requestKey = normalizeAttachmentRequestKey(input.requestKey);
    } catch (e) {
      throw fieldError('requestKey', e instanceof Error ? e.message : 'Request key không hợp lệ');
    }
    const actorRoles = input.actorRoles ?? [];

    // U1 — resolve scope target (WO → project), rồi scope-first.
    let projectId: string;
    let workOrderId: string | null = null;
    if (input.workOrderId) {
      const wo = await this.attachments.findWorkOrderProjectById(input.workOrderId);
      if (!wo) {
        if (isAdminRole(actorRoles)) throw new NotFoundException('Không tìm thấy công việc');
        throw new ForbiddenException('Không có quyền truy cập dự án này');
      }
      projectId = wo.projectId;
      workOrderId = wo.id;
    } else if (input.projectId) {
      projectId = input.projectId;
    } else {
      throw fieldError('projectId', 'Thiếu phạm vi dự án của tệp đính kèm');
    }

    await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles,
      projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    // U2 — replay trước khi chạm disk.
    if (requestKey !== null) {
      const existing = await this.attachments.findByRequestKey(requestKey);
      if (existing) return { entity: existing, idempotentReplay: true };
    }

    // U3 — validate toàn bộ trước khi ghi (size/mime/magic/tên).
    let mimeType: string;
    try {
      mimeType = assertUploadableFile(input.file.buffer, input.file.mimeType);
    } catch (e) {
      throw fieldError('file', e instanceof Error ? e.message : 'Tệp đính kèm không hợp lệ');
    }
    const fileName = sanitizeFileName(input.file.originalName);
    const ownerType = workOrderId ? 'WORK_ORDER' : 'PROJECT';
    const ownerId = workOrderId ?? projectId;

    // U4 — ghi file trước (ngoài tx).
    let storageKey: string;
    try {
      storageKey = await this.storage.save(projectId, fileName, input.file.buffer);
    } catch {
      throw new InternalServerErrorException('Không thể lưu tệp đính kèm, vui lòng thử lại');
    }

    const now = new Date();
    const id = randomUUID();
    let entity: AttachmentEntity;
    try {
      entity = new AttachmentEntity({
        id,
        projectId,
        workOrderId,
        ownerType,
        ownerId,
        attachmentType: 'DOCUMENT',
        uploadedBy: input.actorUserId,
        fileName,
        storageKey,
        mimeType,
        sizeBytes: input.file.buffer.length,
        caption,
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivateReason: null,
        requestKey,
        createdAt: now,
      });
    } catch (e) {
      await this.storage.remove(storageKey);
      throw fieldError('file', e instanceof Error ? e.message : 'Dữ liệu tệp không hợp lệ');
    }

    try {
      await this.tx.withTransaction(async (client: PoolClient) => {
        if (this.attachments.createWithClient) {
          await this.attachments.createWithClient(client, entity);
        } else {
          await this.attachments.create(entity);
        }
        try {
          const payload = {
            actorUserId: input.actorUserId,
            action: 'PRJ_ATTACHMENT_UPLOADED',
            entityType: 'ATTACHMENT',
            entityId: id,
            beforeData: null,
            afterData: entity.toPublic(),
            result: 'SUCCESS' as const,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            correlationId: input.correlationId ?? null,
          };
          if (!this.audit.logWithClient) {
            throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
          }
          await this.audit.logWithClient(client, payload);
        } catch {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
      });
    } catch (e) {
      // Mọi lỗi trong tx đều orphan-cleanup file vừa ghi (U4). Race trùng
      // request_key đồng thời → replay row thắng (U2); audit fail → 500.
      await this.storage.remove(storageKey);
      if (requestKey !== null && isRequestKeyConflict(e)) {
        const winner = await this.attachments.findByRequestKey(requestKey);
        if (winner) return { entity: winner, idempotentReplay: true };
      }
      if (e instanceof InternalServerErrorException) throw e;
      throw new InternalServerErrorException('Không thể lưu tệp đính kèm, vui lòng thử lại');
    }
    return { entity, idempotentReplay: false };
  }
}

function isRequestKeyConflict(e: unknown): boolean {
  const err = e as Record<string, unknown>;
  return String(err['code'] ?? '') === '23505' && /request_key/i.test(String(err['constraint'] ?? ''));
}
