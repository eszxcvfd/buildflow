import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectProfile, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

const PROJECT_COLUMNS = `p.id, p.code, p.name, p.description, p.address, p.timezone,
  p.planned_start_date, p.planned_end_date, p.actual_end_date,
  p.manager_id, p.status, p.created_by, p.created_at, p.updated_at`;

/** `DATE` từ pg về dạng JS Date (nửa đêm UTC) → chuẩn hóa `YYYY-MM-DD`. */
function toDateOnly(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  return d.toISOString().slice(0, 10);
}

function mapRow(row: Record<string, unknown>): ProjectEntity {
  return new ProjectEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    description: (row['description'] as string | null) ?? null,
    address: String(row['address']),
    timezone: String(row['timezone'] ?? 'Asia/Ho_Chi_Minh'),
    plannedStartDate: toDateOnly(row['planned_start_date']),
    plannedEndDate: toDateOnly(row['planned_end_date']),
    managerId: String(row['manager_id']),
    status: row['status'] as ProjectEntity['status'],
    createdBy: String(row['created_by']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

/**
 * PRJ-SRS-001 (issue #32) — pg adapter cho write slice dự án.
 * Full-row mapping (đọc/ghi mọi cột nghiệp vụ); `managerName` join từ
 * `users.full_name` phục vụ ProjectProfileDto. Không migration mới.
 */
@Injectable()
export class PgProjectRepository implements ProjectRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<ProjectEntity | null> {
    const r = await this.pool().query(
      `SELECT ${PROJECT_COLUMNS} FROM public.projects p WHERE p.id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0] as Record<string, unknown>);
  }

  async findByCode(code: string): Promise<ProjectEntity | null> {
    const r = await this.pool().query(
      `SELECT ${PROJECT_COLUMNS} FROM public.projects p WHERE lower(p.code) = lower($1) LIMIT 1`,
      [String(code).trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0] as Record<string, unknown>);
  }

  async findForUpdateWithClient(client: PoolClient, id: string): Promise<ProjectProfile | null> {
    const r = await client.query(
      `SELECT ${PROJECT_COLUMNS} FROM public.projects p WHERE p.id = $1 FOR UPDATE LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    const entity = mapRow(r.rows[0] as Record<string, unknown>);
    const u = await client.query(`SELECT full_name FROM public.users WHERE id = $1 LIMIT 1`, [entity.managerId]);
    return {
      entity,
      managerName: u.rows.length > 0 ? (String(u.rows[0]['full_name']) as string) : null,
    };
  }

  async findManagerNameWithClient(client: PoolClient, userId: string): Promise<string | null> {
    const r = await client.query(`SELECT full_name FROM public.users WHERE id = $1 LIMIT 1`, [userId]);
    if (r.rows.length === 0) return null;
    return String(r.rows[0]['full_name']);
  }

  async createWithClient(client: PoolClient, entity: ProjectEntity): Promise<void> {
    const p = entity.getProps();
    await client.query(
      `INSERT INTO public.projects
        (id, code, name, description, address, timezone, planned_start_date, planned_end_date,
         manager_id, status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        p.id, p.code, p.name, p.description ?? null, p.address, p.timezone,
        p.plannedStartDate, p.plannedEndDate, p.managerId, p.status,
        p.createdBy, p.createdAt, p.updatedAt,
      ],
    );
  }

  async insertManagerMembershipWithClient(
    client: PoolClient,
    args: { projectId: string; userId: string; addedBy: string },
  ): Promise<void> {
    await client.query(
      `INSERT INTO public.project_members (project_id, user_id, project_role, is_active, added_by)
       VALUES ($1, $2, 'MANAGER', true, $3)`,
      [args.projectId, args.userId, args.addedBy],
    );
  }

  async saveWithClient(client: PoolClient, entity: ProjectEntity): Promise<void> {
    const p = entity.getProps();
    await client.query(
      `UPDATE public.projects SET name=$1, description=$2, address=$3, timezone=$4,
        planned_start_date=$5, planned_end_date=$6, manager_id=$7, updated_at=$8 WHERE id=$9`,
      [
        p.name, p.description ?? null, p.address, p.timezone,
        p.plannedStartDate, p.plannedEndDate, p.managerId, p.updatedAt, p.id,
      ],
    );
  }
}
