import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { TransactionPort } from '../../application/port/transaction.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

@Injectable()
export class PgTransactionManager implements TransactionPort {
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw e;
    } finally {
      client.release();
    }
  }
}
