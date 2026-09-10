import { PgWorkOrderRepository } from './pg-work-order.repository';

// JOB-SRS-006 (issue #46) — spec PG adapter filter predicates + 2 method mới
// bằng pool mock inject qua `globalThis.__pgPool` (mirror
// `pg-work-order-job-board.repository.spec.ts` — không chạm Postgres thật).
// Assert: 5 predicate AND-compose vào WHERE (KHÔNG post-filter), COUNT trên
// cùng WHERE, scope giữ vị trí đầu, sort giữ `updated_at DESC, id DESC`.

const G = globalThis as unknown as { __pgPool?: unknown };

function setupPool(count: string, rows: Record<string, unknown>[] = []): jest.Mock {
  const query: jest.Mock = jest.fn(async (text: string) => {
    if (text.includes('COUNT(*)')) return { rows: [{ count }] };
    if (text.includes('resource_trades')) return { rows: [] };
    if (text.includes('DISTINCT')) return { rows: [] };
    return { rows };
  });
  G.__pgPool = { query };
  return query;
}

const NOW = new Date('2026-11-01T08:00:00.000Z');
const P1 = '22222222-2222-4222-8222-222222222222';
const AREA = '55555555-5555-4555-8555-555555555555';
const WT = '44444444-4444-4444-8444-444444444444';
const TRADE = '66666666-6666-4666-8666-666666666666';

describe('PgWorkOrderRepository.searchJobBoard filters (JOB-SRS-006 #46)', () => {
  afterEach(() => {
    delete G.__pgPool;
  });

  function texts(query: jest.Mock): [string, string] {
    const calls = query.mock.calls.map((c) => String(c[0]));
    return [calls[0], calls[1]];
  }

  it('absent filter = hành vi #45 nguyên vẹn (không predicate mới)', async () => {
    const query = setupPool('0');
    const repo = new PgWorkOrderRepository();
    await repo.searchJobBoard({ limit: 20, offset: 0, now: NOW });
    const [countSql, pageSql] = texts(query);
    for (const sql of [countSql, pageSql]) {
      expect(sql).not.toContain('area_id = ANY');
      expect(sql).not.toContain('work_type_id = ANY');
      expect(sql).not.toContain('required_trade_id = ANY');
      expect(sql).not.toContain('w.planned_start_at IS NOT NULL');
      expect(sql).not.toContain('COALESCE(w.planned_end_at');
    }
    expect(pageSql).toContain('ORDER BY w.updated_at DESC, w.id DESC');
  });

  it('projectId + areaIds + workTypeIds + skill AND-compose sau scope', async () => {
    const query = setupPool('0');
    const repo = new PgWorkOrderRepository();
    await repo.searchJobBoard({
      projectIds: [P1],
      projectId: P1,
      areaIds: [AREA],
      workTypeIds: [WT],
      requiredTradeIds: [TRADE],
      limit: 20,
      offset: 0,
      now: NOW,
    });
    const [countSql, pageSql] = texts(query);
    for (const sql of [countSql, pageSql]) {
      expect(sql).toContain('w.project_id = $');
      expect(sql).toContain('::uuid');
      expect(sql).not.toContain('w.project_id = ANY');
      expect(sql).toContain('w.area_id = ANY');
      expect(sql).toContain('w.work_type_id = ANY');
      expect(sql).toContain('w.required_trade_id = ANY');
    }
    // COUNT và page dùng CÙNG where (total trên filtered set)
    const whereOf = (sql: string): string => sql.split('WHERE')[1].split('ORDER BY')[0].trim();
    expect(whereOf(pageSql)).toBe(countSql.split('WHERE')[1].trim());
  });

  it('dateFrom+dateTo → overlap instant + NOT NULL guard', async () => {
    const query = setupPool('0');
    const repo = new PgWorkOrderRepository();
    await repo.searchJobBoard({
      plannedFrom: new Date('2026-10-01T00:00:00.000Z'),
      plannedTo: new Date('2026-10-31T00:00:00.000Z'),
      limit: 20,
      offset: 0,
      now: NOW,
    });
    const [countSql] = texts(query);
    expect(countSql).toContain('w.planned_start_at IS NOT NULL');
    expect(countSql).toContain('w.planned_start_at <=');
    expect(countSql).toContain('COALESCE(w.planned_end_at, w.planned_start_at) >=');
  });

  it('chỉ dateFrom → 1 biên + NOT NULL; chỉ dateTo → 1 biên + NOT NULL', async () => {
    const repo = new PgWorkOrderRepository();
    const q1 = setupPool('0');
    await repo.searchJobBoard({
      plannedFrom: new Date('2026-10-01T00:00:00.000Z'),
      limit: 20,
      offset: 0,
      now: NOW,
    });
    const [fromSql] = q1.mock.calls.map((c) => String(c[0]));
    expect(fromSql).toContain('COALESCE(w.planned_end_at, w.planned_start_at) >=');
    expect(fromSql).not.toContain('w.planned_start_at <=');
    delete G.__pgPool;
    const q2 = setupPool('0');
    await repo.searchJobBoard({
      plannedTo: new Date('2026-10-31T00:00:00.000Z'),
      limit: 20,
      offset: 0,
      now: NOW,
    });
    const [toSql] = q2.mock.calls.map((c) => String(c[0]));
    expect(toSql).toContain('w.planned_start_at <=');
    expect(toSql).not.toContain('COALESCE(w.planned_end_at, w.planned_start_at) >=');
  });

  it('findActiveTradeIdsByUserId → đúng điều kiện mirror org :43', async () => {
    const query: jest.Mock = jest.fn(async () => ({ rows: [{ trade_id: TRADE }] }));
    G.__pgPool = { query };
    const repo = new PgWorkOrderRepository();
    const ids = await repo.findActiveTradeIdsByUserId!('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(ids).toEqual([TRADE]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('public.resource_trades');
    expect(sql).toContain(`resource_type = 'USER'`);
    expect(sql).toContain('is_active = true');
    expect(query.mock.calls[0][1]).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });

  it('findJobBoardFilterOptions → 4 DISTINCT trên cùng availability+scope WHERE', async () => {
    const query: jest.Mock = jest.fn(async (text: string) => {
      if (text.includes('SELECT DISTINCT w.project_id')) return { rows: [{ id: P1 }] };
      return { rows: [] };
    });
    G.__pgPool = { query };
    const repo = new PgWorkOrderRepository();
    const out = await repo.findJobBoardFilterOptions!({ projectIds: [P1], now: NOW });
    expect(query).toHaveBeenCalledTimes(4);
    for (const call of query.mock.calls) {
      const sql = String(call[0]);
      expect(sql).toContain('DISTINCT');
      expect(sql).toContain(`w.status = 'OPEN'`);
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('w.project_id = ANY');
    }
    expect(out.projectIds).toEqual([P1]);
    expect(out.areaIds).toEqual([]);
  });
});
