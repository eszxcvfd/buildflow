import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { TradeEntity } from '../../domain/entity/trade.entity';
import { TradeFilter, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
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

const TRADE_COLUMNS =
  'id, code, name, description, is_active, created_at, updated_at';

@Injectable()
export class PgTradeRepository implements TradeRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<TradeEntity | null> {
    const r = await this.pool().query(`SELECT ${TRADE_COLUMNS} FROM public.trades WHERE id = $1 LIMIT 1`, [id]);
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByIds(ids: string[]): Promise<TradeEntity[]> {
    if (ids.length === 0) return [];
    const r = await this.pool().query(`SELECT ${TRADE_COLUMNS} FROM public.trades WHERE id = ANY($1::uuid[])`, [ids]);
    return r.rows.map((row: Record<string, unknown>) => mapRow(row));
  }

  async findAllActive(): Promise<TradeEntity[]> {
    const r = await this.pool().query(`SELECT ${TRADE_COLUMNS} FROM public.trades WHERE is_active = true ORDER BY name ASC`);
    return r.rows.map((row: Record<string, unknown>) => mapRow(row));
  }

  async findByCode(code: string): Promise<TradeEntity | null> {
    const r = await this.pool().query(
      `SELECT ${TRADE_COLUMNS} FROM public.trades WHERE lower(code) = lower($1) LIMIT 1`,
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async search(filter: TradeFilter): Promise<{ entities: TradeEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status && filter.status !== 'ALL') {
      conditions.push(`is_active = $${idx++}`);
      values.push(filter.status === 'ACTIVE');
    }
    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(lower(code) ILIKE $${idx} OR lower(name) ILIKE $${idx})`);
      values.push(term);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.trades ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const dataR = await this.pool().query(
      `SELECT ${TRADE_COLUMNS} FROM public.trades ${where} ORDER BY name ASC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    return { entities: dataR.rows.map((row: Record<string, unknown>) => mapRow(row)), total };
  }

  private async createOnExecutor(executor: Pool | PoolClient, trade: TradeEntity): Promise<void> {
    const p = trade.getProps();
    await executor.query(
      `INSERT INTO public.trades (id, code, name, description, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.id, p.code, p.name, p.description ?? null, p.isActive, p.createdAt, p.updatedAt],
    );
  }

  async create(trade: TradeEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), trade);
  }

  async createWithClient(client: PoolClient, trade: TradeEntity): Promise<void> {
    await this.createOnExecutor(client, trade);
  }

  private async saveOnExecutor(executor: Pool | PoolClient, trade: TradeEntity): Promise<void> {
    const p = trade.getProps();
    await executor.query(
      `UPDATE public.trades SET code=$1, name=$2, description=$3, is_active=$4, updated_at=$5 WHERE id=$6`,
      [p.code, p.name, p.description ?? null, p.isActive, p.updatedAt, p.id],
    );
  }

  async save(trade: TradeEntity): Promise<void> {
    await this.saveOnExecutor(this.pool(), trade);
  }

  async saveWithClient(client: PoolClient, trade: TradeEntity): Promise<void> {
    await this.saveOnExecutor(client, trade);
  }

  async countActiveUsage(tradeId: string): Promise<number> {
    // Count active/effective references to a trade across all FK consumers:
    // resource_trades.trade_id (active assignment), work_types.required_trade_id (active type),
    // work_orders.required_trade_id (non-CANCELLED/CLOSED order). Union avoids double counting
    // when the same trade is referenced by several rows.
    const sql = `
      SELECT COUNT(*)::int AS total FROM (
        SELECT 1 FROM public.resource_trades WHERE trade_id = $1 AND is_active = true
        UNION
        SELECT 1 FROM public.work_types WHERE required_trade_id = $1 AND is_active = true
        UNION
        SELECT 1 FROM public.work_orders WHERE required_trade_id = $1 AND status NOT IN ('CANCELLED', 'CLOSED')
      ) u`;
    const r = await this.pool().query(sql, [tradeId]);
    return Number(r.rows[0].total ?? 0);
  }
}