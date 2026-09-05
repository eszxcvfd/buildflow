import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { TradeEntity, TradeStatus } from '../../domain/entity/trade.entity';

export const TRADE_IN_USE_WARNING = 'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực';

export interface ChangeTradeStatusInput {
  tradeId: string;
  status: TradeStatus;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface ChangeTradeStatusOutput {
  entity: TradeEntity;
  warning?: string;
}

@Injectable()
export class ChangeTradeStatusUseCase {
  constructor(
    @Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: ChangeTradeStatusInput): Promise<ChangeTradeStatusOutput> {
    if (!['ACTIVE', 'INACTIVE'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    const trade = await this.tradeRepo.findById(input.tradeId);
    if (!trade) throw new NotFoundException('Không tìm thấy ngành nghề');

    const before = trade.toPublic();
    const transitioningToInactive = input.status === 'INACTIVE' && trade.isActiveStatus();

    // ORG-SRS-003: catalog đã dùng chỉ ngừng hoạt động (không xóa); nếu đang được
    // tham chiếu bởi resource/work type/work order đang hiệu lực thì vẫn cho phép
    // deactivate nhưng gắn cảnh báo vào audit afterData và trả warning về response.
    // countActiveUsage thất bại = không biết trade có đang được dùng không → KHÔNG
    // được deactivate im lặng thiếu cảnh báo; để lỗi lan ra (500) thay vì swallow.
    let usageWarning = false;
    if (transitioningToInactive) {
      const usage = await this.tradeRepo.countActiveUsage(input.tradeId);
      usageWarning = usage > 0;
    }

    try {
      trade.changeStatus(input.status, new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Trạng thái không hợp lệ';
      throw new BadRequestException(msg);
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      if (this.tradeRepo.saveWithClient) await this.tradeRepo.saveWithClient(client, trade);
      else await this.tradeRepo.save(trade);

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'ORG_TRADE_STATUS_CHANGED',
          entityType: 'TRADE',
          entityId: input.tradeId,
          beforeData: before,
          afterData: trade.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (usageWarning) {
          (payload.afterData as Record<string, unknown>)['_warning'] = TRADE_IN_USE_WARNING;
        }
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload as never);
        else await this.audit.log(payload as never);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity: trade, warning: usageWarning ? TRADE_IN_USE_WARNING : undefined };
  }
}