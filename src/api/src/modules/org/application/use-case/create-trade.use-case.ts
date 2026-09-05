import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

export interface CreateTradeInput {
  code: string;
  name: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateTradeOutput {
  entity: TradeEntity;
}

@Injectable()
export class CreateTradeUseCase {
  constructor(
    @Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateTradeInput): Promise<CreateTradeOutput> {
    const trimmedCode = input.code.trim();
    if (trimmedCode.length < 2 || trimmedCode.length > 50) {
      throw new BadRequestException('Mã ngành nghề phải từ 2 đến 50 ký tự');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmedCode)) {
      throw new BadRequestException('Mã ngành nghề chỉ cho phép chữ, số, _ và -');
    }

    // ORG-SRS-003: dup code pre-check + 23505 race guard bên trong tx
    const byCode = await this.tradeRepo.findByCode(trimmedCode);
    if (byCode) throw new ConflictException('Mã ngành nghề đã tồn tại');

    const trimmedName = input.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 120) {
      throw new BadRequestException('Tên ngành nghề phải từ 1 đến 120 ký tự');
    }

    if (input.status && !['ACTIVE', 'INACTIVE'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    if (input.description !== undefined && input.description !== null && input.description.trim().length > 500) {
      throw new BadRequestException('Mô tả ngành nghề tối đa 500 ký tự');
    }

    const now = new Date();
    const id = randomUUID();

    let entity: TradeEntity;
    try {
      entity = new TradeEntity({
        id,
        code: trimmedCode,
        name: trimmedName,
        description: input.description ?? null,
        isActive: input.status !== 'INACTIVE',
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.tradeRepo.createWithClient) {
          await this.tradeRepo.createWithClient(client, entity);
        } else {
          await this.tradeRepo.create(entity);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        if (code === '23505' || /ux_trades/i.test(constraint)) {
          throw new ConflictException('Mã ngành nghề đã tồn tại');
        }
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'ORG_TRADE_CREATED',
          entityType: 'TRADE',
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
