import { PoolClient } from 'pg';
import { WorkerEntity } from '../entity/worker.entity';

export interface WorkerFilter {
  status?: string;
  userType?: string; // always WORKER for this repo, but keep for reuse
  search?: string; // search fullName, email, employeeCode
  tradeId?: string;
  skillLevel?: number;
  limit?: number;
  offset?: number;
}

export interface WorkerRepositoryPort {
  findById(id: string): Promise<WorkerEntity | null>;
  findByEmployeeCode(code: string): Promise<WorkerEntity | null>;
  findMany(filter: WorkerFilter): Promise<{ entities: WorkerEntity[]; total: number }>;
  create(worker: WorkerEntity): Promise<void>;
  createWithClient?(client: PoolClient, worker: WorkerEntity): Promise<void>;
  save(worker: WorkerEntity): Promise<void>;
  saveWithClient?(client: PoolClient, worker: WorkerEntity): Promise<void>;
  // Trades handling via resource_trades table
  assignTradesWithClient?(client: PoolClient, params: { userId: string; trades: Array<{ tradeId: string; skillLevel: number }>; now: Date }): Promise<void>;
  findActiveTradesByUserId(userId: string): Promise<Array<{ tradeId: string; skillLevel: number }>>;
}

export const WORKER_REPOSITORY = Symbol('WORKER_REPOSITORY');
