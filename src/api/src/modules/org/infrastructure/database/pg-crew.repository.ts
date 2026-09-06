import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CrewEntity } from '../../domain/entity/crew.entity';
import { CrewFilter, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

const CREW_COLUMNS = `c.id, c.code, c.name, c.description, c.contractor_id, c.status, c.created_by, c.created_at, c.updated_at`;

/**
 * ORG-SRS-006 (issue #29) — active LEAD attach qua LEFT JOIN (partial unique
 * `ux_crew_one_active_lead` bảo đảm tối đa 1 row nên join không nhân bản).
 */
const CREW_WITH_LEAD = `SELECT ${CREW_COLUMNS}, lead.user_id AS lead_user_id FROM public.crews c
  LEFT JOIN public.crew_members lead ON lead.crew_id = c.id AND lead.is_active AND lead.member_role = 'LEAD'`;

function mapRow(row: Record<string, unknown>): CrewEntity {
  return new CrewEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    description: (row['description'] as string | null) ?? null,
    contractorId: (row['contractor_id'] as string | null) ?? null,
    status: row['status'] as 'ACTIVE' | 'INACTIVE',
    leaderUserId: (row['lead_user_id'] as string | null) ?? null,
    createdBy: String(row['created_by']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

@Injectable()
export class PgCrewRepository implements CrewRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<CrewEntity | null> {
    const r = await this.pool().query(`${CREW_WITH_LEAD} WHERE c.id = $1 LIMIT 1`, [id]);
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0] as Record<string, unknown>);
  }

  async findByCode(code: string): Promise<CrewEntity | null> {
    const r = await this.pool().query(
      `${CREW_WITH_LEAD} WHERE lower(c.code) = lower($1) LIMIT 1`,
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0] as Record<string, unknown>);
  }

  async findMany(filter: CrewFilter): Promise<{ entities: CrewEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`c.status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(lower(c.code) LIKE $${idx} OR lower(c.name) LIKE $${idx} OR lower(c.description) LIKE $${idx})`);
      values.push(term);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.crews c ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    // Sort whitelist mapping (no client string interpolation): name → name,
    // createdAt → created_at; default createdAt/desc. Invalid values rejected
    // at controller/use-case with 400; fallback là defense-in-depth.
    const sortColumn = filter.sort === 'name' ? 'c.name' : 'c.created_at';
    const sortDirection = filter.order === 'asc' ? 'ASC' : 'DESC';

    const dataR = await this.pool().query(
      `${CREW_WITH_LEAD} ${where} ORDER BY ${sortColumn} ${sortDirection} LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    const entities = dataR.rows.map((r: Record<string, unknown>) => mapRow(r));
    return { entities, total };
  }

  private async createOnExecutor(executor: Pool | PoolClient, crew: CrewEntity): Promise<void> {
    const p = crew.getProps();
    await executor.query(
      `INSERT INTO public.crews (id, code, name, description, contractor_id, status, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, p.code, p.name, p.description ?? null, p.contractorId ?? null, p.status, p.createdBy, p.createdAt, p.updatedAt],
    );
  }

  async create(crew: CrewEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), crew);
  }

  async createWithClient(client: PoolClient, crew: CrewEntity): Promise<void> {
    await this.createOnExecutor(client, crew);
  }

  private async saveOnExecutor(executor: Pool | PoolClient, crew: CrewEntity): Promise<void> {
    const p = crew.getProps();
    await executor.query(
      `UPDATE public.crews SET name=$1, description=$2, contractor_id=$3, status=$4, updated_at=$5 WHERE id=$6`,
      [p.name, p.description ?? null, p.contractorId ?? null, p.status, p.updatedAt, p.id],
    );
  }

  async save(crew: CrewEntity): Promise<void> {
    await this.saveOnExecutor(this.pool(), crew);
  }

  async saveWithClient(client: PoolClient, crew: CrewEntity): Promise<void> {
    await this.saveOnExecutor(client, crew);
  }

  async insertLeadWithClient(client: PoolClient, input: { crewId: string; userId: string; addedBy: string }): Promise<void> {
    // effective_from=CURRENT_DATE (date), is_active default true, effective_to null.
    // Race hai LEAD đồng thời → ux_crew_one_active_lead (23505) → use case map 409.
    await client.query(
      `INSERT INTO public.crew_members (id, crew_id, user_id, member_role, effective_from, effective_to, is_active, added_by)
       VALUES (gen_random_uuid(), $1, $2, 'LEAD', CURRENT_DATE, NULL, true, $3)`,
      [input.crewId, input.userId, input.addedBy],
    );
  }

  async deactivateActiveLeadWithClient(client: PoolClient, crewId: string): Promise<void> {
    // Soft-deactivate: is_active=false + effective_to=CURRENT_DATE — thỏa
    // revocation_ck (is_active OR effective_to NOT NULL) và giữ lịch sử.
    await client.query(
      `UPDATE public.crew_members SET is_active = false, effective_to = CURRENT_DATE
       WHERE crew_id = $1 AND is_active AND member_role = 'LEAD'`,
      [crewId],
    );
  }

  async countOpenAssignments(crewId: string): Promise<number> {
    const r = await this.pool().query(
      `SELECT COUNT(*)::int AS total FROM public.assignments
       WHERE crew_id = $1 AND status IN ('PENDING_ACCEPTANCE', 'ACTIVE')`,
      [crewId],
    );
    return Number(r.rows[0].total ?? 0);
  }
}
