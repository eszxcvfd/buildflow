import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';
import { WoTemplateStatus, normalizeWoTemplateReason } from '../../domain/service/work-order-template.policy';

export type WorkOrderTemplateLifecycleAction = 'ACTIVATE' | 'DEACTIVATE';

export interface ChangeWorkOrderTemplateStatusInput {
  templateId: string;
  action: WorkOrderTemplateLifecycleAction;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface ChangeWorkOrderTemplateStatusOutput {
  entity: WorkOrderTemplateEntity;
  alreadyInState: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * PRJ-SRS-008 (issue #39) — vòng đời mẫu công việc.
 * - `ACTIVATE`: DRAFT→ACTIVE (publish) hoặc INACTIVE→ACTIVE (tái phát hành).
 * - `DEACTIVATE`: ACTIVE→INACTIVE. DEACTIVATE từ DRAFT → 400 (mẫu nháp chưa
 *   publish thì giữ DRAFT, không có trạng thái ngừng cho nháp).
 * - Publish guard (issue exception "thiếu skill/checklist reference"): ACTIVATE
 *   yêu cầu mẫu có ít nhất một kỹ năng HOẶC một checklist item — ngược lại 400
 *   fieldErrors `{action}` nêu nguyên nhân và cách xử lý.
 * - Idempotent repeat → 200 `{alreadyInState: true}`, không mutation, không audit.
 * - Audit `PRJ_WO_TEMPLATE_STATUS_CHANGED` (before/after, `reason` ở cột audit).
 */
@Injectable()
export class ChangeWorkOrderTemplateStatusUseCase {
  constructor(
    @Inject(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY) private readonly repo: WorkOrderTemplateRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: ChangeWorkOrderTemplateStatusInput): Promise<ChangeWorkOrderTemplateStatusOutput> {
    if (!['ACTIVATE', 'DEACTIVATE'].includes(input.action)) {
      throw fieldError('action', 'Hành động không hợp lệ (ACTIVATE/DEACTIVATE)');
    }
    let reason: string | null;
    try {
      reason = normalizeWoTemplateReason(input.reason);
    } catch (e) {
      throw fieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }

    const entity = await this.repo.findById(input.templateId);
    if (!entity) throw new NotFoundException('Không tìm thấy mẫu công việc');

    const target: WoTemplateStatus = input.action === 'ACTIVATE' ? 'ACTIVE' : 'INACTIVE';
    if (entity.status === target) {
      return { entity, alreadyInState: true };
    }

    if (input.action === 'DEACTIVATE' && entity.status === 'DRAFT') {
      throw fieldError('action', 'Mẫu nháp chưa phát hành không thể ngừng; giữ nguyên DRAFT');
    }

    if (input.action === 'ACTIVATE') {
      const pub = entity.toPublic();
      if (pub.requiredSkills.length === 0 && pub.checklistSnapshot.length === 0) {
        throw fieldError(
          'action',
          'Không thể phát hành mẫu thiếu kỹ năng và checklist; bổ sung requiredSkills hoặc checklistSnapshot trước khi publish',
        );
      }
    }

    const before = entity.toPublic();
    try {
      entity.changeStatus(target, new Date());
    } catch (e) {
      throw fieldError('action', e instanceof Error ? e.message : 'Trạng thái không hợp lệ');
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      if (this.repo.saveWithClient) await this.repo.saveWithClient(client, entity);
      else await this.repo.save(entity);

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_WO_TEMPLATE_STATUS_CHANGED',
          entityType: 'WORK_ORDER_TEMPLATE',
          entityId: input.templateId,
          beforeData: before,
          afterData: entity.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
          reason: reason ?? null,
        };
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity, alreadyInState: false };
  }
}
