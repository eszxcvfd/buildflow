import { Inject, Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { validateTradeAssignment } from '../../domain/service/worker-eligibility.policy';

export interface UpdateWorkerInput {
  workerId: string;
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  contractorId?: string | null;
  trades?: Array<{ tradeId: string; skillLevel: number }>;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

@Injectable()
export class UpdateWorkerUseCase {
  constructor(
    @Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort,
    @Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateWorkerInput): Promise<{ entity: import('../../domain/entity/worker.entity').WorkerEntity }> {
    const worker = await this.workerRepo.findById(input.workerId);
    if (!worker) throw new NotFoundException('Không tìm thấy hồ sơ worker');

    const before = worker.toPublicProfile();

    if (input.employeeCode !== undefined && input.employeeCode !== null && input.employeeCode !== '') {
      const byCode = await this.workerRepo.findByEmployeeCode(input.employeeCode.trim());
      if (byCode && byCode.id !== input.workerId) throw new ConflictException('Mã nhân viên đã tồn tại');
    }

    if (input.trades) {
      const tradeIds = input.trades.map((t) => t.tradeId);
      const skillLevels = input.trades.map((t) => t.skillLevel);
      try {
        validateTradeAssignment(tradeIds, skillLevels);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Trade không hợp lệ';
        throw new BadRequestException(msg);
      }
      const trades = await this.tradeRepo.findByIds(tradeIds);
      const map = new Map(trades.map((t) => [t.id, t]));
      for (const tid of tradeIds) {
        const t = map.get(tid);
        if (!t || !t.isAssignable()) throw new BadRequestException(`Trade không tồn tại hoặc đã ngừng hoạt động: ${tid}`);
      }
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        worker.user.updateAdmin(
          {
            fullName: input.fullName,
            phone: input.phone,
            avatarUrl: input.avatarUrl,
            employeeCode: input.employeeCode,
            contractorId: input.contractorId,
          },
          new Date(),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
        throw new BadRequestException(msg);
      }

      try {
        if (this.workerRepo.saveWithClient) await this.workerRepo.saveWithClient(client, worker);
        else await this.workerRepo.save(worker);
      } catch (e) {
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (code === '23505' || /ux_users/i.test(constraint)) {
          if (/employee_code/i.test(constraint)) throw new ConflictException('Mã nhân viên đã tồn tại');
          throw new ConflictException('Email đã tồn tại');
        }
        throw e;
      }

      if (input.trades && this.workerRepo.assignTradesWithClient) {
        await this.workerRepo.assignTradesWithClient(client, {
          userId: input.workerId,
          trades: input.trades,
          now: new Date(),
        });
        // refresh trades on entity for response (simplified)
        (worker as unknown as { props: { trades: unknown } }).props = {
          ...worker.getProps(),
          trades: input.trades.map((t) => ({
            tradeId: t.tradeId,
            skillLevel: t.skillLevel as 1 | 2 | 3 | 4 | 5,
            effectiveFrom: new Date(),
            effectiveTo: null,
            isActive: true,
          })),
        } as never;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'ORG_WORKER_UPDATED',
          entityType: 'WORKER',
          entityId: input.workerId,
          beforeData: before,
          afterData: worker.toPublicProfile(),
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

    return { entity: worker };
  }
}
