import { PgWorkOrderRepository } from './pg-work-order.repository';

// JOB-SRS-005 (issue #45) — spec PG adapter `searchJobBoard`/`findAreaRefs`/
// `findTradeRefs` bằng pool mock inject qua `globalThis.__pgPool`
// (`getPool()` ưu tiên global — không chạm Postgres thật).
// Assert: predicate SQL đầy đủ từng nhánh BD5 (status/board/window/NOT EXISTS/
// scope), COUNT + page cùng WHERE, ORDER tiebreak, clamp limit/offset,
// mapping row → entity. KHÔNG phải real-DB proof — real-DB thuộc evidence
// driver (T11, stage sau, ngoài scope task này).

const G = globalThis as unknown as { __pgPool?: unknown };

function workOrderRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'WO-2026-A1',
    project_id: '22222222-2222-4222-8222-222222222222',
    area_id: null,
    work_type_id: '44444444-4444-4444-8444-444444444444',
    required_trade_id: null,
    title: 'Do be tong cot C1',
    description: null,
    instructions: null,
    priority: 'NORMAL',
    status: 'OPEN',
    planned_start_at: null,
    planned_end_at: null,
    due_at: null,
    planned_headcount: null,
    custom_fields: {},
    created_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    version: 1,
    job_board_open: true,
    job_board_open_from: null,
    job_board_open_until: null,
    request_key: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function setupPool(count: string, rows: Record<string, unknown>[]): jest.Mock {
  const query: jest.Mock = jest.fn(async (text: string) => {
    if (text.includes('COUNT(*)')) return { rows: [{ count }] };
    return { rows };
  });
  G.__pgPool = { query };
  return query;
}

describe('PgWorkOrderRepository.searchJobBoard (JOB-SRS-005 #45, BD5)', () => {
  afterEach(() => {
    delete G.__pgPool;
  });

  function lastTexts(query: jest.Mock): string[] {
    return query.mock.calls.map((c) => String(c[0]));
  }

  it('WHERE đủ 5 nhánh availability + NOT EXISTS assignment (non-scope)', async () => {
    const query = setupPool('1', [workOrderRow()]);
    const repo = new PgWorkOrderRepository();
    const now = new Date('2026-11-01T08:00:00.000Z');
    const out = await repo.searchJobBoard({ limit: 20, offset: 0, now });
    expect(query).toHaveBeenCalledTimes(2);
    const [countSql, pageSql] = lastTexts(query);
    for (const sql of [countSql, pageSql]) {
      expect(sql).toContain(`w.status = 'OPEN'`);
      expect(sql).toContain(`w.job_board_open = true`);
      // Nhánh window bọc ngoặc — AND bind chặt hơn OR, thiếu ngoặc là sai semantics
      expect(sql).toContain(`(w.job_board_open_from IS NULL OR w.job_board_open_from <= $1)`);
      expect(sql).toContain(`(w.job_board_open_until IS NULL OR w.job_board_open_until > $1)`);
      expect(sql).toContain(`NOT EXISTS`);
      expect(sql).toContain(`public.assignments`);
      expect(sql).toContain(`PENDING_ACCEPTANCE`);
      expect(sql).toContain(`ACTIVE`);
      expect(sql).not.toContain(`project_id = ANY`);
    }
    // until biên strict `>` (until == now bị loại — conservative, §20)
    expect(pageSql).toContain(`job_board_open_until > $1`);
    expect(pageSql).toContain(`ORDER BY w.updated_at DESC, w.id DESC`);
    // now truyền 1 lần cho cả COUNT lẫn page
    expect(query.mock.calls[0][1]).toEqual([now]);
    expect(query.mock.calls[1][1][0]).toEqual(now);
    expect(out.total).toBe(1);
    expect(out.entities).toHaveLength(1);
    expect(out.entities[0].id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('non-ADMIN: scope project_id = ANY trong CẢ COUNT lẫn page', async () => {
    const query = setupPool('0', []);
    const repo = new PgWorkOrderRepository();
    const now = new Date('2026-11-01T08:00:00.000Z');
    const p1 = '22222222-2222-4222-8222-222222222222';
    const out = await repo.searchJobBoard({ projectIds: [p1], limit: 20, offset: 0, now });
    const [countSql, pageSql] = lastTexts(query);
    expect(countSql).toContain(`w.project_id = ANY($2::uuid[])`);
    expect(pageSql).toContain(`w.project_id = ANY($2::uuid[])`);
    expect(query.mock.calls[0][1]).toEqual([now, [p1]]);
    expect(out.total).toBe(0);
    expect(out.entities).toEqual([]);
  });

  it('clamp limit 1-100 / offset ≥0 ở repo (defense in depth sau controller 400)', async () => {
    const query = setupPool('0', []);
    const repo = new PgWorkOrderRepository();
    const now = new Date('2026-11-01T08:00:00.000Z');
    await repo.searchJobBoard({ limit: 200, offset: -5, now });
    const params = query.mock.calls[1][1] as unknown[];
    expect(params[params.length - 2]).toBe(100);
    expect(params[params.length - 1]).toBe(0);
  });

  it('F003: NaN/Infinity → dùng default (limit 20, offset 0), không NaN vào SQL', async () => {
    const query = setupPool('0', []);
    const repo = new PgWorkOrderRepository();
    const now = new Date('2026-11-01T08:00:00.000Z');
    await repo.searchJobBoard({ limit: NaN, offset: NaN, now });
    const params = query.mock.calls[1][1] as unknown[];
    expect(params[params.length - 2]).toBe(20);
    expect(params[params.length - 1]).toBe(0);
    await repo.searchJobBoard({ limit: Infinity, offset: Infinity, now });
    const params2 = query.mock.calls[3][1] as unknown[];
    expect(params2[params2.length - 2]).toBe(20);
    expect(params2[params2.length - 1]).toBe(0);
  });

  it('findAreaRefs đọc public.project_areas; ids rỗng → map rỗng, không query', async () => {
    const query = setupPool('0', []);
    const repo = new PgWorkOrderRepository();
    const id = '55555555-5555-4555-8555-555555555555';
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id, code: 'A-01', name: 'Khu A' }] });
    const refs = await repo.findAreaRefs!([id]);
    expect(query.mock.calls[0][0]).toContain('FROM public.project_areas');
    expect(query.mock.calls[0][0]).toContain('= ANY($1::uuid[])');
    expect(refs.get(id)).toEqual({ id, code: 'A-01', name: 'Khu A' });
    const empty = await repo.findAreaRefs!([]);
    expect(empty.size).toBe(0);
  });

  it('findTradeRefs đọc public.trades; ids rỗng → map rỗng, không query', async () => {
    const query = setupPool('0', []);
    const repo = new PgWorkOrderRepository();
    const id = '66666666-6666-4666-8666-666666666666';
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id, code: 'TR-01', name: 'Tho xay' }] });
    const refs = await repo.findTradeRefs!([id]);
    expect(query.mock.calls[0][0]).toContain('FROM public.trades');
    expect(query.mock.calls[0][0]).toContain('= ANY($1::uuid[])');
    expect(refs.get(id)).toEqual({ id, code: 'TR-01', name: 'Tho xay' });
    const callsBefore = (query as jest.Mock).mock.calls.length;
    const empty = await repo.findTradeRefs!([]);
    expect(empty.size).toBe(0);
    expect((query as jest.Mock).mock.calls.length).toBe(callsBefore);
  });
});
