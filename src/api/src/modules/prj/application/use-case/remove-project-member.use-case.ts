import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { normalizeProjectMemberReason } from '../../domain/service/project-member.policy';

export interface RemoveProjectMemberInput {
  projectId: string;
  memberId: string;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface RemoveProjectMemberOutput {
  member: ProjectMemberRow;
  alreadyRemoved: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function coded409(code: string, message: string): ConflictException {
  return new ConflictException({ statusCode: 409, message, code });
}

/**
 * PRJ-SRS-005 (issue #36, M2/M3/M5/M6) — xóa mềm thành viên dự án
 * (mirror `RemoveCrewMemberUseCase` #30).
 * - Row KHÔNG bao giờ bị xóa: `is_active=false` + `left_at=CURRENT_TIMESTAMP`
 *   (thỏa `revocation_ck`; xem §12 M2 — `CURRENT_DATE` nửa đêm vi phạm
 *   `membership_dates_ck` khi remove cùng ngày join).
 * - GUARD (M3, mirror `MEMBER_IS_LEAD` #30): row có `user_id` trùng
 *   `projects.manager_id` → 409 `{code:'MANAGER_MEMBER'}` — kiểm tra TRƯỚC
 *   nhánh idempotent nên membership của manager dù đã inactive vẫn 409.
 * - Idempotent: đã inactive (non-manager) → 200 `{alreadyRemoved:true}`,
 *   không mutation, không audit.
 * - `reason` optional 1-500 (M1) → cột `audit_logs.reason`.
 * - Closed project vẫn cho remove (M5 — document, không check status).
 * - Audit `PRJ_PROJECT_MEMBER_REMOVED` (`entityType` `PROJECT`, before/after
 *   member row + `projectCode`); audit fail → 500 rollback.
 */
@Injectable()
export class RemoveProjectMemberUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: RemoveProjectMemberInput): Promise<RemoveProjectMemberOutput> {
    let reason: string | null = null;
    try {
      reason = normalizeProjectMemberReason(input.reason);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lý do không hợp lệ';
      throw fieldError('reason', msg);
    }

    let result: RemoveProjectMemberOutput | null = null;

    await this.tx.withTransaction(async (client: PoolClient) => {
      const existing = await this.projectRepo.findMemberByIdWithClient(client, input.memberId);
      if (!existing || existing.projectId !== input.projectId) {
        throw new NotFoundException('Không tìm thấy thành viên trong dự án');
      }

      // M3 GUARD: membership của manager hiện tại không qua slice này —
      // đổi quản lý qua PATCH /projects/:id managerId. Chạy trước
      // idempotent nên inactive-manager-membership vẫn 409.
      const locked = await this.projectRepo.findForUpdateWithClient(client, input.projectId);
      if (!locked) throw new NotFoundException('Không tìm thấy dự án');
      if (existing.userId === locked.entity.managerId) {
        throw coded409(
          'MANAGER_MEMBER',
          'Quản lý dự án không thể xóa khỏi thành viên — đổi quản lý qua PATCH /projects/:id managerId',
        );
      }

      if (!existing.isActive) {
        // Idempotent: không mutation, không audit (mirror #30).
        result = { member: existing, alreadyRemoved: true };
        return;
      }

      const updated = await this.projectRepo.deactivateMemberWithClient(client, input.memberId);
      if (!updated) throw new NotFoundException('Không tìm thấy thành viên trong dự án');

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_MEMBER_REMOVED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: { ...existing, projectCode: locked.entity.code },
          afterData: { ...updated, projectCode: locked.entity.code },
          reason,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }

      result = { member: updated, alreadyRemoved: false };
    });

    if (!result) throw new InternalServerErrorException('Không thể xóa thành viên dự án');
    return result;
  }
}
