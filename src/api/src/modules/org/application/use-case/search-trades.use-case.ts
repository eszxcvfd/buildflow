import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { TRADE_REPOSITORY, TradeRepositoryPort, TradeFilter } from '../../domain/repository/trade-repository.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

export interface SearchTradesInput {
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SearchTradesOutput {
  entities: TradeEntity[];
  total: number;
}

@Injectable()
export class SearchTradesUseCase {
  constructor(@Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort) {}

  async execute(input: SearchTradesInput): Promise<SearchTradesOutput> {
    if (input.status && !['ACTIVE', 'INACTIVE', 'ALL'].includes(input.status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      throw new BadRequestException('Limit không hợp lệ (1-100)');
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
    }

    const filter: TradeFilter = {
      status: input.status,
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    };

    return this.tradeRepo.search(filter);
  }
}
