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
    // ORG-SRS-005 (issue #28) — filter errors carry fieldErrors alongside the
    // unchanged message text (object literal, no presentation import).
    if (input.status && !['ACTIVE', 'INACTIVE', 'ALL'].includes(input.status)) {
      throw new BadRequestException({ statusCode: 400, message: 'Trạng thái không hợp lệ', fieldErrors: { status: ['Trạng thái không hợp lệ'] } });
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)) {
      throw new BadRequestException({ statusCode: 400, message: 'Limit không hợp lệ (1-100)', fieldErrors: { limit: ['Limit không hợp lệ (1-100)'] } });
    }
    if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
      throw new BadRequestException({ statusCode: 400, message: 'Offset không hợp lệ (phải >= 0)', fieldErrors: { offset: ['Offset không hợp lệ (phải >= 0)'] } });
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
