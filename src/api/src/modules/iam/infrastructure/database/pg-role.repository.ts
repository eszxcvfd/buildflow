import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { RoleEntity } from '../../domain/entity/role.entity';
import { RoleRepositoryPort } from '../../domain/repository/role-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

function mapRowToEntity(row: Record<string, unknown>): RoleEntity {
  return new RoleEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    description: (row['description'] as string | null) ?? null,
    isSystem: Boolean(row['is_system']),
    isActive: Boolean(row['is_active']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

@Injectable()
export class PgRoleRepository implements RoleRepositoryPort {
  private pool(): Pool {
    return getPool();
  }

  async findById(id: string): Promise<RoleEntity | null> {
    const result = await this.pool().query(
      `SELECT id, code, name, description, is_system, is_active, created_at, updated_at
       FROM public.roles WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRowToEntity(result.rows[0]);
  }

  async findByIds(ids: string[]): Promise<RoleEntity[]> {
    if (ids.length === 0) return [];
    const result = await this.pool().query(
      `SELECT id, code, name, description, is_system, is_active, created_at, updated_at
       FROM public.roles WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return result.rows.map((r: Record<string, unknown>) => mapRowToEntity(r));
  }

  async findAllActive(): Promise<RoleEntity[]> {
    const result = await this.pool().query(
      `SELECT id, code, name, description, is_system, is_active, created_at, updated_at
       FROM public.roles WHERE is_active = true ORDER BY code ASC`,
    );
    return result.rows.map((r: Record<string, unknown>) => mapRowToEntity(r));
  }

  async findActiveRoleIdsByUserId(userId: string): Promise<string[]> {
    const result = await this.pool().query(
      `SELECT role_id FROM public.user_roles
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    return result.rows.map((r: Record<string, unknown>) => String(r['role_id']));
  }

  async findActiveRoleIdsByUserIdWithClient(client: PoolClient, userId: string): Promise<string[]> {
    const result = await client.query(
      `SELECT role_id FROM public.user_roles
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    return result.rows.map((r: Record<string, unknown>) => String(r['role_id']));
  }

  async findActiveRolesByUserId(userId: string): Promise<Array<{ id: string; code: string; name: string }>> {
    const result = await this.pool().query(
      `SELECT r.id, r.code, r.name
       FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND ur.is_active = true AND r.is_active = true
       ORDER BY r.code ASC`,
      [userId],
    );
    return result.rows.map((r: Record<string, unknown>) => ({
      id: String(r['id']),
      code: String(r['code']),
      name: String(r['name']),
    }));
  }

  async replaceUserRolesWithClient(
    client: PoolClient,
    params: { userId: string; roleIds: string[]; actorUserId: string; now: Date },
  ): Promise<void> {
    // Deactivate existing active assignments (soft revoke)
    await client.query(
      `UPDATE public.user_roles
       SET is_active = false, revoked_by = $2, revoked_at = $3
       WHERE user_id = $1 AND is_active = true`,
      [params.userId, params.actorUserId, params.now],
    );

    // Insert new active assignments
    for (const roleId of params.roleIds) {
      // Double-submit safety: a concurrent identical assignment may have committed between our
      // deactivate and insert (partial unique index ux_user_roles_active). Upsert semantics keep
      // the row idempotent instead of failing the whole tx with a 23505 -> 500.
      await client.query(
        `INSERT INTO public.user_roles (id, user_id, role_id, assigned_by, assigned_at, is_active)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true)
         ON CONFLICT (user_id, role_id) WHERE is_active
         DO UPDATE SET is_active = true, assigned_by = EXCLUDED.assigned_by, assigned_at = EXCLUDED.assigned_at, revoked_by = NULL, revoked_at = NULL`,
        [params.userId, roleId, params.actorUserId, params.now],
      );
    }
  }
}
