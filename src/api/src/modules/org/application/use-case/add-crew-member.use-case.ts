import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CREW_REPOSITORY, CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { isValidIsoDateString, todayDateOnly, memberOverlapWarningText } from '../../domain/service/crew-member.policy';

export interface AddCrewMemberInput {
  crewId: string;
  userId: string;
  effectiveFrom?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface OtherCrewRef {
  crewId: string;
  crewCode: string;
  crewName: string;
}

export interface AddCrewMemberOutput {
  member: CrewMemberRow;
  warning?: { code: 'MEMBER_IN_OTHER_CREW'; otherCrews: OtherCrewRef[] };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function coded409(code: string, message: string): ConflictException {
  return new ConflictException({ statusCode: 409, message, code });
}

/**
 * ORG-SRS-007 (issue #30, D1/D3/D4/D5) — thêm thành viên (role MEMBER) vào đội.
 * - LEAD không qua đây (LEAD chỉ qua PATCH /crews/:id leaderUserId swap).
 * - Đội phải ACTIVE (404 crew / 409 CREW_INACTIVE); user phải tồn tại
 *   (user_type STAFF/WORKER, 404 USER_NOT_FOUND) và status ACTIVE (409 USER_INACTIVE).
 * - Re-check crew status trong tx (FOR UPDATE) trước insert — đóng race đổi trạng thái.
 * - Trùng active trong cùng đội → 409 MEMBER_DUPLICATE (pre-check + race guard 23505).
 * - Overlap đội khác → WARN: vẫn 201 kèm warning MEMBER_IN_OTHER_CREW + `_warning` audit.
 */
@Injectable()
export class AddCrewMemberUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: AddCrewMemberInput): Promise<AddCrewMemberOutput> {
    if (!input.userId || !UUID_RE.test(String(input.userId))) {
      throw fieldError('userId', 'Người dùng không hợp lệ');
    }
    const userId = String(input.userId);
    let effectiveFrom = todayDateOnly();
    if (input.effectiveFrom !== undefined && input.effectiveFrom !== null && String(input.effectiveFrom) !== '') {
      if (!isValidIsoDateString(String(input.effectiveFrom))) {
        throw fieldError('effectiveFrom', 'Ngày hiệu lực không hợp lệ (YYYY-MM-DD)');
      }
      effectiveFrom = String(input.effectiveFrom);
    }

    const crew = await this.crewRepo.findById(input.crewId);
    if (!crew) throw new NotFoundException('Không tìm thấy đội thi công');
    if (crew.status !== 'ACTIVE') {
      throw coded409('CREW_INACTIVE', 'Đội đang không hoạt động, không thể thêm thành viên');
    }

    const user = await this.userRepo.findById(userId);
    if (!user || (user.userType !== 'STAFF' && user.userType !== 'WORKER')) {
      throw new NotFoundException({ statusCode: 404, message: 'Không tìm thấy người dùng', code: 'USER_NOT_FOUND' });
    }
    if (user.status !== 'ACTIVE') {
      throw coded409('USER_INACTIVE', 'Người dùng đang không hoạt động');
    }

    const crewCode = crew.code;
    let member: CrewMemberRow | null = null;
    let otherCrews: OtherCrewRef[] = [];

    await this.tx.withTransaction(async (client: PoolClient) => {
      // D4: re-check status trong tx ngay trước insert.
      const locked = await this.crewRepo.findCrewForUpdateWithClient(client, input.crewId);
      if (!locked) throw new NotFoundException('Không tìm thấy đội thi công');
      if (locked.status !== 'ACTIVE') {
        throw coded409('CREW_INACTIVE', 'Đội đang không hoạt động, không thể thêm thành viên');
      }

      const dup = await this.crewRepo.findActiveMemberWithClient(client, input.crewId, userId);
      if (dup) {
        throw coded409('MEMBER_DUPLICATE', 'Thành viên đã thuộc đội');
      }

      try {
        member = await this.crewRepo.insertMemberWithClient(client, {
          crewId: input.crewId,
          userId,
          effectiveFrom,
          addedBy: input.actorUserId,
        });
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        // Constraint-order: check cụ thể trước generic 23505.
        if (/ux_crew_member_active/i.test(constraint)) {
          throw coded409('MEMBER_DUPLICATE', 'Thành viên đã thuộc đội');
        }
        if (/crew_members_effective_dates_ck/i.test(constraint) || /crew_members_revocation_ck/i.test(constraint)) {
          throw fieldError('effectiveFrom', 'Ngày hiệu lực không thỏa mãn ràng buộc dữ liệu');
        }
        // Fix F4: check constraint vi phạm nhưng driver không kèm tên
        // (code 23514 trần) → 400 fieldErrors thay vì 500.
        if (code === '23514') {
          throw fieldError('effectiveFrom', 'khoảng thời gian hiệu lực không hợp lệ');
        }
        if (code === '23505') {
          throw coded409('MEMBER_DUPLICATE', 'Thành viên đã thuộc đội');
        }
        throw e;
      }

      // D3: overlap WARN — active ở đội khác không chặn.
      otherCrews = await this.crewRepo.findActiveMembershipsOfUserWithClient(client, userId, input.crewId);

      try {
        const inserted: CrewMemberRow = member as CrewMemberRow;
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'ORG_CREW_MEMBER_ADDED',
          entityType: 'CREW',
          entityId: input.crewId,
          beforeData: null,
          afterData: { ...inserted, crewCode },
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (otherCrews.length > 0) {
          (payload.afterData as Record<string, unknown>)['_warning'] = memberOverlapWarningText(otherCrews);
        }
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
    });

    if (!member) throw new InternalServerErrorException('Không thể thêm thành viên');
    const inserted: CrewMemberRow = member;
    if (otherCrews.length === 0) return { member: inserted };
    return { member: inserted, warning: { code: 'MEMBER_IN_OTHER_CREW', otherCrews } };
  }
}
