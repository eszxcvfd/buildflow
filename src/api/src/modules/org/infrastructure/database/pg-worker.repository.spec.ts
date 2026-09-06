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

  describe('ORG-SRS-005 sort whitelist (issue #28)', () => {
    async function runFindMany(filter: Record<string, unknown>): Promise<string[]> {
      const seenQueries: string[] = [];
      const fakePool = {
        query: jest.fn(async (sql: string) => {
          seenQueries.push(sql);
          if (/COUNT\(\*\)/.test(sql)) return { rows: [{ count: '0' }], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        }),
      };
      (globalThis as unknown as { __pgPool?: unknown }).__pgPool = fakePool;
      try {
        await new PgWorkerRepository().findMany(filter);
      } finally {
        delete (globalThis as unknown as { __pgPool?: unknown }).__pgPool;
      }
      return seenQueries;
    }

    it('default ORDER BY created_at DESC; sort=name → ORDER BY full_name ASC khi order=asc', async () => {
      const def = await runFindMany({});
      expect(def[1]).toContain('ORDER BY created_at DESC');
      const byName = await runFindMany({ sort: 'name', order: 'asc' });
      expect(byName[1]).toContain('ORDER BY full_name ASC');
    });

    it('ORDER BY chỉ dùng cột whitelist (không nội suy string client)', async () => {
      const queries = await runFindMany({ sort: 'createdAt', order: 'desc' });
      expect(queries[1]).toContain('ORDER BY created_at DESC');
      expect(queries[1]).not.toContain('createdAt');
    });

    it('filter kết hợp status+tradeId+skillLevel vẫn build đúng WHERE', async () => {
      const queries = await runFindMany({
        status: 'ACTIVE',
        tradeId: '11111111-1111-4111-8111-111111111111',
        skillLevel: 3,
      });
      const dataSql = queries[1] as string;
      expect(dataSql).toContain('status = $1');
      expect(dataSql).toContain('rt2.skill_level = $3');
      expect(dataSql).toContain('ORDER BY created_at DESC');
    });
  });
});
