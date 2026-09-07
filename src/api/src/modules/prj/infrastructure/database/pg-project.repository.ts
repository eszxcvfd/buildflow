import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { ProjectEntity } from '../../domain/entity/project.entity';
import {
  ProjectProfile,
  ProjectRepositoryPort,
  ProjectAreaRow,
  ProjectAreaFilter,
  ProjectAreaRepositoryPort,
  ProjectMemberRow,
  ProjectMemberFilter,
  ProjectMemberRole,
} from '../../domain/repository/project-repository.port';
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
export class PgProjectRepository implements ProjectRepositoryPort, ProjectAreaRepositoryPort {
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

  async findProfileById(id: string): Promise<ProjectProfile | null> {
    const r = await this.pool().query(
      `SELECT ${PROJECT_COLUMNS},
        (SELECT full_name FROM public.users WHERE id = p.manager_id LIMIT 1) AS manager_name
       FROM public.projects p WHERE p.id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0] as Record<string, unknown>;
    return {
      entity: mapRow(row),
      managerName: row['manager_name'] !== null && row['manager_name'] !== undefined
        ? String(row['manager_name'])
        : null,
    };
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
        planned_start_date=$5, planned_end_date=$6, manager_id=$7, status=$8, updated_at=$9 WHERE id=$10`,
      [
        p.name, p.description ?? null, p.address, p.timezone,
        p.plannedStartDate, p.plannedEndDate, p.managerId, p.status, p.updatedAt, p.id,
      ],
    );
  }

  /* ---------------------------------------------------------------- */
  /* PRJ-SRS-005 (issue #36) — adapter thành viên dự án.                 */
  /* `project_members` không có cột `created_at` riêng → `createdAt`    */
  /* map từ `joined_at`. `joined_at`/`left_at` là timestamptz            */
  /* (khác `effective_from`/`effective_to` date-only của crews #30).    */
  /* ---------------------------------------------------------------- */

  private mapMemberRow(row: Record<string, unknown>): ProjectMemberRow {
    const joinedAt = new Date(String(row['joined_at']));
    return {
      id: String(row['id']),
      projectId: String(row['project_id']),
      userId: String(row['user_id']),
      projectRole: row['project_role'] as ProjectMemberRole,
      joinedAt,
      leftAt:
        row['left_at'] === null || row['left_at'] === undefined
          ? null
          : new Date(String(row['left_at'])),
      isActive: Boolean(row['is_active']),
      addedBy: String(row['added_by']),
      createdAt: joinedAt,
      userName: (row['user_name'] as string | null) ?? null,
      userCode: (row['user_code'] as string | null) ?? null,
    };
  }

  private memberSelect(): string {
    return `m.id, m.project_id, m.user_id, m.project_role, m.joined_at, m.left_at,
      m.is_active, m.added_by, u.full_name AS user_name, u.employee_code AS user_code
      FROM public.project_members m LEFT JOIN public.users u ON u.id = m.user_id`;
  }

  async listMembers(filter: ProjectMemberFilter): Promise<ProjectMemberRow[]> {
    return this.listMembersOn((text, values) => this.pool().query(text, values), filter);
  }

  async listMembersWithClient(
    client: PoolClient,
    filter: ProjectMemberFilter,
  ): Promise<ProjectMemberRow[]> {
    return this.listMembersOn((text, values) => client.query(text, values), filter);
  }

  private async listMembersOn(
    query: (text: string, values: unknown[]) => Promise<{ rows: unknown[] }>,
    filter: ProjectMemberFilter,
  ): Promise<ProjectMemberRow[]> {
    // M1: default active-only; `includeInactive=true` → toàn bộ lịch sử,
    // cả hai sắp `joined_at` DESC.
    if (filter.includeInactive) {
      const r = await query(
        `SELECT ${this.memberSelect()} WHERE m.project_id = $1 ORDER BY m.joined_at DESC`,
        [filter.projectId],
      );
      return (r.rows as Record<string, unknown>[]).map((row) => this.mapMemberRow(row));
    }
    const r = await query(
      `SELECT ${this.memberSelect()} WHERE m.project_id = $1 AND m.is_active ORDER BY m.joined_at DESC`,
      [filter.projectId],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => this.mapMemberRow(row));
  }

  async findMemberByIdWithClient(client: PoolClient, memberId: string): Promise<ProjectMemberRow | null> {
    const r = await client.query(`SELECT ${this.memberSelect()} WHERE m.id = $1 LIMIT 1`, [memberId]);
    if (r.rows.length === 0) return null;
    return this.mapMemberRow(r.rows[0] as Record<string, unknown>);
  }

  async findActiveMemberWithClient(
    client: PoolClient,
    projectId: string,
    userId: string,
  ): Promise<ProjectMemberRow | null> {
    const r = await client.query(
      `SELECT ${this.memberSelect()} WHERE m.project_id = $1 AND m.user_id = $2 AND m.is_active LIMIT 1`,
      [projectId, userId],
    );
    if (r.rows.length === 0) return null;
    return this.mapMemberRow(r.rows[0] as Record<string, unknown>);
  }

  async insertMemberWithClient(
    client: PoolClient,
    input: { projectId: string; userId: string; projectRole: string; addedBy: string },
  ): Promise<ProjectMemberRow> {
    // Trùng active cùng project → 23505 `ux_project_members_active` → use case map 409.
    const r = await client.query(
      `INSERT INTO public.project_members (id, project_id, user_id, project_role, is_active, added_by)
       VALUES (gen_random_uuid(), $1, $2, $3, true, $4)
       RETURNING id, project_id, user_id, project_role, joined_at, left_at, is_active, added_by`,
      [input.projectId, input.userId, input.projectRole, input.addedBy],
    );
    const row = this.mapMemberRow(r.rows[0] as Record<string, unknown>);
    const u = await client.query(`SELECT full_name, employee_code FROM public.users WHERE id = $1`, [
      input.userId,
    ]);
    if (u.rows.length > 0) {
      row.userName = (u.rows[0]['full_name'] as string | null) ?? null;
      row.userCode = (u.rows[0]['employee_code'] as string | null) ?? null;
    }
    return row;
  }

  async deactivateMemberWithClient(client: PoolClient, memberId: string): Promise<ProjectMemberRow | null> {
    // M2 soft-deactivate: row KHÔNG bao giờ bị xóa. `left_at=CURRENT_TIMESTAMP`
    // (thỏa `revocation_ck`; `CURRENT_DATE` nửa đêm vi phạm
    // `membership_dates_ck` khi remove cùng ngày join — xem §12 M2).
    const r = await client.query(
      `UPDATE public.project_members SET is_active = false, left_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, project_id, user_id, project_role, joined_at, left_at, is_active, added_by`,
      [memberId],
    );
    if (r.rows.length === 0) return null;
    const row = this.mapMemberRow(r.rows[0] as Record<string, unknown>);
    const u = await client.query(`SELECT full_name, employee_code FROM public.users WHERE id = $1`, [
      row.userId,
    ]);
    if (u.rows.length > 0) {
      row.userName = (u.rows[0]['full_name'] as string | null) ?? null;
      row.userCode = (u.rows[0]['employee_code'] as string | null) ?? null;
    }
    return row;
  }

  /* ---------------------------------------------------------------- */
  /* PRJ-SRS-003 (issue #34) — adapter khu vực dự án (một cấp).          */
  /* `description`/`display_order` baseline giữ default, slice này      */
  /* không đọc/ghi (không expose qua API). Không có DELETE/hard-delete. */
  /* ---------------------------------------------------------------- */

  private mapAreaRow(row: Record<string, unknown>): ProjectAreaRow {
    return {
      id: String(row['id']),
      projectId: String(row['project_id']),
      code: (row['code'] as string | null) ?? null,
      name: String(row['name']),
      isActive: Boolean(row['is_active']),
      createdAt: row['created_at'] instanceof Date ? row['created_at'] as Date : new Date(String(row['created_at'])),
      updatedAt: row['updated_at'] instanceof Date ? row['updated_at'] as Date : new Date(String(row['updated_at'])),
    };
  }

  private areaColumns(): string {
    return `id, project_id, code, name, is_active, created_at, updated_at`;
  }

  async listAreas(filter: ProjectAreaFilter): Promise<ProjectAreaRow[]> {
    // Default kèm inactive (flag qua isActive); `?activeOnly=true` cho
    // future Work Order picker. Sắp tên ASC để picker ổn định.
    const r = filter.activeOnly
      ? await this.pool().query(
          `SELECT ${this.areaColumns()} FROM public.project_areas
           WHERE project_id = $1 AND is_active ORDER BY name ASC`,
          [filter.projectId],
        )
      : await this.pool().query(
          `SELECT ${this.areaColumns()} FROM public.project_areas
           WHERE project_id = $1 ORDER BY is_active DESC, name ASC`,
          [filter.projectId],
        );
    return (r.rows as Record<string, unknown>[]).map((row) => this.mapAreaRow(row));
  }

  async findAreaById(areaId: string): Promise<ProjectAreaRow | null> {
    const r = await this.pool().query(
      `SELECT ${this.areaColumns()} FROM public.project_areas WHERE id = $1 LIMIT 1`,
      [areaId],
    );
    if (r.rows.length === 0) return null;
    return this.mapAreaRow(r.rows[0] as Record<string, unknown>);
  }

  async findAreaForUpdateWithClient(client: PoolClient, areaId: string): Promise<ProjectAreaRow | null> {
    const r = await client.query(
      `SELECT ${this.areaColumns()} FROM public.project_areas WHERE id = $1 FOR UPDATE LIMIT 1`,
      [areaId],
    );
    if (r.rows.length === 0) return null;
    return this.mapAreaRow(r.rows[0] as Record<string, unknown>);
  }

  async findActiveAreaByNameWithClient(
    client: PoolClient,
    projectId: string,
    name: string,
  ): Promise<ProjectAreaRow | null> {
    // Case-insensitive (mirror DB expression index `ux_project_areas_active_name_ci` — 0006).
    const r = await client.query(
      `SELECT ${this.areaColumns()} FROM public.project_areas
       WHERE project_id = $1 AND is_active AND lower(name) = lower($2) LIMIT 1`,
      [projectId, name],
    );
    if (r.rows.length === 0) return null;
    return this.mapAreaRow(r.rows[0] as Record<string, unknown>);
  }

  async findAreaByCodeWithClient(
    client: PoolClient,
    projectId: string,
    code: string,
  ): Promise<ProjectAreaRow | null> {
    const r = await client.query(
      `SELECT ${this.areaColumns()} FROM public.project_areas
       WHERE project_id = $1 AND code = $2 LIMIT 1`,
      [projectId, code],
    );
    if (r.rows.length === 0) return null;
    return this.mapAreaRow(r.rows[0] as Record<string, unknown>);
  }

  async insertAreaWithClient(
    client: PoolClient,
    input: { projectId: string; code: string | null; name: string },
  ): Promise<ProjectAreaRow> {
    // Trùng tên active → 23505 `ux_project_areas_active_name_ci` (0006,
    // expression index case-insensitive);
    // trùng mã → 23505 `ux_project_areas_project_code` → use case map 409.
    const r = await client.query(
      `INSERT INTO public.project_areas (id, project_id, code, name, is_active)
       VALUES (gen_random_uuid(), $1, $2, $3, true)
       RETURNING ${this.areaColumns()}`,
      [input.projectId, input.code, input.name],
    );
    return this.mapAreaRow(r.rows[0] as Record<string, unknown>);
  }

  async saveAreaWithClient(
    client: PoolClient,
    input: { id: string; code: string | null; name: string; isActive: boolean },
  ): Promise<ProjectAreaRow | null> {
    // Rename tại chỗ (giữ `area_id` history) + toggle active, cùng statement.
    const r = await client.query(
      `UPDATE public.project_areas
       SET code = $2, name = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${this.areaColumns()}`,
      [input.id, input.code, input.name, input.isActive],
    );
    if (r.rows.length === 0) return null;
    return this.mapAreaRow(r.rows[0] as Record<string, unknown>);
  }

  async isActiveProjectMember(projectId: string, userId: string): Promise<boolean> {
    const r = await this.pool().query(
      `SELECT 1 FROM public.project_members
       WHERE project_id = $1 AND user_id = $2 AND is_active LIMIT 1`,
      [projectId, userId],
    );
    return r.rows.length > 0;
  }
}
