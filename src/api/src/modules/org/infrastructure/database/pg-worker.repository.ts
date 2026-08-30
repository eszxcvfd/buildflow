import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { WorkerEntity } from '../../domain/entity/worker.entity';
import { WorkerFilter, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { UserEntity } from '../../../iam/domain/entity/user.entity';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

function mapUserRow(row: Record<string, unknown>): UserEntity {
  return new UserEntity({
    id: String(row['id']),
    email: String(row['email']),
    passwordHash: String(row['password_hash']),
    fullName: String(row['full_name']),
    phone: (row['phone'] as string | null) ?? null,
    avatarUrl: (row['avatar_url'] as string | null) ?? null,
    employeeCode: (row['employee_code'] as string | null) ?? null,
    userType: (row['user_type'] as 'STAFF' | 'WORKER') ?? 'WORKER',
    contractorId: (row['contractor_id'] as string | null) ?? null,
    status: row['status'] as 'ACTIVE' | 'INACTIVE' | 'LOCKED',
    failedLoginCount: Number(row['failed_login_count'] ?? 0),
    lockedUntil: row['locked_until'] ? new Date(String(row['locked_until'])) : null,
    lastLoginAt: row['last_login_at'] ? new Date(String(row['last_login_at'])) : null,
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

@Injectable()
export class PgWorkerRepository implements WorkerRepositoryPort {
  private pool(): Pool { return getPool(); }

  private async loadTradesForUsers(userIds: string[], executor: Pool | PoolClient): Promise<Map<string, Array<{ tradeId: string; skillLevel: number }>>> {
    if (userIds.length === 0) return new Map();
    const r = await executor.query(
      `SELECT user_id, trade_id, skill_level FROM public.resource_trades WHERE resource_type = 'USER' AND user_id = ANY($1::uuid[]) AND is_active = true`,
      [userIds],
    );
    const map = new Map<string, Array<{ tradeId: string; skillLevel: number }>>();
    for (const row of r.rows as Record<string, unknown>[]) {
      const uid = String(row['user_id']);
      if (!map.has(uid)) map.set(uid, []);
      map.get(uid)!.push({ tradeId: String(row['trade_id']), skillLevel: Number(row['skill_level']) });
    }
    return map;
  }

  async findById(id: string): Promise<WorkerEntity | null> {
    const r = await this.pool().query(
      `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code, user_type, contractor_id, status, failed_login_count, locked_until, last_login_at, created_at, updated_at FROM public.users WHERE id = $1 AND user_type = 'WORKER' LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    const user = mapUserRow(r.rows[0]);
    const tradesMap = await this.loadTradesForUsers([id], this.pool());
    const trades = (tradesMap.get(id) ?? []).map((t) => ({
      tradeId: t.tradeId,
      skillLevel: t.skillLevel as 1|2|3|4|5,
      effectiveFrom: new Date(),
      effectiveTo: null,
      isActive: true,
    }));
    return new WorkerEntity({ user, trades });
  }

  async findByEmployeeCode(code: string): Promise<WorkerEntity | null> {
    const r = await this.pool().query(
      `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code, user_type, contractor_id, status, failed_login_count, locked_until, last_login_at, created_at, updated_at FROM public.users WHERE employee_code = $1 AND user_type = 'WORKER' LIMIT 1`,
      [code],
    );
    if (r.rows.length === 0) return null;
    const user = mapUserRow(r.rows[0]);
    const tradesMap = await this.loadTradesForUsers([user.id], this.pool());
    const trades = (tradesMap.get(user.id) ?? []).map((t) => ({
      tradeId: t.tradeId,
      skillLevel: t.skillLevel as 1|2|3|4|5,
      effectiveFrom: new Date(),
      effectiveTo: null,
      isActive: true,
    }));
    return new WorkerEntity({ user, trades });
  }

  async findMany(filter: WorkerFilter): Promise<{ entities: WorkerEntity[]; total: number }> {
    const conditions: string[] = [`user_type = 'WORKER'`];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(lower(full_name) LIKE $${idx} OR lower(email) LIKE $${idx} OR lower(employee_code) LIKE $${idx})`);
      values.push(term);
      idx++;
    }
    if (filter.tradeId) {
      conditions.push(`EXISTS (SELECT 1 FROM public.resource_trades rt WHERE rt.resource_type='USER' AND rt.user_id = users.id AND rt.trade_id = $${idx++} AND rt.is_active = true)`);
      values.push(filter.tradeId);
      if (filter.skillLevel !== undefined) {
        conditions.push(`EXISTS (SELECT 1 FROM public.resource_trades rt2 WHERE rt2.resource_type='USER' AND rt2.user_id = users.id AND rt2.trade_id = $${idx - 1} AND rt2.skill_level = $${idx++} AND rt2.is_active = true)`);
        values.push(filter.skillLevel);
      }
    } else if (filter.skillLevel !== undefined) {
      conditions.push(`EXISTS (SELECT 1 FROM public.resource_trades rt WHERE rt.resource_type='USER' AND rt.user_id = users.id AND rt.skill_level = $${idx++} AND rt.is_active = true)`);
      values.push(filter.skillLevel);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.users users ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const dataR = await this.pool().query(
      `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code, user_type, contractor_id, status, failed_login_count, locked_until, last_login_at, created_at, updated_at
       FROM public.users users ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    const users = dataR.rows.map((r: Record<string, unknown>) => mapUserRow(r));
    const tradesMap = await this.loadTradesForUsers(users.map((u) => u.id), this.pool());

    const entities = users.map((u) => {
      const trades = (tradesMap.get(u.id) ?? []).map((t) => ({
        tradeId: t.tradeId,
        skillLevel: t.skillLevel as 1|2|3|4|5,
        effectiveFrom: new Date(),
        effectiveTo: null,
        isActive: true,
      }));
      return new WorkerEntity({ user: u, trades });
    });

    return { entities, total };
  }

  private async createOnExecutor(executor: Pool | PoolClient, worker: WorkerEntity): Promise<void> {
    const p = worker.user.getProps();
    await executor.query(
      `INSERT INTO public.users (id, email, password_hash, full_name, phone, avatar_url, employee_code, user_type, contractor_id, status, failed_login_count, locked_until, last_login_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [p.id, p.email, p.passwordHash, p.fullName, p.phone ?? null, p.avatarUrl ?? null, p.employeeCode ?? null, p.userType, p.contractorId ?? null, p.status, p.failedLoginCount, p.lockedUntil ?? null, p.lastLoginAt ?? null, p.createdAt, p.updatedAt],
    );
    // Trades inserted via assignTradesWithClient if needed outside; but for create we handle inline if trades exist
    if (worker.trades.length > 0) {
      for (const t of worker.trades) {
        await executor.query(
          `INSERT INTO public.resource_trades (id, resource_type, user_id, trade_id, skill_level, effective_from, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), 'USER', $1, $2, $3, CURRENT_DATE, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [p.id, t.tradeId, t.skillLevel],
        );
      }
    }
  }

  async create(worker: WorkerEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), worker);
  }

  async createWithClient(client: PoolClient, worker: WorkerEntity): Promise<void> {
    await this.createOnExecutor(client, worker);
  }

  private async saveOnExecutor(executor: Pool | PoolClient, worker: WorkerEntity): Promise<void> {
    const p = worker.user.getProps();
    await executor.query(
      `UPDATE public.users SET email=$1, full_name=$2, phone=$3, avatar_url=$4, employee_code=$5, user_type=$6, contractor_id=$7, status=$8, failed_login_count=$9, locked_until=$10, last_login_at=$11, updated_at=$12 WHERE id=$13`,
      [p.email, p.fullName, p.phone ?? null, p.avatarUrl ?? null, p.employeeCode ?? null, p.userType, p.contractorId ?? null, p.status, p.failedLoginCount, p.lockedUntil ?? null, p.lastLoginAt ?? null, p.updatedAt, p.id],
    );
    // Trades update is handled separately via assignTradesWithClient
  }

  async save(worker: WorkerEntity): Promise<void> {
    await this.saveOnExecutor(this.pool(), worker);
  }

  async saveWithClient(client: PoolClient, worker: WorkerEntity): Promise<void> {
    await this.saveOnExecutor(client, worker);
  }

  async assignTradesWithClient(client: PoolClient, params: { userId: string; trades: Array<{ tradeId: string; skillLevel: number }>; now: Date }): Promise<void> {
    // Deactivate existing active trades
    await client.query(`UPDATE public.resource_trades SET is_active = false, updated_at = $2 WHERE resource_type='USER' AND user_id=$1 AND is_active=true`, [params.userId, params.now]);
    for (const t of params.trades) {
      await client.query(
        `INSERT INTO public.resource_trades (id, resource_type, user_id, trade_id, skill_level, effective_from, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), 'USER', $1, $2, $3, CURRENT_DATE, true, $4, $4)`,
        [params.userId, t.tradeId, t.skillLevel, params.now],
      );
    }
  }

  async findActiveTradesByUserId(userId: string): Promise<Array<{ tradeId: string; skillLevel: number }>> {
    const r = await this.pool().query(`SELECT trade_id, skill_level FROM public.resource_trades WHERE resource_type='USER' AND user_id=$1 AND is_active=true`, [userId]);
    return r.rows.map((row: Record<string, unknown>) => ({ tradeId: String(row['trade_id']), skillLevel: Number(row['skill_level']) }));
  }
}
