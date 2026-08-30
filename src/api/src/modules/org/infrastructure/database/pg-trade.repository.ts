import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { TradeEntity } from '../../domain/entity/trade.entity';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

function mapRow(row: Record<string, unknown>): TradeEntity {
  return new TradeEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    description: (row['description'] as string | null) ?? null,
    isActive: Boolean(row['is_active']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

@Injectable()
export class PgTradeRepository implements TradeRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<TradeEntity | null> {
    const r = await this.pool().query(`SELECT id, code, name, description, is_active, created_at, updated_at FROM public.trades WHERE id = $1 LIMIT 1`, [id]);
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByIds(ids: string[]): Promise<TradeEntity[]> {
    if (ids.length === 0) return [];
    const r = await this.pool().query(`SELECT id, code, name, description, is_active, created_at, updated_at FROM public.trades WHERE id = ANY($1::uuid[])`, [ids]);
    return r.rows.map((row: Record<string, unknown>) => mapRow(row));
  }

  async findAllActive(): Promise<TradeEntity[]> {
    const r = await this.pool().query(`SELECT id, code, name, description, is_active, created_at, updated_at FROM public.trades WHERE is_active = true ORDER BY name ASC`);
    return r.rows.map((row: Record<string, unknown>) => mapRow(row));
  }
}
