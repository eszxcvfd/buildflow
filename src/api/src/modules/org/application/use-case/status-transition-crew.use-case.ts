import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';
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
 * ORG-SRS-006 (issue #29) — lifecycle đội (entity crew.changeStatus, reuse
 * resource-status.policy của #27; crew không có locked → ACTIVATE chỉ đổi status).
 *
 * Mapping: ACTIVATE -> ACTIVE; SUSPEND/TERMINATE -> INACTIVE (enum DB không đổi).
 * - reason bắt buộc (1-500) cho SUSPEND/TERMINATE; optional cho ACTIVATE.
 * - Idempotent repeat → 200 alreadyInState, KHÔNG ghi audit.
 * - Khi rời ACTIVE đếm open assignments của đội → warning + `_warning` audit.
 *   Cảnh báo, KHÔNG chặn. Count fail-closed (lỗi lan ra, không transition thiếu cảnh báo).
 * - Audit tx-embedded 1 lần, reason ở cột audit_logs.reason.
 */

export interface StatusTransitionCrewInput {
  crewId: string;
  action: ResourceLifecycleAction;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface StatusTransitionCrewOutput {
  entity: CrewEntity;
  alreadyInState: boolean;
  warning?: { openAssignments: number };
}

@Injectable()
export class StatusTransitionCrewUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: StatusTransitionCrewInput): Promise<StatusTransitionCrewOutput> {
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

    const crew = await this.crewRepo.findById(input.crewId);
    if (!crew) {
      throw new NotFoundException('Không tìm thấy đội thi công');
    }

    const targetStatus = targetStatusForAction(input.action);
    if (crew.status === targetStatus) {
      // Idempotent repeat: trả 200 alreadyInState, KHÔNG audit.
      return { entity: crew, alreadyInState: true };
    }

    let openAssignments = 0;
    if (isDeactivatingAction(input.action) && crew.status === 'ACTIVE') {
      // Fail-closed: đếm thất bại → lỗi lan ra, không transition thiếu cảnh báo.
      openAssignments = await this.crewRepo.countOpenAssignments(input.crewId);
    }

    const before = crew.toPublic();

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        crew.changeStatus(targetStatus as 'ACTIVE' | 'INACTIVE', new Date());
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
        throw new BadRequestException(msg);
      }

      const after = crew.toPublic();

      if (this.crewRepo.saveWithClient) await this.crewRepo.saveWithClient(client, crew);
      else await this.crewRepo.save(crew);

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: auditActionFor(input.action),
          entityType: 'CREW',
          entityId: input.crewId,
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
      entity: crew,
      alreadyInState: false,
      warning: openAssignments > 0 ? { openAssignments } : undefined,
    };
  }
}

/** Audit action riêng theo action (issue #29 state policy, reuse policy #27). */
export function auditActionFor(action: ResourceLifecycleAction): string {
  switch (action) {
    case 'ACTIVATE':
      return 'ORG_CREW_REACTIVATED';
    case 'SUSPEND':
      return 'ORG_CREW_SUSPENDED';
    case 'TERMINATE':
      return 'ORG_CREW_TERMINATED';
  }
}
