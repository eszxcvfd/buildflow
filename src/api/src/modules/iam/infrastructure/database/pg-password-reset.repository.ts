import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { loadConfig } from '../../../../config/configuration';
import { PasswordResetRepositoryPort, PasswordResetTokenRecord } from '../../domain/repository/password-reset.repository.port';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

@Injectable()
export class PgPasswordResetRepository implements PasswordResetRepositoryPort {
  private pool(): Pool | PoolClient {
    return getPool();
  }

  async create(record: { userId: string; tokenHash: string; expiresAt: Date }, client?: PoolClient): Promise<PasswordResetTokenRecord> {
    const executor = client ?? this.pool();
    const result = await executor.query(
      `INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, token_hash, expires_at, used_at, created_at`,
      [record.userId, record.tokenHash, record.expiresAt],
    );
    return this.mapRow(result.rows[0]);
  }

  async findLatestUsableByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const result = await this.pool().query(
      `SELECT id, user_id, token_hash, expires_at, used_at, created_at
       FROM public.password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async markUsed(id: string, usedAt: Date, client?: PoolClient): Promise<void> {
    const executor = client ?? this.pool();
    await executor.query(
      `UPDATE public.password_reset_tokens SET used_at = $2 WHERE id = $1 AND used_at IS NULL`,
      [id, usedAt],
    );
  }

  async invalidateAllForUser(userId: string, now: Date, client?: PoolClient): Promise<number> {
    const executor = client ?? this.pool();
    const result = await executor.query(
      `UPDATE public.password_reset_tokens SET used_at = $2
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > $2`,
      [userId, now],
    );
    return result.rowCount ?? 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.pool().query(
      `DELETE FROM public.password_reset_tokens WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: Record<string, unknown>): PasswordResetTokenRecord {
    return {
      id: String(row['id']),
      userId: String(row['user_id']),
      tokenHash: String(row['token_hash']),
      // pg returns Date objects — preserve full precision
      expiresAt: row['expires_at'] instanceof Date ? row['expires_at'] : new Date(String(row['expires_at'])),
      usedAt: row['used_at'] ? (row['used_at'] instanceof Date ? row['used_at'] : new Date(String(row['used_at']))) : null,
      createdAt: row['created_at'] instanceof Date ? row['created_at'] : new Date(String(row['created_at'])),
    };
  }
}
