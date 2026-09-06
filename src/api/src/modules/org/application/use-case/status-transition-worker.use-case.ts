import { Inject, Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';
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
 * ORG-SRS-004 (issue #27) — lifecycle worker.
 *
 * Action enum ở API layer: ACTIVATE | SUSPEND | TERMINATE (KHÔNG đổi enum DB):
 *   ACTIVATE  -> ACTIVE
 *   SUSPEND   -> INACTIVE (reason bắt buộc)
 *   TERMINATE -> INACTIVE (reason bắt buộc)
 *
 * - Idempotent repeat (SUSPEND/TERMINATE khi đã INACTIVE, ACTIVATE khi đã ACTIVE):
 *   KHÔNG ghi audit, trả 200 { status hiện tại, alreadyInState: true } — lifecycle
 *   tự check TRƯỚC khi gọi changeStatus (khác reject same-status cũ của user.changeStatus).
 * - Worker thật sự chuyển trạng thái: dùng entity method changeStatus hiện có
 *   (UserEntity.changeStatus — ACTIVATE xóa locked_until như hành vi IAM hiện tại),
 *   tránh duplicate logic change-status (pattern đã chốt: gọi logic entity chung,
 *   không sao chép). PATCH /admin/users/:id/status cũ (LOCKED/security) không đổi.
 * - Open-work warning: transition RA KHỎI ACTIVE sẽ đếm assignments đang mở
 *   (PENDING_ACCEPTANCE/ACTIVE) của worker; cảnh báo, KHÔNG chặn.
 * - Audit tx-embedded 1 lần, action riêng theo action, `reason` ở cột audit_logs.reason
 *   (write path lần đầu wire), KHÔNG đưa reason vào beforeData/afterData; afterData
 *   gắn `_warning` (text tiếng Việt) khi có open work — pass no-secrets sanitize.
 * - Double-submit/repeat cùng X-Correlation-Id bị dedup (ON CONFLICT DO NOTHING);
 *   request lặp trạng thái giống nhau không gọi audit (idempotent check trước).
 */

export interface StatusTransitionWorkerInput {
  workerId: string;
  action: ResourceLifecycleAction;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface StatusTransitionWorkerOutput {
  entity: WorkerEntity;
  alreadyInState: boolean;
  warning?: { openAssignments: number };
}

@Injectable()
export class StatusTransitionWorkerUseCase {
  constructor(
    @Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: StatusTransitionWorkerInput): Promise<StatusTransitionWorkerOutput> {
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

    const worker = await this.workerRepo.findById(input.workerId);
    if (!worker) {
      throw new NotFoundException('Không tìm thấy hồ sơ worker');
    }

    const targetStatus = targetStatusForAction(input.action);
    if (worker.status === targetStatus) {
      // Idempotent repeat (issue #27): request lặp không ghi audit, trả trạng thái hiện tại.
      return { entity: worker, alreadyInState: true };
    }

    // Cảnh báo open work TRƯỚC khi rời khỏi ACTIVE; đếm thất bại = không biết có
    // open work không → không được transition im lặng thiếu cảnh báo (cùng nguyên
    // tắc countActiveUsage của trade): để lỗi lan ra 500.
    let openAssignments = 0;
    if (isDeactivatingAction(input.action) && worker.status === 'ACTIVE') {
      openAssignments = await this.workerRepo.countOpenAssignments(input.workerId);
    }

    const before = worker.toPublicProfile();

    await this.tx.withTransaction(async (client: PoolClient) => {
      // Domain mutation qua changeStatus hiện có (UserEntity) — ACTIVATE xóa
      // locked_until; lifecycle đã tự check idempotent nên không chạm reject same-status.
      try {
        worker.user.changeStatus(targetStatus, new Date());
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
        throw new BadRequestException(msg);
      }

      const after = worker.toPublicProfile();

      if (this.workerRepo.saveWithClient) await this.workerRepo.saveWithClient(client, worker);
      else await this.workerRepo.save(worker);

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: auditActionFor(input.action),
          entityType: 'WORKER',
          entityId: input.workerId,
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
      entity: worker,
      alreadyInState: false,
      warning: openAssignments > 0 ? { openAssignments } : undefined,
    };
  }
}

/** Audit action riêng theo action (issue #27 state policy). */
export function auditActionFor(action: ResourceLifecycleAction): string {
  switch (action) {
    case 'ACTIVATE':
      return 'ORG_WORKER_REACTIVATED';
    case 'SUSPEND':
      return 'ORG_WORKER_SUSPENDED';
    case 'TERMINATE':
      return 'ORG_WORKER_TERMINATED';
  }
}
