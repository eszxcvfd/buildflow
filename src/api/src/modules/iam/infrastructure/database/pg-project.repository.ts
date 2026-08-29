import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

function mapRow(row: Record<string, unknown>): ProjectEntity {
  return new ProjectEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    status: row['status'] as ProjectEntity['status'],
    managerId: String(row['manager_id']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

@Injectable()
export class PgProjectRepository implements ProjectRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<ProjectEntity | null> {
    const result = await this.pool().query(
      `SELECT id, code, name, status, manager_id, created_at, updated_at
       FROM public.projects WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
  }

  async findByIds(ids: string[]): Promise<ProjectEntity[]> {
    if (ids.length === 0) return [];
    const result = await this.pool().query(
      `SELECT id, code, name, status, manager_id, created_at, updated_at
       FROM public.projects WHERE id = ANY($1::uuid[]) ORDER BY created_at DESC`,
      [ids],
    );
    return result.rows.map((r: Record<string, unknown>) => mapRow(r));
  }

  async findAll(params?: { limit?: number; offset?: number }): Promise<ProjectEntity[]> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);
    const result = await this.pool().query(
      `SELECT id, code, name, status, manager_id, created_at, updated_at
       FROM public.projects ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows.map((r: Record<string, unknown>) => mapRow(r));
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.pool().query(
      `SELECT 1 FROM public.projects WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows.length > 0;
  }
}
