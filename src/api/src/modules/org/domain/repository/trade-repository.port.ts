import { PoolClient } from 'pg';
import { TradeEntity } from '../entity/trade.entity';

export type TradeFilterStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface TradeFilter {
  status?: TradeFilterStatus;
  search?: string; // search code, name (ILIKE)
  limit?: number;
  offset?: number;
}

export interface TradeRepositoryPort {
  findById(id: string): Promise<TradeEntity | null>;
  findByIds(ids: string[]): Promise<TradeEntity[]>;
  findAllActive(): Promise<TradeEntity[]>;
  findByCode(code: string): Promise<TradeEntity | null>;
  search(filter: TradeFilter): Promise<{ entities: TradeEntity[]; total: number }>;
  create(trade: TradeEntity): Promise<void>;
  createWithClient?(client: PoolClient, trade: TradeEntity): Promise<void>;
  save(trade: TradeEntity): Promise<void>;
  saveWithClient?(client: PoolClient, trade: TradeEntity): Promise<void>;
  countActiveUsage(tradeId: string): Promise<number>;
}

export const TRADE_REPOSITORY = Symbol('TRADE_REPOSITORY');
