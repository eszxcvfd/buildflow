import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_WORK_TYPE_REPOSITORY, WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { WorkTypeEntity, WorkTypeStatus } from '../../domain/entity/work-type.entity';
import { normalizeWorkTypeReason } from '../../domain/service/work-type.policy';

export type WorkTypeLifecycleAction = 'ACTIVATE' | 'DEACTIVATE';

export const WORK_TYPE_IN_USE_WARNING =
  'Loại công việc đang được tham chiếu bởi Work Order đang hiệu lực';

export interface ChangeWorkTypeStatusInput {
  workTypeId: string;
  action: WorkTypeLifecycleAction;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface ChangeWorkTypeStatusOutput {
  entity: WorkTypeEntity;
  alreadyInState: boolean;
  warning?: string;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * PRJ-SRS-004 + PRJ-SRS-007 (issue #35) — vòng đời loại công việc.
 * - `ACTIVATE`→`ACTIVE`, `DEACTIVATE`→`INACTIVE` (KHÔNG hard delete).
 * - Idempotent repeat → 200 `{alreadyInState: true}`, không mutation, không audit.
 * - Deactivate vẫn cho phép khi WO đang tham chiếu (picker sẽ ẩn inactive)
 *   nhưng kèm `warning` phạm vi áp dụng + `_warning` trong audit afterData.
 * - Count thất bại → lỗi lan ra (500), không transition thiếu cảnh báo.
 * - Audit `PRJ_WORK_TYPE_STATUS_CHANGED` (before/after, `reason` ở cột audit).
 */
@Injectable()
export class ChangeWorkTypeStatusUseCase {
  constructor(
    @Inject(PRJ_WORK_TYPE_REPOSITORY) private readonly workTypeRepo: WorkTypeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: ChangeWorkTypeStatusInput): Promise<ChangeWorkTypeStatusOutput> {
    if (!['ACTIVATE', 'DEACTIVATE'].includes(input.action)) {
      throw fieldError('action', 'Hành động không hợp lệ (ACTIVATE/DEACTIVATE)');
    }
    let reason: string | null;
    try {
      reason = normalizeWorkTypeReason(input.reason);
    } catch (e) {
      throw fieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }

    const entity = await this.workTypeRepo.findById(input.workTypeId);
    if (!entity) throw new NotFoundException('Không tìm thấy loại công việc');

    const target: WorkTypeStatus = input.action === 'ACTIVATE' ? 'ACTIVE' : 'INACTIVE';
    if (entity.status === target) {
      return { entity, alreadyInState: true };
    }

    const before = entity.toPublic();

    let usageWarning = false;
    if (input.action === 'DEACTIVATE') {
      const usage = await this.workTypeRepo.countActiveWorkOrders(input.workTypeId);
      usageWarning = usage > 0;
    }

    try {
      entity.changeStatus(target, new Date());
    } catch (e) {
      throw fieldError('action', e instanceof Error ? e.message : 'Trạng thái không hợp lệ');
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      if (this.workTypeRepo.saveWithClient) await this.workTypeRepo.saveWithClient(client, entity);
      else await this.workTypeRepo.save(entity);

      try {
        const afterData = entity.toPublic() as Record<string, unknown>;
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_WORK_TYPE_STATUS_CHANGED',
          entityType: 'WORK_TYPE',
          entityId: input.workTypeId,
          beforeData: before,
          afterData,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
          reason: reason ?? null,
        };
        if (usageWarning) afterData['_warning'] = WORK_TYPE_IN_USE_WARNING;
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity, alreadyInState: false, warning: usageWarning ? WORK_TYPE_IN_USE_WARNING : undefined };
  }
}
