import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CREW_REPOSITORY, CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { isValidIsoDateString, todayDateOnly, normalizeMemberReason } from '../../domain/service/crew-member.policy';

export interface RemoveCrewMemberInput {
  crewId: string;
  memberId: string;
  effectiveTo?: string | null;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface RemoveCrewMemberOutput {
  member: CrewMemberRow;
  alreadyRemoved: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function coded409(code: string, message: string): ConflictException {
  return new ConflictException({ statusCode: 409, message, code });
}

/**
 * ORG-SRS-007 (issue #30, D2/D5) — xóa mềm thành viên đội.
 * - Row KHÔNG bao giờ bị xóa: is_active=false + effective_to=<given>.
 * - LEAD không qua đây (409 MEMBER_IS_LEAD) — đổi trưởng nhóm qua
 *   PATCH /crews/:id leaderUserId swap.
 * - Idempotent: member đã inactive → 200 {alreadyRemoved:true}, không audit, không mutation.
 * - effectiveTo (default today) phải là ISO date và >= effective_from.
 */
@Injectable()
export class RemoveCrewMemberUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: RemoveCrewMemberInput): Promise<RemoveCrewMemberOutput> {
    let reason: string | null = null;
    try {
      reason = normalizeMemberReason(input.reason);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lý do không hợp lệ';
      throw fieldError('reason', msg);
    }

    let effectiveTo = todayDateOnly();
    if (input.effectiveTo !== undefined && input.effectiveTo !== null && String(input.effectiveTo) !== '') {
      if (!isValidIsoDateString(String(input.effectiveTo))) {
        throw fieldError('effectiveTo', 'Ngày kết thúc không hợp lệ (YYYY-MM-DD)');
      }
      effectiveTo = String(input.effectiveTo);
    }

    let result: RemoveCrewMemberOutput | null = null;

    await this.tx.withTransaction(async (client: PoolClient) => {
      const existing = await this.crewRepo.findMemberByIdWithClient(client, input.memberId);
      if (!existing || existing.crewId !== input.crewId) {
        throw new NotFoundException('Không tìm thấy thành viên trong đội');
      }
      // Fix F2: LEAD không qua slice này — đổi trưởng nhóm qua sửa hồ sơ đội
      // (PATCH /crews/:id leaderUserId swap).
      if (existing.memberRole === 'LEAD') {
        throw coded409(
          'MEMBER_IS_LEAD',
          'Trưởng nhóm không thể xóa qua đây — đổi trưởng nhóm qua sửa hồ sơ đội (leaderUserId)',
        );
      }
      if (!existing.isActive) {
        // Idempotent: không mutation, không audit.
        result = { member: existing, alreadyRemoved: true };
        return;
      }
      if (effectiveTo < existing.effectiveFrom) {
        throw fieldError('effectiveTo', 'Ngày kết thúc phải từ ngày hiệu lực trở đi');
      }

      let updated: CrewMemberRow | null = null;
      try {
        updated = await this.crewRepo.deactivateMemberWithClient(client, input.memberId, effectiveTo);
      } catch (e) {
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (/crew_members_effective_dates_ck/i.test(constraint) || /crew_members_revocation_ck/i.test(constraint)) {
          throw fieldError('effectiveTo', 'Ngày kết thúc không thỏa mãn ràng buộc dữ liệu');
        }
        // Fix F4: check constraint vi phạm nhưng driver không kèm tên
        // (code 23514 trần) → 400 fieldErrors thay vì 500.
        if (code === '23514') {
          throw fieldError('effectiveTo', 'khoảng thời gian hiệu lực không hợp lệ');
        }
        throw e;
      }
      if (!updated) throw new NotFoundException('Không tìm thấy thành viên trong đội');

      try {
        // Fix F5: đọc crew trong tx (WithClient) cho audit — không pool read
        // findById ngoài tx.
        const crew = await this.crewRepo.findCrewByIdWithClient(client, input.crewId);
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'ORG_CREW_MEMBER_REMOVED',
          entityType: 'CREW',
          entityId: input.crewId,
          beforeData: { ...existing, crewCode: crew?.code ?? null },
          afterData: { ...updated, crewCode: crew?.code ?? null },
          reason,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        // Fix F6: fail closed — tx audit bắt buộc logWithClient; adapter không
        // hỗ trợ (undefined) thì 500 rollback thay vì ghi non-tx lặng lẽ.
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        // Fix F3: mọi lỗi từ audit block đều → 500 rollback, bất kể kiểu
        // lỗi gốc (kể cả HttpException như ConflictException).
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }

      result = { member: updated, alreadyRemoved: false };
    });

    if (!result) throw new InternalServerErrorException('Không thể xóa thành viên');
    return result;
  }
}
