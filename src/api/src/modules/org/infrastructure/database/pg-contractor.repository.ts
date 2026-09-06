import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { ContractorEntity } from '../../domain/entity/contractor.entity';
import { ContractorFilter, ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

function mapRow(row: Record<string, unknown>): ContractorEntity {
  return new ContractorEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    contactName: (row['contact_name'] as string | null) ?? null,
    phone: (row['phone'] as string | null) ?? null,
    email: (row['email'] as string | null) ?? null,
    status: row['status'] as 'ACTIVE' | 'INACTIVE',
    scope: (row['note'] as string | null) ?? null,
    createdBy: String(row['created_by']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

@Injectable()
export class PgContractorRepository implements ContractorRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<ContractorEntity | null> {
    const r = await this.pool().query(
      `SELECT id, code, name, contact_name, phone, email, status, note, created_by, created_at, updated_at FROM public.contractors WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0] as Record<string, unknown>);
  }

  async findByCode(code: string): Promise<ContractorEntity | null> {
    const r = await this.pool().query(
      `SELECT id, code, name, contact_name, phone, email, status, note, created_by, created_at, updated_at FROM public.contractors WHERE lower(code) = lower($1) LIMIT 1`,
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0] as Record<string, unknown>);
  }

  async findMany(filter: ContractorFilter): Promise<{ entities: ContractorEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(lower(code) LIKE $${idx} OR lower(name) LIKE $${idx} OR lower(contact_name) LIKE $${idx} OR lower(email) LIKE $${idx} OR lower(note) LIKE $${idx})`);
      values.push(term);
      idx++;
    }
    if (filter.scope) {
      const scopeTerm = `%${filter.scope.trim().toLowerCase()}%`;
      conditions.push(`lower(note) LIKE $${idx++}`);
      values.push(scopeTerm);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.contractors ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    // ORG-SRS-005 (issue #28) — sort whitelist mapping (no client string
    // interpolation): name → name, createdAt → created_at; default
    // createdAt/desc. Invalid values are rejected at controller/use-case with
    // 400; the fallback below is defense-in-depth only.
    const sortColumn = filter.sort === 'name' ? 'name' : 'created_at';
    const sortDirection = filter.order === 'asc' ? 'ASC' : 'DESC';

    const dataR = await this.pool().query(
      `SELECT id, code, name, contact_name, phone, email, status, note, created_by, created_at, updated_at
       FROM public.contractors ${where} ORDER BY ${sortColumn} ${sortDirection} LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    const entities = dataR.rows.map((r: Record<string, unknown>) => mapRow(r));
    return { entities, total };
  }

  async findActiveForAssignment(filter?: { search?: string; scope?: string; limit?: number; offset?: number }): Promise<{ entities: ContractorEntity[]; total: number }> {
    return this.findMany({ ...filter, status: 'ACTIVE' });
  }

  private async createOnExecutor(executor: Pool | PoolClient, contractor: ContractorEntity): Promise<void> {
    const p = contractor.getProps();
    await executor.query(
      `INSERT INTO public.contractors (id, code, name, contact_name, phone, email, status, note, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.code, p.name, p.contactName ?? null, p.phone ?? null, p.email ?? null, p.status, p.scope ?? null, p.createdBy, p.createdAt, p.updatedAt],
    );
  }

  async create(contractor: ContractorEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), contractor);
  }

  async createWithClient(client: PoolClient, contractor: ContractorEntity): Promise<void> {
    await this.createOnExecutor(client, contractor);
  }

  private async saveOnExecutor(executor: Pool | PoolClient, contractor: ContractorEntity): Promise<void> {
    const p = contractor.getProps();
    await executor.query(
      `UPDATE public.contractors SET code=$1, name=$2, contact_name=$3, phone=$4, email=$5, status=$6, note=$7, updated_at=$8 WHERE id=$9`,
      [p.code, p.name, p.contactName ?? null, p.phone ?? null, p.email ?? null, p.status, p.scope ?? null, p.updatedAt, p.id],
    );
  }

  async save(contractor: ContractorEntity): Promise<void> {
    await this.saveOnExecutor(this.pool(), contractor);
  }

  async saveWithClient(client: PoolClient, contractor: ContractorEntity): Promise<void> {
    await this.saveOnExecutor(client, contractor);
  }

  async hasHistory(contractorId: string): Promise<boolean> {
    // Check if contractor is referenced by users, crews, or other history
    const r1 = await this.pool().query(`SELECT 1 FROM public.users WHERE contractor_id = $1 LIMIT 1`, [contractorId]);
    if (r1.rows.length > 0) return true;
    const r2 = await this.pool().query(`SELECT 1 FROM public.crews WHERE contractor_id = $1 LIMIT 1`, [contractorId]);
    if (r2.rows.length > 0) return true;
    return false;
  }

  async countOpenAssignments(contractorId: string): Promise<number> {
    // ORG-SRS-004 (issue #27): assignments đang mở của nhà thầu = assignments của
    // crews thuộc contractor (crews.contractor_id) UNION assignments của workers
    // thuộc contractor (users.contractor_id). UNION xử lý trường hợp cùng assignment
    // thuộc cả crew lẫn worker trong nhà thầu — không double-count.
    const r = await this.pool().query(
      `SELECT COUNT(*)::int AS total FROM (
         SELECT a.id FROM public.assignments a
         JOIN public.crews c ON c.id = a.crew_id
         WHERE c.contractor_id = $1 AND a.status IN ('PENDING_ACCEPTANCE', 'ACTIVE')
         UNION
         SELECT a.id FROM public.assignments a
         JOIN public.users u ON u.id = a.worker_id
         WHERE u.contractor_id = $1 AND a.status IN ('PENDING_ACCEPTANCE', 'ACTIVE')
       ) open_assignments`,
      [contractorId],
    );
    return Number(r.rows[0].total ?? 0);
  }
}
