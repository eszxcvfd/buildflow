import { TradeEntity } from '../entity/trade.entity';

export interface TradeRepositoryPort {
  findById(id: string): Promise<TradeEntity | null>;
  findByIds(ids: string[]): Promise<TradeEntity[]>;
  findAllActive(): Promise<TradeEntity[]>;
}

export const TRADE_REPOSITORY = Symbol('TRADE_REPOSITORY');
