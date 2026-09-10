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
import { JOB_WORK_ORDER_REPOSITORY, JobBoardFilter } from '../src/modules/job/domain/repository/work-order-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkOrderEntity, WorkOrderStatus } from '../src/modules/job/domain/entity/work-order.entity';

// JOB-SRS-005 (issue #45) — GET /api/v1/job-board
// INTEGRATION-IN-MEMORY (supertest qua Nest app với repository/scope/tx/
// audit MOCK bằng Map + fakeTx + assignment store) — KHÔNG phải real-DB
// proof. Real-DB proof chỉ ở evidence driver T11 (stage sau, ngoài scope
// task backend này). KHÔNG cite file này như bằng chứng Postgres thật.
// Phạm vi AC (in-memory): AC1 worker đúng scope thấy available + ADMIN thấy
// tất cả; AC2 4 lớp loại trừ (assignment/window/status/scope) + board-đóng;
// AC3 list → chèn assignment → list lại (item biến, total giảm); AC4 offset
// pagination window chính xác (filter là #46 — deviation BD9); AC5 matrix
// (anon 401 / membership rỗng 200 empty / P1 không thấy P2 / unknown key
// ignore); AC6 limit/offset sai 400 fieldErrors; AC7 N GET audit count
// không đổi (read-only — BD8; notification: read path không có writer).

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';
const P2_OUTSIDE = '99999999-9999-4999-8999-999999999998';

const ACTIVE_TYPE = '44444444-4444-4444-8444-444444444444';
const AREA_ID = '55555555-5555-4555-8555-555555555555';
const TRADE_ID = '66666666-6666-4666-8666-666666666666';

function woId(n: number): string {
  return `11111111-1111-4111-8111-1111111111${String(n).padStart(2, '0')}`;
}

const AVAIL1 = woId(1);
const AVAIL2 = woId(2);

describe('JOB-SRS-005 job-board list (integration in-memory HTTP contract — mock repo, KHÔNG phải real-DB)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderEntity>();
  /** assignments hiện tại: woId → status (PENDING_ACCEPTANCE/ACTIVE = đang nhận). */
  const assignments = new Map<string, string>();
  let auditLogWithClient: jest.Mock;
  let auditLog: jest.Mock;

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  function seed(params: {
    n: number;
    projectId?: string;
    status?: WorkOrderStatus;
    board?: boolean;
    from?: Date | null;
    until?: Date | null;
    areaId?: string | null;
    tradeId?: string | null;
    updatedAtAgoMs?: number;
  }): string {
    const id = woId(params.n);
    const e = WorkOrderEntity.fromPersistence({
      id,
      code: `WO-E2E-JB${params.n}`,
      projectId: params.projectId ?? P1,
      areaId: params.areaId ?? null,
      workTypeId: ACTIVE_TYPE,
      requiredTradeId: params.tradeId ?? null,
      title: `Viec board ${params.n}`,
      description: null,
      instructions: null,
      priority: 'NORMAL',
      status: params.status ?? 'OPEN',
      plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
      plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
      dueAt: null,
      plannedHeadcount: null,
      customFields: {},
      jobBoardOpen: params.board ?? true,
      jobBoardOpenFrom: params.from ?? null,
      jobBoardOpenUntil: params.until ?? null,
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

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-job-board-list-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    // 2 available (P1) + 7 tiêu cực: assignment ACTIVE / until quá khứ /
    // from tương lai / READY / CANCELLED / ngoài scope P2 / board đóng.
    seed({ n: 1, from: new Date(now - 30 * DAY), until: new Date(now + 30 * DAY), areaId: AREA_ID, tradeId: TRADE_ID, updatedAtAgoMs: 1 * 60 * 60 * 1000 });
    seed({ n: 2, from: null, until: null, updatedAtAgoMs: 2 * 60 * 60 * 1000 });
    const assignedId = seed({ n: 3, from: new Date(now - 30 * DAY), until: new Date(now + 30 * DAY) });
    assignments.set(assignedId, 'ACTIVE');
    seed({ n: 4, from: new Date(now - 30 * DAY), until: new Date(now - 1 * DAY) });
    seed({ n: 5, from: new Date(now + 1 * DAY), until: new Date(now + 30 * DAY) });
    seed({ n: 6, status: 'READY', from: new Date(now - 30 * DAY), until: new Date(now + 30 * DAY) });
    seed({ n: 7, status: 'CANCELLED', from: new Date(now - 30 * DAY), until: new Date(now + 30 * DAY) });
    seed({ n: 8, projectId: P2, from: new Date(now - 30 * DAY), until: new Date(now + 30 * DAY) });
    seed({ n: 9, board: false });

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-jb@example.com', makeUser(ADMIN_ID, 'admin-e2e-jb@example.com', hash)],
      ['worker-e2e-jb@example.com', makeUser(WORKER_ID, 'worker-e2e-jb@example.com', hash)],
      ['outsider-e2e-jb@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-jb@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [WORKER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
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

    // Scope-first mirror search-work-orders: ADMIN null, WORKER P1, outsider rỗng.
    const mockScope = {
      resolveAccessibleProjectIds: jest.fn(
        async ({ userId, actorRoles }: { userId: string; actorRoles: string[] }) => {
          if (actorRoles.includes('ADMIN')) return null;
          if (userId === WORKER_ID) return [P1];
          return [];
        },
      ),
    };

    const workTypeRefs = new Map([[ACTIVE_TYPE, { id: ACTIVE_TYPE, code: 'WT-001', name: 'Do be tong' }]]);
    const projectRefs = new Map([
      [P1, { id: P1, code: 'PRJ-001', name: 'Du an 1' }],
      [P2, { id: P2, code: 'PRJ-002', name: 'Du an 2' }],
    ]);
    const areaRefs = new Map([[AREA_ID, { id: AREA_ID, code: 'A-01', name: 'Khu A' }]]);
    const tradeRefs = new Map([[TRADE_ID, { id: TRADE_ID, code: 'TR-01', name: 'Tho xay' }]]);

    const isActiveAssignment = (id: string): boolean => {
      const s = assignments.get(id);
      return s === 'PENDING_ACCEPTANCE' || s === 'ACTIVE';
    };

    // Mirror predicate SQL BD5 bằng JS (status OPEN + board mở + window vs
    // now + NOT EXISTS assignment + scope; ORDER updated_at DESC, id DESC).
    const mockWorkOrderRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      searchJobBoard: jest.fn(async (filter: JobBoardFilter) => {
        const nowMs = new Date(filter.now).getTime();
        const rows = [...store.values()].filter((e) => {
          const p = e.toPublic();
          if (p.status !== 'OPEN') return false;
          if (!p.jobBoardOpen) return false;
          if (p.jobBoardOpenFrom !== null && p.jobBoardOpenFrom.getTime() > nowMs) return false;
          if (p.jobBoardOpenUntil !== null && p.jobBoardOpenUntil.getTime() <= nowMs) return false;
          if (isActiveAssignment(p.id)) return false;
          if (filter.projectIds && !filter.projectIds.includes(p.projectId)) return false;
          return true;
        });
        rows.sort((a, b) => {
          const pa = a.toPublic();
          const pb = b.toPublic();
          const diff = pb.updatedAt.getTime() - pa.updatedAt.getTime();
          if (diff !== 0) return diff;
          return pb.id < pa.id ? -1 : pb.id > pa.id ? 1 : 0;
        });
        const total = rows.length;
        const limit = Math.min(Math.max(filter.limit, 1), 100);
        const offset = Math.max(filter.offset, 0);
        return { entities: rows.slice(offset, offset + limit), total };
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

  it('AC5: anon → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/job-board').expect(401);
  });

  it('AC5: membership rỗng (outsider) → 200 empty, không 403 (BD2)', async () => {
    const token = await login('outsider-e2e-jb@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('AC1/AC2: worker P1 chỉ thấy 2 available đúng scope (state AVAILABLE, đủ refs, không createdBy, no-store)', async () => {
    const token = await login('worker-e2e-jb@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?limit=20&offset=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.total).toBe(2);
    expect(res.body.limit).toBe(20);
    expect(res.body.offset).toBe(0);
    // ORDER BY updated_at DESC — AVAIL1 mới hơn lên đầu
    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([AVAIL1, AVAIL2]);
    for (const item of res.body.data) {
      expect(item.jobBoard.state).toBe('AVAILABLE');
      expect(item.jobBoard.open).toBe(true);
      expect(item).not.toHaveProperty('createdBy');
      expect(item).not.toHaveProperty('hasActiveAssignment');
    }
    const [first, second] = res.body.data;
    expect(first.projectName).toBe('Du an 1');
    expect(first.areaName).toBe('Khu A');
    expect(first.workTypeName).toBe('Do be tong');
    expect(first.requiredTradeName).toBe('Tho xay');
    expect(first.version).toBe(1);
    expect(second.areaId).toBeNull();
    // 7 row tiêu cực vắng mặt (assignment/expired/scheduled/READY/CANCELLED/P2/board-đóng)
    const ids = res.body.data.map((d: { id: string }) => d.id) as string[];
    for (const n of [3, 4, 5, 6, 7, 8, 9]) {
      expect(ids).not.toContain(woId(n));
    }
  });

  it('AC1: ADMIN thấy tất cả available gồm row P2 (3 items)', async () => {
    const token = await login('admin-e2e-jb@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data.map((d: { id: string }) => d.id)).toContain(woId(8));
  });

  it('AC4: offset pagination window chính xác (limit 1: 2 pages)', async () => {
    const token = await login('worker-e2e-jb@example.com');
    const p1 = await request(app.getHttpServer())
      .get('/api/v1/job-board?limit=1&offset=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(p1.body.total).toBe(2);
    expect(p1.body.data.map((d: { id: string }) => d.id)).toEqual([AVAIL1]);
    const p2 = await request(app.getHttpServer())
      .get('/api/v1/job-board?limit=1&offset=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(p2.body.total).toBe(2);
    expect(p2.body.data.map((d: { id: string }) => d.id)).toEqual([AVAIL2]);
  });

  it('AC6: limit/offset sai → 400 fieldErrors + message tiếng Việt', async () => {
    const token = await login('worker-e2e-jb@example.com');
    for (const q of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1']) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/job-board?${q}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      expect(res.body.fieldErrors).toBeDefined();
    }
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?limit=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.fieldErrors).toEqual({ limit: ['Limit không hợp lệ (1-100)'] });
  });

  it('AC5/BD4: unknown query key bị ignore (không 400, không mở quyền)', async () => {
    const token = await login('worker-e2e-jb@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board?foo=bar&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Không 400, không mở quyền: vẫn đúng 2 available P1
    expect(res.body.total).toBe(2);
    expect(res.body.limit).toBe(5);
    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual([AVAIL1, AVAIL2]);
  });

  it('JOB-SRS-006 (#46, BD12): projectId là filter thật — ngoài scope → 403 (không còn ignore)', async () => {
    const token = await login('worker-e2e-jb@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/job-board?projectId=${P2_OUTSIDE}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('AC3: list → chèn assignment → list lại: item biến, total giảm', async () => {
    const token = await login('worker-e2e-jb@example.com');
    const before = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body.total).toBe(2);
    // Mô phỏng claim (claim write là #47 — ở đây chèn trực tiếp vào store test)
    assignments.set(AVAIL1, 'PENDING_ACCEPTANCE');
    const after = await request(app.getHttpServer())
      .get('/api/v1/job-board')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.total).toBe(1);
    expect(after.body.data.map((d: { id: string }) => d.id)).toEqual([AVAIL2]);
    assignments.delete(AVAIL1);
  });

  it('AC7/BD8: 3 GET liên tiếp không đổi audit count (read-only, không ghi)', async () => {
    const token = await login('worker-e2e-jb@example.com');
    const auditBefore = auditLogWithClient.mock.calls.length + auditLog.mock.calls.length;
    await request(app.getHttpServer()).get('/api/v1/job-board').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/api/v1/job-board').set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get('/api/v1/job-board').set('Authorization', `Bearer ${token}`).expect(200);
    // Read path không có notification writer (SearchJobBoardUseCase chỉ phụ
    // thuộc repo + scope) và không gọi audit — delta phải bằng 0
    expect(auditLogWithClient.mock.calls.length + auditLog.mock.calls.length).toBe(auditBefore);
  });
});
