import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { ProjectScopeService } from '../src/modules/iam/application/service/project-scope.service';
import { JOB_WORK_ORDER_REPOSITORY, JobBoardFilter, JobBoardScopeFilter } from '../src/modules/job/domain/repository/work-order-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkOrderEntity, WorkOrderStatus } from '../src/modules/job/domain/entity/work-order.entity';

// JOB-SRS-006 (issue #46) — GET /api/v1/job-board filters + filter-options
// INTEGRATION-IN-MEMORY (supertest qua Nest app với repository/scope/tx/
// audit MOCK bằng Map + fakeTx + assignment store) — KHÔNG phải real-DB
// proof. Real-DB proof chỉ ở evidence driver (stage sau). KHÔNG cite file này
// như bằng chứng Postgres thật.
// Fixture clone từ `job-board-list.e2e.spec.ts` (const P2 thật — không có
// `P2_OUTSIDE`, m4). Mock repo mirror predicate SQL BD5/BD10/BD11 bằng JS
// (availability + scope + 5 filter AND + ORDER updated_at DESC, id DESC).

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WORKER_NOTRADE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';

const AREA_A = '55555555-5555-4555-8555-555555555555';
const AREA_B = '77777777-7777-4777-8777-777777777777';
const WT_A = '44444444-4444-4444-8444-444444444444';
const WT_B = '88888888-8888-4888-8888-888888888888';
const TRADE1 = '66666666-6666-4666-8666-666666666666';
const TRADE2 = '99999999-1111-4111-8111-999999999999';
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

function woId(n: number): string {
  return `22222222-2222-4222-8222-2222222222${String(n).padStart(2, '0')}`;
}

const N1 = woId(1);
const N2 = woId(2);
const N3 = woId(3);
const N4 = woId(4);
const N6 = woId(6);
const N7 = woId(7);

describe('JOB-SRS-006 job-board filters (integration in-memory HTTP contract — mock repo, KHÔNG phải real-DB)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderEntity>();
  const assignments = new Map<string, string>();
  let auditLogWithClient: jest.Mock;
  let auditLog: jest.Mock;

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const OCT_START = '2026-10-01T00:00:00Z';
  const OCT_END = '2026-10-31T23:59:59Z';

  function seed(params: {
    n: number;
    projectId?: string;
    status?: WorkOrderStatus;
    areaId?: string | null;
    workTypeId?: string;
    tradeId?: string | null;
    plannedStart?: Date | null;
    plannedEnd?: Date | null;
    updatedAtAgoMs?: number;
  }): string {
    const id = woId(params.n);
    const e = WorkOrderEntity.fromPersistence({
      id,
      code: `WO-E2E-JF${params.n}`,
      projectId: params.projectId ?? P1,
      areaId: params.areaId ?? null,
      workTypeId: params.workTypeId ?? WT_A,
      requiredTradeId: params.tradeId ?? null,
      title: `Viec filter ${params.n}`,
      description: null,
      instructions: null,
      priority: 'NORMAL',
      status: params.status ?? 'OPEN',
      plannedStartAt: params.plannedStart ?? null,
      plannedEndAt: params.plannedEnd ?? null,
      dueAt: null,
      plannedHeadcount: null,
      customFields: {},
      jobBoardOpen: true,
      jobBoardOpenFrom: new Date(now - 30 * DAY),
      jobBoardOpenUntil: new Date(now + 30 * DAY),
      createdBy: ADMIN_ID,
      version: 1,
      requestKey: null,
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - (params.updatedAtAgoMs ?? 5 * DAY)),
    });
    store.set(id, e);
    return id;
  }

  function makeUser(id: string, email: string, passwordHash: string): UserEntity {
    return new UserEntity({
      id,
      email,
      passwordHash,
      fullName: 'E2E User',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const H = 60 * 60 * 1000;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-job-board-filters-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    // Baseline: N1 (P1/A_A/WT_A/T1/Oct), N7 (P1/A_A/WT_A/T1/Nov),
    // N6 (P1/A_B/WT_A/T1/Oct), N2 (P1/A_B/WT_B/T2/Nov),
    // N3 (P1/A_A/WT_B/null-trade/planned NULL), N4 (P2 — ngoài scope worker),
    // N5 (READY — tiêu cực, không bao giờ listed).
    seed({ n: 1, areaId: AREA_A, workTypeId: WT_A, tradeId: TRADE1, plannedStart: new Date('2026-10-01T08:00:00Z'), plannedEnd: new Date('2026-10-05T08:00:00Z'), updatedAtAgoMs: 1 * H });
    seed({ n: 7, areaId: AREA_A, workTypeId: WT_A, tradeId: TRADE1, plannedStart: new Date('2026-11-10T08:00:00Z'), plannedEnd: new Date('2026-11-15T08:00:00Z'), updatedAtAgoMs: 2 * H });
    seed({ n: 6, areaId: AREA_B, workTypeId: WT_A, tradeId: TRADE1, plannedStart: new Date('2026-10-20T08:00:00Z'), plannedEnd: new Date('2026-10-25T08:00:00Z'), updatedAtAgoMs: 3 * H });
    seed({ n: 2, areaId: AREA_B, workTypeId: WT_B, tradeId: TRADE2, plannedStart: new Date('2026-11-10T08:00:00Z'), plannedEnd: new Date('2026-11-15T08:00:00Z'), updatedAtAgoMs: 4 * H });
    seed({ n: 3, areaId: AREA_A, workTypeId: WT_B, tradeId: null, plannedStart: null, plannedEnd: null, updatedAtAgoMs: 5 * H });
    seed({ n: 4, projectId: P2, areaId: AREA_A, workTypeId: WT_A, tradeId: TRADE1, plannedStart: new Date('2026-10-01T08:00:00Z'), plannedEnd: new Date('2026-10-05T08:00:00Z'), updatedAtAgoMs: 6 * H });
    seed({ n: 5, areaId: AREA_A, workTypeId: WT_A, tradeId: TRADE1, status: 'READY', plannedStart: new Date('2026-12-01T08:00:00Z'), plannedEnd: new Date('2026-12-05T08:00:00Z'), updatedAtAgoMs: 7 * H });

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-jf@example.com', makeUser(ADMIN_ID, 'admin-e2e-jf@example.com', hash)],
      ['worker-e2e-jf@example.com', makeUser(WORKER_ID, 'worker-e2e-jf@example.com', hash)],
      ['worker-notrade-e2e-jf@example.com', makeUser(WORKER_NOTRADE_ID, 'worker-notrade-e2e-jf@example.com', hash)],
      ['outsider-e2e-jf@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-jf@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [WORKER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
      [WORKER_NOTRADE_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
      [OUTSIDER_ID, [{ id: 'r4', code: 'WORKER', name: 'Worker' }]],
    ]);
    const mockUserRepo = {
      findByEmail: jest.fn(async (email: string) => users.get(email.toLowerCase()) ?? null),
      findById: jest.fn(async (id: string) => [...users.values()].find((u) => u.id === id) ?? null),
      save: jest.fn(async () => {}),
      findActiveRolesByUserId: jest.fn(async (id: string) => rolesByUser.get(id) ?? []),
      findActiveProjectIdsByUserId: jest.fn(async () => [] as string[]),
    };
    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hashStr: string) => bcrypt.compare(plain, hashStr),
    };
    auditLogWithClient = jest.fn(async () => {});
    auditLog = jest.fn(async () => {});
    const mockAudit = { log: auditLog, logWithClient: auditLogWithClient };
    const txClient = { query: jest.fn(async () => ({ rowCount: 1 })) };
    const fakeTx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn(txClient) };

    // Scope-first: ADMIN null, WORKER + WORKER_NOTRADE P1, outsider rỗng.
    const mockScope = {
      resolveAccessibleProjectIds: jest.fn(
        async ({ userId, actorRoles }: { userId: string; actorRoles: string[] }) => {
          if (actorRoles.includes('ADMIN')) return null;
          if (userId === WORKER_ID || userId === WORKER_NOTRADE_ID) return [P1];
          return [];
        },
      ),
    };

    // skill=mine mirror: WORKER có TRADE1 active, còn lại rỗng.
    const tradesByUser = new Map<string, string[]>([[WORKER_ID, [TRADE1]]]);

    const workTypeRefs = new Map([
      [WT_A, { id: WT_A, code: 'WT-A', name: 'Cong viec A' }],
      [WT_B, { id: WT_B, code: 'WT-B', name: 'Cong viec B' }],
    ]);
    const projectRefs = new Map([
      [P1, { id: P1, code: 'PRJ-001', name: 'Du an 1' }],
      [P2, { id: P2, code: 'PRJ-002', name: 'Du an 2' }],
    ]);
    const areaRefs = new Map([
      [AREA_A, { id: AREA_A, code: 'A-01', name: 'Khu A' }],
      [AREA_B, { id: AREA_B, code: 'A-02', name: 'Khu B' }],
    ]);
    const tradeRefs = new Map([
      [TRADE1, { id: TRADE1, code: 'TR-01', name: 'Tho 1' }],
      [TRADE2, { id: TRADE2, code: 'TR-02', name: 'Tho 2' }],
    ]);

    const isActiveAssignment = (id: string): boolean => {
      const s = assignments.get(id);
      return s === 'PENDING_ACCEPTANCE' || s === 'ACTIVE';
    };

    // Mirror predicate SQL BD5/BD10/BD11 bằng JS.
    function availableRows(filter: { projectIds?: string[]; now: Date }): WorkOrderEntity[] {
      const nowMs = new Date(filter.now).getTime();
      return [...store.values()].filter((e) => {
        const p = e.toPublic();
        if (p.status !== 'OPEN') return false;
        if (!p.jobBoardOpen) return false;
        if (p.jobBoardOpenFrom !== null && p.jobBoardOpenFrom.getTime() > nowMs) return false;
        if (p.jobBoardOpenUntil !== null && p.jobBoardOpenUntil.getTime() <= nowMs) return false;
        if (isActiveAssignment(p.id)) return false;
        if (filter.projectIds && !filter.projectIds.includes(p.projectId)) return false;
        return true;
      });
    }

    function applyFilters(rows: WorkOrderEntity[], filter: JobBoardFilter): WorkOrderEntity[] {
      return rows.filter((e) => {
        const p = e.toPublic();
        if (filter.projectId && p.projectId !== filter.projectId) return false;
        if (filter.areaIds && (p.areaId === null || !filter.areaIds.includes(p.areaId))) return false;
        if (filter.workTypeIds && !filter.workTypeIds.includes(p.workTypeId)) return false;
        if (filter.plannedFrom || filter.plannedTo) {
          if (p.plannedStartAt === null) return false;
          const start = p.plannedStartAt.getTime();
          const end = (p.plannedEndAt ?? p.plannedStartAt).getTime();
          if (filter.plannedTo && start > filter.plannedTo.getTime()) return false;
          if (filter.plannedFrom && end < filter.plannedFrom.getTime()) return false;
        }
        if (filter.requiredTradeIds && (p.requiredTradeId === null || !filter.requiredTradeIds.includes(p.requiredTradeId))) return false;
        return true;
      });
    }

    function sortRows(rows: WorkOrderEntity[]): WorkOrderEntity[] {
      return [...rows].sort((a, b) => {
        const pa = a.toPublic();
        const pb = b.toPublic();
        const diff = pb.updatedAt.getTime() - pa.updatedAt.getTime();
        if (diff !== 0) return diff;
        return pb.id < pa.id ? -1 : pb.id > pa.id ? 1 : 0;
      });
    }

    const mockWorkOrderRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      searchJobBoard: jest.fn(async (filter: JobBoardFilter) => {
        const rows = sortRows(applyFilters(availableRows(filter), filter));
        const total = rows.length;
        const limit = Math.min(Math.max(filter.limit, 1), 100);
        const offset = Math.max(filter.offset, 0);
        return { entities: rows.slice(offset, offset + limit), total };
      }),
      findActiveTradeIdsByUserId: jest.fn(async (userId: string) => tradesByUser.get(userId) ?? []),
      findJobBoardFilterOptions: jest.fn(async (filter: JobBoardScopeFilter) => {
        const rows = availableRows(filter);
        const uniq = (pick: (e: WorkOrderEntity) => string | null): string[] =>
          [...new Set(rows.map(pick).filter((v): v is string => v !== null))].sort();
        return {
          projectIds: uniq((e) => e.toPublic().projectId),
          areaIds: uniq((e) => e.toPublic().areaId),
          workTypeIds: uniq((e) => e.toPublic().workTypeId),
          tradeIds: uniq((e) => e.toPublic().requiredTradeId),
        };
      }),
      hasActiveAssignmentByWorkOrderIds: jest.fn(async (ids: string[]) => new Set(ids.filter(isActiveAssignment))),
      findWorkTypeRefs: jest.fn(async (ids: string[]) => new Map(ids.filter((id) => workTypeRefs.has(id)).map((id) => [id, workTypeRefs.get(id)!]))),
      findProjectRefs: jest.fn(async (ids: string[]) => new Map(ids.filter((id) => projectRefs.has(id)).map((id) => [id, projectRefs.get(id)!]))),
      findAreaRefs: jest.fn(async (ids: string[]) => new Map(ids.filter((id) => areaRefs.has(id)).map((id) => [id, areaRefs.get(id)!]))),
      findTradeRefs: jest.fn(async (ids: string[]) => new Map(ids.filter((id) => tradeRefs.has(id)).map((id) => [id, tradeRefs.get(id)!]))),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(ProjectScopeService).useValue(mockScope)
      .overrideProvider(JOB_WORK_ORDER_REPOSITORY).useValue(mockWorkOrderRepo)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(200);
    return res.body.accessToken as string;
  }

  const idsOf = (body: { data: Array<{ id: string }> }): string[] => body.data.map((d) => d.id);

  // ---- AC1: từng filter + kết hợp + clear ----

  it('F1a: date filter overlap planned (Oct → N1+N6; NULL-planned N3 bị loại)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board?dateFrom=${encodeURIComponent(OCT_START)}&dateTo=${encodeURIComponent(OCT_END)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(2);
    expect(idsOf(res.body)).toEqual([N1, N6]);
  });

  it('F1a: date range không overlap → 200 empty', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board?dateFrom=${encodeURIComponent('2027-01-01T00:00:00Z')}&dateTo=${encodeURIComponent('2027-02-01T00:00:00Z')}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({ total: 0, data: [] }));
  });

  it('F1b: projectId=P1 → đúng tập scope; projectId sai format → 400 {projectId}', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board?projectId=${P1}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(5);
    expect(idsOf(res.body)).toEqual([N1, N7, N6, N2, N3]);
    const bad = await request(app.getHttpServer())
      .get('/api/v1/job-board?projectId=not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(bad.body.fieldErrors).toEqual({ projectId: expect.anything() });
  });

  it('F1c: areaId đơn + lặp (`areaId=a&areaId=b`)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const single = await request(app.getHttpServer())
      .get(`/api/v1/job-board?areaId=${AREA_A}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(single.body.total).toBe(3);
    expect(idsOf(single.body)).toEqual([N1, N7, N3]);
    const multi = await request(app.getHttpServer())
      .get(`/api/v1/job-board?areaId=${AREA_A}&areaId=${AREA_B}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(multi.body.total).toBe(5);
  });

  it('F1d: workTypeId đơn + lặp', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const single = await request(app.getHttpServer())
      .get(`/api/v1/job-board?workTypeId=${WT_A}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(single.body.total).toBe(3);
    expect(idsOf(single.body)).toEqual([N1, N7, N6]);
    const multi = await request(app.getHttpServer())
      .get(`/api/v1/job-board?workTypeId=${WT_A}&workTypeId=${WT_B}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(multi.body.total).toBe(5);
  });

  it('F1e: skill=mine → chỉ WO khớp trade (N1+N7+N6; NULL-trade N3 + khác trade N2 bị loại)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?skill=mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(3);
    expect(idsOf(res.body)).toEqual([N1, N7, N6]);
  });

  it('F1f: kết hợp cả 5 chiều = giao các tập đơn (chỉ N1)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/job-board?projectId=${P1}&areaId=${AREA_A}&workTypeId=${WT_A}` +
        `&dateFrom=${encodeURIComponent(OCT_START)}&dateTo=${encodeURIComponent(OCT_END)}&skill=mine`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(idsOf(res.body)).toEqual([N1]);
  });

  it('F1g: clear (không param) = tập baseline #45 (5 items P1)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(5);
    expect(idsOf(res.body)).toEqual([N1, N7, N6, N2, N3]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  // ---- AC2: invalid ----

  it('F2a: naive ISO (thiếu offset) → 400 fieldErrors {dateFrom} + message múi giờ', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?dateFrom=2026-10-01T00:00:00')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.fieldErrors).toEqual({ dateFrom: expect.anything() });
    expect(String(res.body.fieldErrors.dateFrom[0])).toContain('múi giờ');
    // F001 (#46): date-range 400 mang code (mirror #44).
    expect(res.body.code).toBe('JOB_BOARD_DATE_RANGE_INVALID');
  });

  it('F2b: dateFrom > dateTo → 400 fieldErrors CẢ hai field', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board?dateFrom=${encodeURIComponent('2026-11-01T00:00:00Z')}&dateTo=${encodeURIComponent('2026-10-01T00:00:00Z')}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.fieldErrors).toEqual({
      dateFrom: expect.anything(),
      dateTo: expect.anything(),
    });
    expect(res.body.code).toBe('JOB_BOARD_DATE_RANGE_INVALID');
  });

  it('F2c: projectId=P2 ngoài scope worker → 403 generic', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board?projectId=${P2}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.message).toBeDefined();
  });

  it('F2d: skill=mine khi worker không trade active → 200 empty (không lỗi)', async () => {
    const token = await login('worker-notrade-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?skill=mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual(expect.objectContaining({ total: 0, data: [] }));
  });

  it('F2e: areaId/workTypeId đúng UUID nhưng không tồn tại → 200 empty', async () => {
    const token = await login('worker-e2e-jf@example.com');
    for (const q of [`areaId=${UNKNOWN_UUID}`, `workTypeId=${UNKNOWN_UUID}`]) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/job-board?${q}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual(expect.objectContaining({ total: 0, data: [] }));
    }
  });

  it('F2: skill lạ → 400 {skill}', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?skill=all')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.fieldErrors).toEqual({ skill: expect.anything() });
  });

  // ---- AC3/AC4/AC5/AC6/AC7 ----

  it('F3: seed assignment (mô phỏng claim #47) → list có filter mất item, total giảm', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const q = `dateFrom=${encodeURIComponent(OCT_START)}&dateTo=${encodeURIComponent(OCT_END)}`;
    const before = await request(app.getHttpServer())
      .get(`/api/v1/job-board?${q}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body.total).toBe(2);
    assignments.set(N1, 'PENDING_ACCEPTANCE');
    const after = await request(app.getHttpServer())
      .get(`/api/v1/job-board?${q}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.total).toBe(1);
    expect(idsOf(after.body)).toEqual([N6]);
    assignments.delete(N1);
  });

  it('F4: pagination trên filtered WHERE (skill=mine total 3: page 2 ≠ page 1, total COUNT đúng)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const p1 = await request(app.getHttpServer())
      .get('/api/v1/job-board?skill=mine&limit=2&offset=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(p1.body.total).toBe(3);
    expect(idsOf(p1.body)).toEqual([N1, N7]);
    const p2 = await request(app.getHttpServer())
      .get('/api/v1/job-board?skill=mine&limit=2&offset=2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(p2.body.total).toBe(3);
    expect(idsOf(p2.body)).toEqual([N6]);
    expect(p2.body.limit).toBe(2);
    expect(p2.body.offset).toBe(2);
  });

  it('F4: unknown key ignore (không 400, không đổi tập)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?foo=1&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(5);
    expect(res.body.limit).toBe(5);
  });

  it('F5: anon → 401; outsider → 200 empty (list + filter-options)', async () => {
    await request(app.getHttpServer()).get('/api/v1/job-board').expect(401);
    await request(app.getHttpServer()).get('/api/v1/job-board/filter-options').expect(401);
    const token = await login('outsider-e2e-jf@example.com');
    const list = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
    const opts = await request(app.getHttpServer())
      .get('/api/v1/job-board/filter-options')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(opts.body).toEqual(
      expect.objectContaining({ projects: [], areas: [], workTypes: [], trades: [] }),
    );
  });

  it('F5: worker gửi mọi filter khớp N4 (P2) vẫn không thấy row ngoài scope', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/job-board?areaId=${AREA_A}&workTypeId=${WT_A}` +
        `&dateFrom=${encodeURIComponent(OCT_START)}&dateTo=${encodeURIComponent(OCT_END)}&skill=mine`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(idsOf(res.body)).not.toContain(N4);
    expect(idsOf(res.body)).toEqual([N1]);
  });

  it('F5: ADMIN thấy tất cả available gồm N4 (P2)', async () => {
    const token = await login('admin-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(6);
    expect(idsOf(res.body)).toContain(N4);
  });

  it('F4/F5: filter-options worker = PRA-scope + enrich names + no-store', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board/filter-options')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.projects).toEqual([{ id: P1, name: 'Du an 1' }]);
    expect(res.body.areas).toEqual([
      { id: AREA_A, name: 'Khu A' },
      { id: AREA_B, name: 'Khu B' },
    ]);
    expect(res.body.workTypes).toEqual([
      { id: WT_A, name: 'Cong viec A' },
      { id: WT_B, name: 'Cong viec B' },
    ]);
    expect(res.body.trades).toEqual([
      { id: TRADE1, name: 'Tho 1' },
      { id: TRADE2, name: 'Tho 2' },
    ]);
  });

  it('F7/BD18: N GET (list + filter-options) không đổi audit count (read-only)', async () => {
    const token = await login('worker-e2e-jf@example.com');
    const auditBefore = auditLogWithClient.mock.calls.length + auditLog.mock.calls.length;
    await request(app.getHttpServer()).get('/api/v1/job-board?skill=mine').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/job-board?areaId=${AREA_A}`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/api/v1/job-board/filter-options').set('Authorization', `Bearer ${token}`).expect(200);
    expect(auditLogWithClient.mock.calls.length + auditLog.mock.calls.length).toBe(auditBefore);
  });
});
