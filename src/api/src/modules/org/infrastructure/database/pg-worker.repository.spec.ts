import { PgWorkerRepository } from './pg-worker.repository';

// ORG-SRS-004 (issue #27) — contract-level test cho countOpenAssignments SQL
// (fake pool seam globalThis.__pgPool, không cần DB thật).

describe('PgWorkerRepository ORG-SRS-004 (countOpenAssignments SQL contract)', () => {
  afterEach(() => {
    delete (globalThis as unknown as { __pgPool?: unknown }).__pgPool;
  });

  it('countOpenAssignments: SQL đếm assignments mở theo worker_id + status mở', async () => {
    const seenQueries: string[] = [];
    const fakePool = {
      query: jest.fn(async (sql: string) => {
        seenQueries.push(sql);
        return { rows: [{ total: 5 }], rowCount: 1 };
      }),
    };
    (globalThis as unknown as { __pgPool?: unknown }).__pgPool = fakePool;

    const repo = new PgWorkerRepository();
    const total = await repo.countOpenAssignments('11111111-1111-4111-8111-111111111111');

    expect(total).toBe(5);
    const sql = seenQueries[0] as string;
    expect(sql).toContain('FROM public.assignments');
    expect(sql).toContain('worker_id = $1');
    expect(sql).toContain("status IN ('PENDING_ACCEPTANCE', 'ACTIVE')");
    // Không đếm ENDED/WITHDRAWN/REJECTED
    expect(sql).not.toContain('ENDED');
  });
});
