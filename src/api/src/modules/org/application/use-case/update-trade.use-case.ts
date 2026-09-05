import { Inject, Injectable, NotFoundException, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

export interface UpdateTradeInput {
  tradeId: string;
  code?: string;
  name?: string;
  description?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateTradeOutput {
  entity: TradeEntity;
}

@Injectable()
export class UpdateTradeUseCase {
  constructor(
    @Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateTradeInput): Promise<UpdateTradeOutput> {
    const trade = await this.tradeRepo.findById(input.tradeId);
    if (!trade) throw new NotFoundException('Không tìm thấy ngành nghề');

    const before = trade.toPublic();

    if (input.code !== undefined) {
      const trimmed = input.code.trim();
      if (trimmed.length < 2 || trimmed.length > 50) throw new BadRequestException('Mã ngành nghề phải từ 2 đến 50 ký tự');
      if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new BadRequestException('Mã ngành nghề chỉ cho phép chữ, số, _ và -');
      if (trimmed.toLowerCase() !== trade.code.toLowerCase()) {
        const byCode = await this.tradeRepo.findByCode(trimmed);
        if (byCode && byCode.id !== input.tradeId) throw new ConflictException('Mã ngành nghề đã tồn tại');
      }
    }
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length < 1 || trimmed.length > 120) throw new BadRequestException('Tên ngành nghề phải từ 1 đến 120 ký tự');
    }
    if (input.description !== undefined && input.description !== null && input.description.trim().length > 500) {
      throw new BadRequestException('Mô tả ngành nghề tối đa 500 ký tự');
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (input.code !== undefined) {
          const props = trade.getProps();
          props.code = input.code.trim();
          const tmp = new TradeEntity(props);
          (trade as unknown as { props: typeof props }).props = tmp.getProps();
        }
        trade.updateDetails(
          {
            name: input.name,
            description: input.description,
          },
          new Date(),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
        throw new BadRequestException(msg);
      }

      try {
        if (this.tradeRepo.saveWithClient) await this.tradeRepo.saveWithClient(client, trade);
        else await this.tradeRepo.save(trade);
      } catch (e) {
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
          action: 'ORG_TRADE_UPDATED',
          entityType: 'TRADE',
          entityId: input.tradeId,
          beforeData: before,
          afterData: trade.toPublic(),
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

    return { entity: trade };
  }
}
