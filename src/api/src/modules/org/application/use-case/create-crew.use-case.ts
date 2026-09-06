import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { CONTRACTOR_REPOSITORY, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

export interface CreateCrewInput {
  code: string;
  name: string;
  leaderUserId: string;
  contractorId?: string | null;
  description?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateCrewOutput {
  entity: CrewEntity;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * ORG-SRS-006 (issue #29) — tạo đội + gán trưởng nhóm trong cùng tx.
 * Leader phải là user tồn tại + user_type='WORKER' + status='ACTIVE',
 * ngược lại 400 fieldErrors {leaderUserId}. Contractor (nếu gửi) phải tồn tại.
 */
@Injectable()
export class CreateCrewUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
    @Inject(CONTRACTOR_REPOSITORY) private readonly contractorRepo: ContractorRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateCrewInput): Promise<CreateCrewOutput> {
    const trimmedCode = input.code.trim();
    if (trimmedCode.length < 2 || trimmedCode.length > 50) {
      throw new BadRequestException('Mã đội phải từ 2 đến 50 ký tự');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      throw new BadRequestException('Mã đội chỉ cho phép chữ, số, _ và -');
    }

    const byCode = await this.crewRepo.findByCode(trimmedCode);
    if (byCode) throw new ConflictException('Mã đội đã tồn tại');

    const trimmedName = input.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      throw new BadRequestException('Tên đội phải từ 2 đến 120 ký tự');
    }

    const contractorId = input.contractorId ?? null;
    if (contractorId !== null && !UUID_RE.test(contractorId)) {
      throw fieldError('contractorId', 'Nhà thầu không hợp lệ');
    }
    if (contractorId !== null) {
      const contractor = await this.contractorRepo.findById(contractorId);
      if (!contractor) throw fieldError('contractorId', 'Nhà thầu không tồn tại');
    }

    if (!input.leaderUserId || !UUID_RE.test(String(input.leaderUserId))) {
      throw fieldError('leaderUserId', 'Trưởng nhóm không hợp lệ');
    }
    const leader = await this.userRepo.findById(String(input.leaderUserId));
    if (!leader || leader.userType !== 'WORKER' || leader.status !== 'ACTIVE') {
      throw fieldError('leaderUserId', 'Trưởng nhóm phải là worker đang hoạt động');
    }

    const now = new Date();
    const id = randomUUID();

    let entity: CrewEntity;
    try {
      entity = new CrewEntity({
        id,
        code: trimmedCode,
        name: trimmedName,
        description: input.description ?? null,
        contractorId,
        status: 'ACTIVE',
        leaderUserId: String(input.leaderUserId),
        createdBy: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.crewRepo.createWithClient) {
          await this.crewRepo.createWithClient(client, entity);
        } else {
          await this.crewRepo.create(entity);
        }
        await this.crewRepo.insertLeadWithClient(client, {
          crewId: id,
          userId: String(input.leaderUserId),
          addedBy: input.actorUserId,
        });
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        // Constraint cụ thể trước: mọi 23505 trên insert LEAD đều nghĩa là
        // đội đã có lead/member đang hiệu lực (ux_crew_one_active_lead hoặc
        // ux_crew_member_active) — check generic 23505 trước sẽ nuốt nhầm.
        if (/ux_crew_one_active_lead/i.test(constraint) || /ux_crew_member_active/i.test(constraint)) {
          throw new ConflictException('Đội đã có trưởng nhóm đang hiệu lực');
        }
        if (code === '23505' || /ux_crews_code/i.test(constraint)) {
          throw new ConflictException('Mã đội đã tồn tại');
        }
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'ORG_CREW_CREATED',
          entityType: 'CREW',
          entityId: id,
          afterData: entity.toPublic(),
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
    });

    return { entity };
  }
}
