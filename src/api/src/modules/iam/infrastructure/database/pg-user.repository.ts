import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  // Reuse singleton pool via global
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({
    connectionString: config.databaseUrl,
    // minimal pool
    max: 5,
  });
  return g.__pgPool;
}

function mapRowToEntity(row: Record<string, unknown>): UserEntity {
  return new UserEntity({
    id: String(row['id']),
    email: String(row['email']),
    passwordHash: String(row['password_hash']),
    fullName: String(row['full_name']),
    phone: (row['phone'] as string | null) ?? null,
    avatarUrl: (row['avatar_url'] as string | null) ?? null,
    employeeCode: (row['employee_code'] as string | null) ?? null,
    userType: (row['user_type'] as 'STAFF' | 'WORKER') ?? 'STAFF',
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
export class PgUserRepository implements UserRepositoryPort {
  private pool(): Pool {
    return getPool();
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const lower = email.toLowerCase();
    const result = await this.pool().query(
      `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code,
              user_type, contractor_id, status, failed_login_count, locked_until,
              last_login_at, created_at, updated_at
       FROM public.users
       WHERE lower(email) = $1
       LIMIT 1`,
      [lower],
    );
    if (result.rows.length === 0) return null;
    return mapRowToEntity(result.rows[0]);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const result = await this.pool().query(
      `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code,
              user_type, contractor_id, status, failed_login_count, locked_until,
              last_login_at, created_at, updated_at
       FROM public.users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRowToEntity(result.rows[0]);
  }

  async save(user: UserEntity): Promise<void> {
    const p = user.getProps();
    await this.pool().query(
      `UPDATE public.users
       SET status = $1,
           failed_login_count = $2,
           locked_until = $3,
           last_login_at = $4,
           updated_at = $5
       WHERE id = $6`,
      [p.status, p.failedLoginCount, p.lockedUntil ?? null, p.lastLoginAt ?? null, p.updatedAt, p.id],
    );
  }

  async findActiveRolesByUserId(userId: string): Promise<Array<{ id: string; code: string; name: string }>> {
    const result = await this.pool().query(
      `SELECT r.id, r.code, r.name
       FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND ur.is_active = true AND r.is_active = true`,
      [userId],
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row['id']),
      code: String(row['code']),
      name: String(row['name']),
    }));
  }

  async findActiveProjectIdsByUserId(userId: string): Promise<string[]> {
    const result = await this.pool().query(
      `SELECT project_id FROM public.project_members
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    return result.rows.map((row: Record<string, unknown>) => String(row['project_id']));
  }
}
