import { PoolClient } from 'pg';

export const TRANSACTION_PORT = Symbol('TRANSACTION_PORT');

export interface TransactionPort {
  withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
}
