import { ConflictException, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { loadConfig } from '../../../../config/configuration';

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as Record<string, unknown>;
  if (err['code'] === '23505') return true;
  const constraint = String(err['constraint'] ?? '');
  if (/ux_users/i.test(constraint)) return true;
  const msg = String((err['message'] as string) ?? '');
  if (/duplicate key|unique constraint|23505/i.test(msg)) return true;
  return false;
}

function toConflictFromUnique(e: unknown): ConflictException {
  const err = e as Record<string, unknown>;
  const constraint = String(err['constraint'] ?? '');
  const detail = String((err['detail'] as string) ?? '');
  if (/ux_users_email_lower/i.test(constraint)) return new ConflictException('Email đã tồn tại');
  if (/ux_users_phone/i.test(constraint)) return new ConflictException('Số điện thoại đã tồn tại');
  if (/ux_users_employee_code/i.test(constraint)) return new ConflictException('Mã nhân viên đã tồn tại');
  if (/employee_code/i.test(detail)) return new ConflictException('Mã nhân viên đã tồn tại');
  if (/phone/i.test(detail)) return new ConflictException('Số điện thoại đã tồn tại');
  return new ConflictException('Email đã tồn tại');
}

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

  async findByEmployeeCode(employeeCode: string): Promise<UserEntity | null> {
    const result = await this.pool().query(
      `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code,
              user_type, contractor_id, status, failed_login_count, locked_until,
              last_login_at, created_at, updated_at
       FROM public.users
       WHERE employee_code = $1
       LIMIT 1`,
      [employeeCode],
    );
    if (result.rows.length === 0) return null;
    return mapRowToEntity(result.rows[0]);
  }

  private async createOnExecutor(executor: Pool | PoolClient, user: UserEntity): Promise<void> {
    const p = user.getProps();
    try {
      await executor.query(
        `INSERT INTO public.users
       (id, email, password_hash, full_name, phone, avatar_url, employee_code,
        user_type, contractor_id, status, failed_login_count, locked_until,
        last_login_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          p.id,
          p.email,
          p.passwordHash,
          p.fullName,
          p.phone ?? null,
          p.avatarUrl ?? null,
          p.employeeCode ?? null,
          p.userType,
          p.contractorId ?? null,
          p.status,
          p.failedLoginCount,
          p.lockedUntil ?? null,
          p.lastLoginAt ?? null,
          p.createdAt,
          p.updatedAt,
        ],
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw toConflictFromUnique(e);
      throw e;
    }
  }

  async create(user: UserEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), user);
  }

  async createWithClient(client: PoolClient, user: UserEntity): Promise<void> {
    await this.createOnExecutor(client, user);
  }

  async findAll(params?: { status?: string; limit?: number; offset?: number }): Promise<UserEntity[]> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);
    let query = `SELECT id, email, password_hash, full_name, phone, avatar_url, employee_code,
              user_type, contractor_id, status, failed_login_count, locked_until,
              last_login_at, created_at, updated_at
       FROM public.users`;
    const values: unknown[] = [];
    const conditions: string[] = [];
    if (params?.status) {
      conditions.push(`status = $${values.length + 1}`);
      values.push(params.status);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);
    const result = await this.pool().query(query, values);
    return result.rows.map((r: Record<string, unknown>) => mapRowToEntity(r));
  }

  private async saveOnExecutor(executor: Pool | PoolClient, user: UserEntity): Promise<void> {
    const p = user.getProps();
    try {
      await executor.query(
        `UPDATE public.users
       SET email = $1,
           full_name = $2,
           phone = $3,
           avatar_url = $4,
           employee_code = $5,
           user_type = $6,
           contractor_id = $7,
           status = $8,
           failed_login_count = $9,
           locked_until = $10,
           last_login_at = $11,
           updated_at = $12
       WHERE id = $13`,
        [
          p.email,
          p.fullName,
          p.phone ?? null,
          p.avatarUrl ?? null,
          p.employeeCode ?? null,
          p.userType,
          p.contractorId ?? null,
          p.status,
          p.failedLoginCount,
          p.lockedUntil ?? null,
          p.lastLoginAt ?? null,
          p.updatedAt,
          p.id,
        ],
      );
    } catch (e) {
      if (isUniqueViolation(e)) throw toConflictFromUnique(e);
      throw e;
    }
  }

  async save(user: UserEntity): Promise<void> {
    await this.saveOnExecutor(this.pool(), user);
  }

  async saveWithClient(client: PoolClient, user: UserEntity): Promise<void> {
    await this.saveOnExecutor(client, user);
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
