import { Inject, Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

export interface UpdateCrewInput {
  crewId: string;
  name?: string;
  description?: string | null;
  contractorId?: string | null;
  leaderUserId?: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * ORG-SRS-006 (issue #29) — cập nhật đội.
 * - Đổi tên/mô tả/nhà thầu → audit `ORG_CREW_UPDATED`.
 * - Đổi trưởng nhóm (leaderUserId khác LEAD hiện tại) → soft-deactivate LEAD cũ
 *   + insert LEAD mới trong cùng tx, audit riêng `ORG_CREW_LEAD_CHANGED`
 *   (beforeData/afterData chứa leader cũ/mới qua `leaderUserId`).
 * - Gửi đúng leader hiện tại → no-op, không audit lead.
 */
@Injectable()
export class UpdateCrewUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
    @Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateCrewInput): Promise<{ entity: CrewEntity }> {
    const crew = await this.crewRepo.findById(input.crewId);
    if (!crew) throw new NotFoundException('Không tìm thấy đội thi công');

    const before = crew.toPublic();

    if (input.contractorId !== undefined && input.contractorId !== null && !UUID_RE.test(String(input.contractorId))) {
      throw fieldError('contractorId', 'Nhà thầu không hợp lệ');
    }
    if (input.contractorId !== undefined && input.contractorId !== null) {
      const contractor = await this.contractorRepo.findById(String(input.contractorId));
      if (!contractor) throw fieldError('contractorId', 'Nhà thầu không tồn tại');
    }

    // Leader swap chỉ chạy khi leaderUserId đổi so với LEAD đang hiệu lực.
    let leaderChanged = false;
    let newLeaderId: string | null = null;
    if (input.leaderUserId !== undefined) {
      if (!UUID_RE.test(String(input.leaderUserId))) {
        throw fieldError('leaderUserId', 'Trưởng nhóm không hợp lệ');
      }
      newLeaderId = String(input.leaderUserId);
      if (newLeaderId !== crew.leaderUserId) {
        const leader = await this.userRepo.findById(newLeaderId);
        if (!leader || leader.userType !== 'WORKER' || leader.status !== 'ACTIVE') {
          throw fieldError('leaderUserId', 'Trưởng nhóm phải là worker đang hoạt động');
        }
        leaderChanged = true;
      }
    }

    // P2-1 (review #29): validation thuần (sync, không I/O) chạy TRƯỚC tx,
    // chỉ convert lỗi validation → 400. I/O DB trong tx fail-closed:
    // lỗi lạ rethrow nguyên trạng để NestJS → 500.
    if (input.name !== undefined || input.description !== undefined || input.contractorId !== undefined) {
      try {
        crew.updateDetails(
          {
            name: input.name,
            description: input.description,
            contractorId: input.contractorId,
          },
          new Date(),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
        throw new BadRequestException(msg);
      }
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      if (leaderChanged && newLeaderId !== null) {
        await this.crewRepo.deactivateActiveLeadWithClient(client, input.crewId);
        try {
          crew.setLeaderUserId(newLeaderId, new Date());
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
          throw new BadRequestException(msg);
        }
      }

      try {
        if (this.crewRepo.saveWithClient) await this.crewRepo.saveWithClient(client, crew);
        else await this.crewRepo.save(crew);
      } catch (e) {
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (code === '23505' || /ux_crews_code/i.test(constraint)) {
          throw new ConflictException('Mã đội đã tồn tại');
        }
        throw e;
      }

      try {
        if (leaderChanged && newLeaderId !== null) {
          await this.crewRepo.insertLeadWithClient(client, {
            crewId: input.crewId,
            userId: newLeaderId,
            addedBy: input.actorUserId,
          });
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (/ux_crew_one_active_lead/i.test(constraint) || /ux_crew_member_active/i.test(constraint) || code === '23505') {
          throw new ConflictException('Đội đã có trưởng nhóm đang hiệu lực');
        }
        throw e;
      }

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: leaderChanged ? 'ORG_CREW_LEAD_CHANGED' : 'ORG_CREW_UPDATED',
          entityType: 'CREW',
          entityId: input.crewId,
          beforeData: before,
          afterData: crew.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload as never);
        else await this.audit.log(payload as never);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity: crew };
  }
}
