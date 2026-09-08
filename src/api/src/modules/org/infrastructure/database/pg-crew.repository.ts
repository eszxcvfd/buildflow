import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { CrewEntity } from '../../domain/entity/crew.entity';
import { CrewFilter, CrewListEnrichment, CrewMemberFilter, CrewMemberRow, CrewRepositoryPort, WorkerCrewMembership } from '../../domain/repository/crew-repository.port';
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

  async findActiveMembershipsByUserId(
    userId: string,
  ): Promise<Array<{ crewId: string; crewCode: string; crewName: string; memberRole: 'LEAD' | 'MEMBER'; effectiveFrom: string; effectiveTo: string | null }>> {
    // ORG-SRS-008 (issue #31) — pool read thuần SELECT (không tx): memberships
    // hiệu lực của user trên mọi đội, effective_from DESC.
    const r = await this.pool().query(
      `SELECT m.crew_id AS crew_id, c.code AS crew_code, c.name AS crew_name,
        m.member_role AS member_role, m.effective_from AS effective_from, m.effective_to AS effective_to
       FROM public.crew_members m JOIN public.crews c ON c.id = m.crew_id
       WHERE m.user_id = $1 AND m.is_active ORDER BY m.effective_from DESC`,
      [userId],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => ({
      crewId: String(row['crew_id']),
      crewCode: String(row['crew_code']),
      crewName: String(row['crew_name']),
      memberRole: row['member_role'] as 'LEAD' | 'MEMBER',
      effectiveFrom: toDateOnly(row['effective_from']),
      effectiveTo: row['effective_to'] === null || row['effective_to'] === undefined
        ? null
        : toDateOnly(row['effective_to']),
    }));
  }

  async findMembershipsByUser(userId: string): Promise<WorkerCrewMembership[]> {
    // ORG-03/ORG-05 (Worker ↔ Crew link) — mirror findActiveMembershipsByUserId
    // nhưng kèm crew status (join crews). Chỉ active (is_active); lịch sử cũ
    // (is_active=false) KHÔNG trả. Pool read, không transaction.
    const r = await this.pool().query(
      `SELECT m.crew_id AS crew_id, c.code AS crew_code, c.name AS crew_name, c.status AS crew_status,
        m.member_role AS member_role, m.effective_from AS effective_from, m.effective_to AS effective_to
       FROM public.crew_members m JOIN public.crews c ON c.id = m.crew_id
       WHERE m.user_id = $1 AND m.is_active ORDER BY m.effective_from DESC`,
      [userId],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => ({
      crewId: String(row['crew_id']),
      crewCode: String(row['crew_code']),
      crewName: String(row['crew_name']),
      crewStatus: row['crew_status'] as 'ACTIVE' | 'INACTIVE',
      memberRole: row['member_role'] as 'LEAD' | 'MEMBER',
      effectiveFrom: toDateOnly(row['effective_from']),
      effectiveTo: row['effective_to'] === null || row['effective_to'] === undefined
        ? null
        : toDateOnly(row['effective_to']),
    }));
  }

  async findMembershipsByUserIds(userIds: string[]): Promise<Array<WorkerCrewMembership & { userId: string }>> {
    // ORG-05 — batch cho worker list enrichment: MỘT query cho mọi user
    // (`= ANY($1::uuid[])`), tránh N+1. userIds rỗng → [] (không query).
    if (userIds.length === 0) return [];
    const r = await this.pool().query(
      `SELECT m.user_id AS user_id, m.crew_id AS crew_id, c.code AS crew_code, c.name AS crew_name,
        c.status AS crew_status, m.member_role AS member_role,
        m.effective_from AS effective_from, m.effective_to AS effective_to
       FROM public.crew_members m JOIN public.crews c ON c.id = m.crew_id
       WHERE m.user_id = ANY($1::uuid[]) AND m.is_active ORDER BY m.effective_from DESC`,
      [userIds],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => ({
      userId: String(row['user_id']),
      crewId: String(row['crew_id']),
      crewCode: String(row['crew_code']),
      crewName: String(row['crew_name']),
      crewStatus: row['crew_status'] as 'ACTIVE' | 'INACTIVE',
      memberRole: row['member_role'] as 'LEAD' | 'MEMBER',
      effectiveFrom: toDateOnly(row['effective_from']),
      effectiveTo: row['effective_to'] === null || row['effective_to'] === undefined
        ? null
        : toDateOnly(row['effective_to']),
    }));
  }

  async findListEnrichments(crewIds: string[]): Promise<Map<string, CrewListEnrichment>> {
    // ORG-05 — batch cho crews list enrichment: MỘT query cho mọi đội —
    // leaderName join users qua LEAD active (partial unique
    // `ux_crew_one_active_lead` bảo đảm tối đa 1 row) + COUNT crew_members
    // active (mọi role). Tránh N+1.
    const enrichments = new Map<string, CrewListEnrichment>();
    if (crewIds.length === 0) return enrichments;
    const r = await this.pool().query(
      `SELECT c.id AS crew_id, lu.full_name AS leader_name,
        (SELECT COUNT(*)::int FROM public.crew_members mc WHERE mc.crew_id = c.id AND mc.is_active) AS member_count
       FROM public.crews c
       LEFT JOIN public.crew_members lead ON lead.crew_id = c.id AND lead.is_active AND lead.member_role = 'LEAD'
       LEFT JOIN public.users lu ON lu.id = lead.user_id
       WHERE c.id = ANY($1::uuid[])`,
      [crewIds],
    );
    for (const row of r.rows as Record<string, unknown>[]) {
      enrichments.set(String(row['crew_id']), {
        leaderName: (row['leader_name'] as string | null) ?? null,
        memberCount: Number(row['member_count'] ?? 0),
      });
    }
    return enrichments;
  }

  async findActiveTradesByCrewId(crewId: string): Promise<Array<{ tradeId: string; skillLevel: number }>> {
    // ORG-SRS-008 (issue #31) — trades hiệu lực của đội (resource_type='CREW').
    const r = await this.pool().query(
      `SELECT trade_id, skill_level FROM public.resource_trades
       WHERE resource_type = 'CREW' AND crew_id = $1 AND is_active = true`,
      [crewId],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => ({
      tradeId: String(row['trade_id']),
      skillLevel: Number(row['skill_level']),
    }));
  }

  /**
   * ORG-SRS-007 (issue #30) — map một row crew_members (+ join users rẻ:
   * full_name/employee_code). Date-only cột trả về dưới dạng string
   * `YYYY-MM-DD` (pg parse date thành Date UTC midnight → slice).
   */
  private mapMemberRow(row: Record<string, unknown>): CrewMemberRow {
    return {
      id: String(row['id']),
      crewId: String(row['crew_id']),
      userId: String(row['user_id']),
      memberRole: row['member_role'] as 'LEAD' | 'MEMBER',
      effectiveFrom: toDateOnly(row['effective_from']),
      effectiveTo: row['effective_to'] === null || row['effective_to'] === undefined
        ? null
        : toDateOnly(row['effective_to']),
      isActive: Boolean(row['is_active']),
      addedBy: String(row['added_by']),
      createdAt: new Date(String(row['created_at'])),
      userName: (row['user_name'] as string | null) ?? null,
      userCode: (row['user_code'] as string | null) ?? null,
    };
  }

  private memberSelect(): string {
    return `m.id, m.crew_id, m.user_id, m.member_role, m.effective_from, m.effective_to,
      m.is_active, m.added_by, m.created_at, u.full_name AS user_name, u.employee_code AS user_code
      FROM public.crew_members m LEFT JOIN public.users u ON u.id = m.user_id`;
  }

  async listMembers(filter: CrewMemberFilter): Promise<CrewMemberRow[]> {
    return this.listMembersOn((text, values) => this.pool().query(text, values), filter);
  }

  async listMembersWithClient(client: PoolClient, filter: CrewMemberFilter): Promise<CrewMemberRow[]> {
    return this.listMembersOn((text, values) => client.query(text, values), filter);
  }

  private async listMembersOn(
    query: (text: string, values: unknown[]) => Promise<{ rows: unknown[] }>,
    filter: CrewMemberFilter,
  ): Promise<CrewMemberRow[]> {
    if (filter.at) {
      // Point-in-time (D6): [effective_from, effective_to] INCLUSIVE hai đầu
      // (effective_to = at vẫn tính), NULL = open-ended — bất kể is_active.
      const r = await query(
        `SELECT ${this.memberSelect()} WHERE m.crew_id = $1
         AND m.effective_from <= $2::date AND (m.effective_to IS NULL OR m.effective_to >= $2::date)
         ORDER BY m.effective_from DESC`,
        [filter.crewId, filter.at],
      );
      return (r.rows as Record<string, unknown>[]).map((row) => this.mapMemberRow(row));
    }
    if (filter.includeInactive) {
      const r = await query(
        `SELECT ${this.memberSelect()} WHERE m.crew_id = $1 ORDER BY m.effective_from DESC`,
        [filter.crewId],
      );
      return (r.rows as Record<string, unknown>[]).map((row) => this.mapMemberRow(row));
    }
    const r = await query(
      `SELECT ${this.memberSelect()} WHERE m.crew_id = $1 AND m.is_active ORDER BY m.effective_from DESC`,
      [filter.crewId],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => this.mapMemberRow(row));
  }

  async findMemberByIdWithClient(client: PoolClient, memberId: string): Promise<CrewMemberRow | null> {
    const r = await client.query(`SELECT ${this.memberSelect()} WHERE m.id = $1 LIMIT 1`, [memberId]);
    if (r.rows.length === 0) return null;
    return this.mapMemberRow(r.rows[0] as Record<string, unknown>);
  }

  async findActiveMemberWithClient(client: PoolClient, crewId: string, userId: string): Promise<CrewMemberRow | null> {
    const r = await client.query(
      `SELECT ${this.memberSelect()} WHERE m.crew_id = $1 AND m.user_id = $2 AND m.is_active LIMIT 1`,
      [crewId, userId],
    );
    if (r.rows.length === 0) return null;
    return this.mapMemberRow(r.rows[0] as Record<string, unknown>);
  }

  async findActiveMembershipsOfUserWithClient(
    client: PoolClient,
    userId: string,
    excludeCrewId: string,
  ): Promise<Array<{ crewId: string; crewCode: string; crewName: string }>> {
    const r = await client.query(
      `SELECT m.crew_id AS crew_id, c.code AS crew_code, c.name AS crew_name
       FROM public.crew_members m JOIN public.crews c ON c.id = m.crew_id
       WHERE m.user_id = $1 AND m.is_active AND m.crew_id <> $2`,
      [userId, excludeCrewId],
    );
    return (r.rows as Record<string, unknown>[]).map((row) => ({
      crewId: String(row['crew_id']),
      crewCode: String(row['crew_code']),
      crewName: String(row['crew_name']),
    }));
  }

  async insertMemberWithClient(
    client: PoolClient,
    input: { crewId: string; userId: string; effectiveFrom: string; addedBy: string },
  ): Promise<CrewMemberRow> {
    // member_role luôn 'MEMBER' (D1); LEAD chỉ qua leader-swap.
    // Trùng active trong cùng đội → ux_crew_member_active (23505) → use case map 409.
    const r = await client.query(
      `INSERT INTO public.crew_members (id, crew_id, user_id, member_role, effective_from, effective_to, is_active, added_by)
       VALUES (gen_random_uuid(), $1, $2, 'MEMBER', $3::date, NULL, true, $4)
       RETURNING id, crew_id, user_id, member_role, effective_from, effective_to, is_active, added_by, created_at`,
      [input.crewId, input.userId, input.effectiveFrom, input.addedBy],
    );
    const row = this.mapMemberRow(r.rows[0] as Record<string, unknown>);
    const u = await client.query(`SELECT full_name, employee_code FROM public.users WHERE id = $1`, [input.userId]);
    if (u.rows.length > 0) {
      row.userName = (u.rows[0].full_name as string | null) ?? null;
      row.userCode = (u.rows[0].employee_code as string | null) ?? null;
    }
    return row;
  }

  async deactivateMemberWithClient(
    client: PoolClient,
    memberId: string,
    effectiveTo: string,
  ): Promise<CrewMemberRow | null> {
    // Soft-deactivate (D2): row KHÔNG bao giờ bị xóa — giữ lịch sử.
    const r = await client.query(
      `UPDATE public.crew_members SET is_active = false, effective_to = $2::date
       WHERE id = $1 RETURNING id, crew_id, user_id, member_role, effective_from, effective_to, is_active, added_by, created_at`,
      [memberId, effectiveTo],
    );
    if (r.rows.length === 0) return null;
    const row = this.mapMemberRow(r.rows[0] as Record<string, unknown>);
    const u = await client.query(`SELECT full_name, employee_code FROM public.users WHERE id = $1`, [row.userId]);
    if (u.rows.length > 0) {
      row.userName = (u.rows[0].full_name as string | null) ?? null;
      row.userCode = (u.rows[0].employee_code as string | null) ?? null;
    }
    return row;
  }

  async findCrewForUpdateWithClient(
    client: PoolClient,
    crewId: string,
  ): Promise<{ id: string; code: string; name: string; status: string } | null> {
    const r = await client.query(
      `SELECT id, code, name, status FROM public.crews WHERE id = $1 FOR UPDATE`,
      [crewId],
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0] as Record<string, unknown>;
    return { id: String(row['id']), code: String(row['code']), name: String(row['name']), status: String(row['status']) };
  }

  async findCrewByIdWithClient(
    client: PoolClient,
    crewId: string,
  ): Promise<{ id: string; code: string; name: string; status: string } | null> {
    // Fix F5: SELECT thường trong tx (không FOR UPDATE) cho audit read.
    const r = await client.query(
      `SELECT id, code, name, status FROM public.crews WHERE id = $1 LIMIT 1`,
      [crewId],
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0] as Record<string, unknown>;
    return { id: String(row['id']), code: String(row['code']), name: String(row['name']), status: String(row['status']) };
  }
}

/**
 * Chuẩn hóa cột date của pg về `YYYY-MM-DD`. pg trả date thành Date
 * (UTC midnight) hoặc string tùy driver config — xử lý cả hai.
 */
function toDateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
