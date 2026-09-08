import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { ProjectEntity } from '../../domain/entity/project.entity';
import {
  allowedActionsFor,
  isAlreadyInProjectState,
  isProjectStatusAction,
  isReasonRequiredForProjectAction,
  normalizeProjectStatusReason,
  PROJECT_REASON_REQUIRED_MESSAGE,
  ProjectStatus,
  ProjectStatusAction,
  targetStatusForProjectAction,
} from '../../domain/service/project.policy';

export interface TransitionProjectStatusInput {
  projectId: string;
  /** Action lifecycle L1 (string thô từ transport; unknown → 400). */
  action: string;
  reason?: string | null;
  actorUserId: string;
  /** Roles server-derived từ JWT (write-scope: ADMIN bypass hoặc member MANAGER/COORDINATOR). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface TransitionProjectStatusOutput {
  entity: ProjectEntity;
  managerName: string | null;
  alreadyInState: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function invalidTransition(from: ProjectStatus, action: string): ConflictException {
  const allowedTransitions = allowedActionsFor(from);
  return new ConflictException({
    statusCode: 409,
    message: `Không thể chuyển dự án từ ${from} với action ${action}`,
    code: 'INVALID_TRANSITION',
    allowedTransitions,
  });
}

/**
 * PRJ-SRS-002 (issue #33) — lifecycle trạng thái dự án (L1-L6).
 * - Endpoint `PATCH /api/v1/projects/:id/status` (L2; per-project scope write
 *   check enforce từ #37 — PRJ-SRS-006: ADMIN bypass audited HOẶC ACTIVE member
 *   MANAGER/COORDINATOR; xem ENDPOINTS.md §15).
 * - Transition map L1 duy nhất; action không hợp lệ với trạng thái hiện tại →
 *   409 `INVALID_TRANSITION` kèm `allowedTransitions` (action chưa biết → 400).
 * - Reason bắt buộc 1-500 cho PAUSE/CLOSE/REOPEN → thiếu là 400 fieldErrors `{reason}`
 *   (chỉ cho transition hiệu lực; repeat no-op L3 miễn).
 * - Idempotent org-pattern (L3): action nhắm đúng trạng thái hiện tại → 200
 *   `{alreadyInState: true}`, không mutation, không audit.
 * - Tx với `FOR UPDATE` re-read (L4): race đổi trạng thái giữa pre-read và tx →
 *   đánh giá lại trên row mới nhất (alreadyInState hoặc 409 map per SRS).
 * - Audit `PRJ_PROJECT_STATUS_CHANGED` (`entityType` `PROJECT`, tx-embedded,
 *   before/after full rows chứa `{status}`, `reason` ở cột audit_logs.reason);
 *   audit thất bại → 500 rollback (catch-all).
 * - History = `audit_logs` append-only, không bảng transitions riêng (L5).
 * - 'Dự án Đóng không tạo Work Order mới' defer sang slice JOB (L6 — chưa có module WO).
 */
@Injectable()
export class TransitionProjectStatusUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: TransitionProjectStatusInput): Promise<TransitionProjectStatusOutput> {
    // PRJ-SRS-006 (issue #37): write-scope TRƯỚC pre-read 404 (anti-leak:
    // non-member luôn 403; kể cả alreadyInState repeat cũng 403 khi revoked).
    const { isAdminBypass } = await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId: input.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    if (!isProjectStatusAction(input.action)) {
      throw new BadRequestException(`Action không hợp lệ: ${String(input.action)}`);
    }
    const action: ProjectStatusAction = input.action;

    let reason: string | null = null;
    try {
      reason = normalizeProjectStatusReason(input.reason);
    } catch (e) {
      throw fieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }
    const existing = await this.projectRepo.findProfileById(input.projectId);
    if (!existing) throw new NotFoundException('Không tìm thấy dự án');

    // L3 idempotency wins: lặp action khi đã ở trạng thái đích → no-op 200
    // {alreadyInState: true} kể cả khi thiếu reason; reason L1 chỉ bắt buộc
    // cho transition hiệu lực.
    if (isAlreadyInProjectState(existing.entity.status, action)) {
      return { entity: existing.entity, managerName: existing.managerName, alreadyInState: true };
    }
    if (isReasonRequiredForProjectAction(action) && reason === null) {
      throw fieldError('reason', PROJECT_REASON_REQUIRED_MESSAGE);
    }
    const preTarget = targetStatusForProjectAction(existing.entity.status, action);
    if (preTarget === null) throw invalidTransition(existing.entity.status, input.action);

    let result: TransitionProjectStatusOutput | null = null;
    await this.tx.withTransaction(async (client: PoolClient) => {
      const current = await this.projectRepo.findForUpdateWithClient(client, input.projectId);
      if (!current) throw new NotFoundException('Không tìm thấy dự án');

      // PRJ-SRS-006: re-check membership TRONG cùng tx, ngay sau lock, trước
      // mutation (revoke mid-flight → 403 → rollback).
      const actorMembership = await this.projectRepo.findActiveMemberWithClient(
        client,
        input.projectId,
        input.actorUserId,
      );
      this.scope.assertWriteScopeTxCheck(isAdminBypass, actorMembership?.projectRole ?? null);

      // Re-đánh giá trên row mới nhất (L4): race có thể đã đổi trạng thái.
      if (isAlreadyInProjectState(current.entity.status, action)) {
        result = { entity: current.entity, managerName: current.managerName, alreadyInState: true };
        return;
      }
      const target = targetStatusForProjectAction(current.entity.status, action);
      if (target === null) throw invalidTransition(current.entity.status, input.action);

      const before = { ...current.entity.toPublic(), managerName: current.managerName };

      try {
        current.entity.changeStatus(target, new Date());
      } catch (e) {
        throw invalidTransition(current.entity.status, input.action);
      }

      await this.projectRepo.saveWithClient(client, current.entity);

      const after = { ...current.entity.toPublic(), managerName: current.managerName };

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_STATUS_CHANGED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: before,
          afterData: after,
          reason,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload);
        else await this.audit.log(payload);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }

      result = { entity: current.entity, managerName: current.managerName, alreadyInState: false };
    });

    if (!result) throw new InternalServerErrorException('Không thể chuyển trạng thái dự án');
    return result;
  }
}
