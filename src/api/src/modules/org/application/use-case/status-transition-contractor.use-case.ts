import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';
import {
  isResourceLifecycleAction,
  targetStatusForAction,
  isDeactivatingAction,
  normalizeLifecycleReason,
  REASON_REQUIRED_MESSAGE,
  openWorkWarningText,
  ResourceLifecycleAction,
} from '../../domain/service/resource-status.policy';

/**
 * ORG-SRS-004 (issue #27) — lifecycle nhà thầu (entity contractor.changeStatus).
 *
 * Mapping: ACTIVATE -> ACTIVE; SUSPEND/TERMINATE -> INACTIVE (enum DB không đổi).
 * - reason bắt buộc (1-500) cho SUSPEND/TERMINATE; optional cho ACTIVATE.
 * - Idempotent repeat → 200 alreadyInState, KHÔNG ghi audit, KHÔNG gọi changeStatus
 *   (lifecycle check trước; contractor.changeStatus hiện vốn same-status no-op theo
 *   pattern #25, nhưng idempotent phải chặn trước để không ghi audit trùng).
 * - Open work khi rời ACTIVE: assignments mở của crews thuộc contractor
 *   (crews.contractor_id) + của users thuộc contractor (users.contractor_id).
 *   Cảnh báo, KHÔNG chặn. Audit afterData gắn `_warning`.
 * - Audit tx-embedded 1 lần, action riêng, reason ở cột audit_logs.reason,
 *   KHÔNG đưa reason vào beforeData/afterData.
 */

export interface StatusTransitionContractorInput {
  contractorId: string;
  action: ResourceLifecycleAction;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface StatusTransitionContractorOutput {
  entity: ContractorEntity;
  alreadyInState: boolean;
  warning?: { openAssignments: number };
}

@Injectable()
export class StatusTransitionContractorUseCase {
  constructor(
    @Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: StatusTransitionContractorInput): Promise<StatusTransitionContractorOutput> {
    if (!isResourceLifecycleAction(input.action)) {
      throw new BadRequestException(`Action không hợp lệ: ${String(input.action)}`);
    }

    let reason: string | null = null;
    try {
      reason = normalizeLifecycleReason(input.reason);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lý do không hợp lệ';
      throw new BadRequestException(msg);
    }
    if (isDeactivatingAction(input.action) && reason === null) {
      throw new BadRequestException(REASON_REQUIRED_MESSAGE);
    }

    const contractor = await this.contractorRepo.findById(input.contractorId);
    if (!contractor) {
      throw new NotFoundException('Không tìm thấy hồ sơ nhà thầu');
    }

    const targetStatus = targetStatusForAction(input.action);
    if (contractor.status === targetStatus) {
      // Idempotent repeat (issue #27): trả 200 alreadyInState, KHÔNG audit.
      return { entity: contractor, alreadyInState: true };
    }

    let openAssignments = 0;
    if (isDeactivatingAction(input.action) && contractor.status === 'ACTIVE') {
      if (this.contractorRepo.countOpenAssignments) {
        // Đếm thất bại = không biết có open work → để lỗi lan ra thay vì transition
        // thiếu cảnh báo (cùng nguyên tắc countActiveUsage của trade).
        openAssignments = await this.contractorRepo.countOpenAssignments(input.contractorId);
      }
    }

    const before = contractor.toPublic();

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        contractor.changeStatus(targetStatus as 'ACTIVE' | 'INACTIVE', new Date());
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
        throw new BadRequestException(msg);
      }

      const after = contractor.toPublic();

      if (this.contractorRepo.saveWithClient) await this.contractorRepo.saveWithClient(client, contractor);
      else await this.contractorRepo.save(contractor);

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: auditActionFor(input.action),
          entityType: 'CONTRACTOR',
          entityId: input.contractorId,
          beforeData: before,
          afterData: after,
          reason,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (openAssignments > 0) {
          (payload.afterData as Record<string, unknown>)['_warning'] = openWorkWarningText(openAssignments);
        }
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload as never);
        else await this.audit.log(payload as never);
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return {
      entity: contractor,
      alreadyInState: false,
      warning: openAssignments > 0 ? { openAssignments } : undefined,
    };
  }
}

/** Audit action riêng theo action (issue #27 state policy). */
export function auditActionFor(action: ResourceLifecycleAction): string {
  switch (action) {
    case 'ACTIVATE':
      return 'ORG_CONTRACTOR_REACTIVATED';
    case 'SUSPEND':
      return 'ORG_CONTRACTOR_SUSPENDED';
    case 'TERMINATE':
      return 'ORG_CONTRACTOR_TERMINATED';
  }
}
