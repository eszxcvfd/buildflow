import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

export interface GetTradeInput { tradeId: string; }

@Injectable()
export class GetTradeUseCase {
  constructor(@Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort) {}
  async execute(input: GetTradeInput): Promise<{ entity: TradeEntity }> {
    const entity = await this.tradeRepo.findById(input.tradeId);
    if (!entity) throw new NotFoundException('Không tìm thấy ngành nghề');
    return { entity };
  }
}
