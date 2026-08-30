import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { HASHER_PORT, HasherPort } from '../../../iam/application/port/hasher.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { UserEntity } from '../../../iam/domain/entity/user.entity';
import { WorkerEntity } from '../../domain/entity/worker.entity';
import { validateTradeAssignment } from '../../domain/service/worker-eligibility.policy';

export interface CreateWorkerInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  contractorId?: string | null;
  trades?: Array<{ tradeId: string; skillLevel: number }>;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateWorkerOutput {
  entity: WorkerEntity;
}

@Injectable()
export class CreateWorkerUseCase {
  constructor(
    @Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort,
    @Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort,
    @Inject(HASHER_PORT) private readonly hasher: HasherPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateWorkerInput): Promise<CreateWorkerOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Validate unique email via worker repo (shares users table)
    const existingByEmail = await this.workerRepo.findMany({ search: normalizedEmail, limit: 1 });
    // More precise: try findById? Instead use underlying user check via findMany search is not precise for email uniqueness.
    // For correctness we also check via direct query: use workerRepo.findById not enough.
    // We will check via findMany with search, but also ensure exact email match in result
    const exactEmailMatch = existingByEmail.entities.find((w) => w.user.email.toLowerCase() === normalizedEmail);
    if (exactEmailMatch) {
      throw new ConflictException('Email đã tồn tại');
    }

    if (input.employeeCode) {
      const byCode = await this.workerRepo.findByEmployeeCode(input.employeeCode.trim());
      if (byCode) throw new ConflictException('Mã nhân viên đã tồn tại');
    }

    // Validate trades
    if (input.trades && input.trades.length > 0) {
      const tradeIds = input.trades.map((t) => t.tradeId);
      const skillLevels = input.trades.map((t) => t.skillLevel);
      try {
        validateTradeAssignment(tradeIds, skillLevels);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Trade không hợp lệ';
        throw new BadRequestException(msg);
      }
      const trades = await this.tradeRepo.findByIds(tradeIds);
      const foundMap = new Map(trades.map((t) => [t.id, t]));
      for (const tid of tradeIds) {
        const t = foundMap.get(tid);
        if (!t || !t.isAssignable()) {
          throw new BadRequestException(`Trade không tồn tại hoặc đã ngừng hoạt động: ${tid}`);
        }
      }
    }

    if (input.password.length < 8) throw new BadRequestException('Mật khẩu tối thiểu 8 ký tự');

    const now = new Date();
    const id = randomUUID();
    let passwordHash: string;
    try {
      passwordHash = await this.hasher.hash(input.password);
    } catch {
      throw new BadRequestException('Không thể băm mật khẩu');
    }

    const user = new UserEntity({
      id,
      email: normalizedEmail,
      passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      employeeCode: input.employeeCode ? input.employeeCode.trim() : null,
      userType: 'WORKER',
      contractorId: input.contractorId ?? null,
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    try {
      user.updateAdmin(
        {
          email: normalizedEmail,
          fullName: input.fullName,
          phone: input.phone ?? undefined,
          avatarUrl: input.avatarUrl ?? undefined,
          employeeCode: input.employeeCode ?? undefined,
          userType: 'WORKER',
          contractorId: input.contractorId ?? undefined,
        },
        now,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    const tradesForEntity = (input.trades ?? []).map((t) => ({
      tradeId: t.tradeId,
      skillLevel: t.skillLevel as 1 | 2 | 3 | 4 | 5,
      effectiveFrom: now,
      effectiveTo: null,
      isActive: true,
    }));

    const entity = new WorkerEntity({ user, trades: tradesForEntity });

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.workerRepo.createWithClient) {
          await this.workerRepo.createWithClient(client, entity);
        } else {
          await this.workerRepo.create(entity);
        }
        if (tradesForEntity.length > 0 && this.workerRepo.assignTradesWithClient) {
          await this.workerRepo.assignTradesWithClient(client, {
            userId: id,
            trades: input.trades ?? [],
            now,
          });
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        // Unique violation mapping
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (code === '23505' || /ux_users/i.test(constraint)) {
          if (/employee_code/i.test(constraint)) throw new ConflictException('Mã nhân viên đã tồn tại');
          if (/phone/i.test(constraint)) throw new ConflictException('Số điện thoại đã tồn tại');
          throw new ConflictException('Email đã tồn tại');
        }
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'ORG_WORKER_CREATED',
          entityType: 'WORKER',
          entityId: id,
          afterData: entity.toPublicProfile(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
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
