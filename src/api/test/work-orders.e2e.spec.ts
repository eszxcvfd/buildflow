import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ForbiddenException, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { ProjectScopeService } from '../src/modules/iam/application/service/project-scope.service';
import { JOB_WORK_ORDER_REPOSITORY } from '../src/modules/job/domain/repository/work-order-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkOrderEntity } from '../src/modules/job/domain/entity/work-order.entity';

// JOB-SRS-001 (issue #41) — work-orders HTTP contract (supertest, in-process,
// mocks qua overrideProvider như các e2e spec hiện có):
// anon 401 / outsider 403 (kể cả project missing — J1 no-leak) / PM happy
// create→get (WORKER member đọc được nháp) / 409 code trùng / 400 workType
// inactive + area khác project + trade inactive / replay idempotent 200 +
// không audit mới / X-Correlation-Id sai 400 / ADMIN missing 404.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';
const MISSING_PROJECT = '00000000-0000-4000-8000-000000000000';

const ACTIVE_TYPE = '44444444-4444-4444-8444-444444444444';
const INACTIVE_TYPE = '66666666-6666-4666-8666-666666666666';
const AREA_P1 = '33333333-3333-4333-8333-333333333333';
const AREA_P2 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTIVE_TRADE = '55555555-5555-4555-8555-555555555555';
const INACTIVE_TRADE = '77777777-7777-4777-8777-777777777777';

describe('JOB-SRS-001 work-orders (e2e HTTP contract)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderEntity>();
  const memberships = new Map<string, string>([
    [`${P1}:${PM_ID}`, 'MANAGER'],
    [`${P1}:${WORKER_ID}`, 'WORKER'],
    [`${P2}:${PM_ID}`, 'COORDINATOR'],
  ]);
  const projects = new Set([P1, P2]);
  const projectStatuses = new Map<string, string>([
    [P1, 'ACTIVE'],
    [P2, 'ACTIVE'],
  ]);
  let auditLogWithClient: jest.Mock;

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
    process.env.JWT_SECRET = 'test-e2e-work-orders-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-wo@example.com', makeUser(ADMIN_ID, 'admin-e2e-wo@example.com', hash)],
      ['pm-e2e-wo@example.com', makeUser(PM_ID, 'pm-e2e-wo@example.com', hash)],
      ['worker-e2e-wo@example.com', makeUser(WORKER_ID, 'worker-e2e-wo@example.com', hash)],
      ['outsider-e2e-wo@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-wo@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PM_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'PM' }]],
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
    const mockAudit = {
      log: jest.fn(async () => {}),
      logWithClient: auditLogWithClient,
    };
    const fakeTx = {
      withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never),
    };

    const mockScope = {
      resolveAccessibleProjectIds: jest.fn(
        async ({ userId, actorRoles }: { userId: string; actorRoles: string[] }) => {
          if (actorRoles.includes('ADMIN')) return null;
          return [...memberships.keys()]
            .filter((k) => k.endsWith(`:${userId}`))
            .map((k) => k.split(':')[0]);
        },
      ),
      assertProjectWriteScope: jest.fn(
        async ({ userId, actorRoles, projectId }: { userId: string; actorRoles: string[]; projectId: string }) => {
          if (actorRoles.includes('ADMIN')) {
            if (!projects.has(projectId)) throw new NotFoundException('Không tìm thấy dự án');
            return { isAdminBypass: true };
          }
          const role = memberships.get(`${projectId}:${userId}`);
          if (role === 'MANAGER' || role === 'COORDINATOR') return { isAdminBypass: false };
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        },
      ),
      assertProjectMemberScope: jest.fn(
        async ({ userId, actorRoles, projectId }: { userId: string; actorRoles: string[]; projectId: string }) => {
          if (actorRoles.includes('ADMIN')) {
            if (!projects.has(projectId)) throw new NotFoundException('Không tìm thấy dự án');
            return { isAdminBypass: true };
          }
          if (memberships.has(`${projectId}:${userId}`)) return { isAdminBypass: false };
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        },
      ),
    };

    const mockWorkOrderRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByCode: jest.fn(async (code: string) => {
        const lowered = code.trim().toLowerCase();
        return [...store.values()].find((e) => e.code.toLowerCase() === lowered) ?? null;
      }),
      findByRequestKey: jest.fn(async (key: string) => {
        return [...store.values()].find((e) => e.requestKey === key) ?? null;
      }),
      findActiveWorkTypeById: jest.fn(async (id: string) => {
        if (id === INACTIVE_TYPE) return { id, isActive: false };
        if (id === ACTIVE_TYPE) return { id, isActive: true };
        return null;
      }),
      findActiveAreaById: jest.fn(async (id: string) => {
        if (id === AREA_P1) return { id, projectId: P1, isActive: true };
        if (id === AREA_P2) return { id, projectId: P2, isActive: true };
        return null;
      }),
      findActiveTradeById: jest.fn(async (id: string) => {
        if (id === INACTIVE_TRADE) return { id, isActive: false };
        if (id === ACTIVE_TRADE) return { id, isActive: true };
        return null;
      }),
      findWorkTypeNameById: jest.fn(async (id: string) => (id === ACTIVE_TYPE ? 'Đổ bê tông' : null)),
      findWorkTypeRefs: jest.fn(async (ids: string[]) => {
        const m = new Map<string, { id: string; code: string; name: string }>();
        for (const id of ids) {
          if (id === ACTIVE_TYPE) m.set(id, { id, code: 'WT-001', name: 'Đổ bê tông' });
        }
        return m;
      }),
      findProjectRefs: jest.fn(async (ids: string[]) => {
        const m = new Map<string, { id: string; code: string; name: string }>();
        for (const id of ids) {
          if (id === P1) m.set(id, { id, code: 'PRJ-001', name: 'Dự án 1' });
          if (id === P2) m.set(id, { id, code: 'PRJ-002', name: 'Dự án 2' });
        }
        return m;
      }),
      search: jest.fn(
        async (filter: {
          projectIds?: string[];
          projectId?: string;
          status?: string;
          search?: string;
          limit?: number;
          offset?: number;
        }) => {
          let rows = [...store.values()];
          if (filter.projectId) rows = rows.filter((e) => e.projectId === filter.projectId);
          else if (filter.projectIds) rows = rows.filter((e) => filter.projectIds!.includes(e.projectId));
          if (filter.status && filter.status !== 'ALL') rows = rows.filter((e) => e.status === filter.status);
          if (filter.search) {
            const term = filter.search.trim().toLowerCase();
            rows = rows.filter(
              (e) => e.code.toLowerCase().includes(term) || e.title.toLowerCase().includes(term),
            );
          }
          const total = rows.length;
          const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
          const offset = Math.max(filter.offset ?? 0, 0);
          return { entities: rows.slice(offset, offset + limit), total };
        },
      ),
      findProjectStatusById: jest.fn(async (id: string) => {
        const status = projectStatuses.get(id);
        return status ? { id, status } : null;
      }),
      create: jest.fn(async (e: WorkOrderEntity) => { store.set(e.id, e); }),
      createWithClient: jest.fn(async (_c: unknown, e: WorkOrderEntity) => { store.set(e.id, e); }),
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

  const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
  const REPLAY_KEY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let createdId = '';
  let createdCode = '';

  it('anon → 401; outsider (no membership) → 403 kể cả project missing (J1)', async () => {
    await request(app.getHttpServer()).get(`/api/v1/work-orders/${ACTIVE_TYPE}`).expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'X' })
      .expect(401);

    const outsiderToken = await login('outsider-e2e-wo@example.com');
    await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'X' })
      .expect(403);
    // J1 no-leak: project không tồn tại vẫn 403 (không 404) cho non-admin.
    await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ projectId: MISSING_PROJECT, workTypeId: ACTIVE_TYPE, title: 'X' })
      .expect(403);
  });

  it('PM happy: create → WORKER member get (nháp đọc được)', async () => {
    const pmToken = await login('pm-e2e-wo@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({
        projectId: P1,
        areaId: AREA_P1,
        workTypeId: ACTIVE_TYPE,
        requiredTradeId: ACTIVE_TRADE,
        title: 'Đổ bê tông cột C1',
        description: 'Mô tả',
        instructions: 'Hướng dẫn',
        priority: 'HIGH',
        plannedStartAt: '2026-10-01T08:00:00.000Z',
        plannedEndAt: '2026-10-02T08:00:00.000Z',
        plannedHeadcount: 5,
      })
      .expect(201);
    expect(created.body.code).toMatch(/^WO-/);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.version).toBe(1);
    expect(created.body.workTypeName).toBe('Đổ bê tông');
    expect(created.body.requestKey).toBeUndefined();
    createdId = created.body.id as string;
    createdCode = created.body.code as string;

    const workerToken = await login('worker-e2e-wo@example.com');
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${createdId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(detail.body.title).toBe('Đổ bê tông cột C1');
    expect(detail.body.status).toBe('DRAFT');
    expect(detail.headers['cache-control']).toContain('no-store');

    // Outsider GET id tồn tại → 403 (không phân biệt).
    const outsiderToken = await login('outsider-e2e-wo@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${createdId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('trùng code (CI) → 409 WORK_ORDER_CODE_DUPLICATE', async () => {
    const pmToken = await login('pm-e2e-wo@example.com');
    const res = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'Tên khác', code: createdCode.toLowerCase() })
      .expect(409);
    expect(res.body.code).toBe('WORK_ORDER_CODE_DUPLICATE');
  });

  it('workType INACTIVE → 400 workTypeId; area khác project → 400 areaId; trade INACTIVE → 400 requiredTradeId', async () => {
    const pmToken = await login('pm-e2e-wo@example.com');
    const r1 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ projectId: P1, workTypeId: INACTIVE_TYPE, title: 'X' })
      .expect(400);
    expect(r1.body.fieldErrors.workTypeId).toBeDefined();

    const r2 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, areaId: AREA_P2, title: 'X' })
      .expect(400);
    expect(r2.body.fieldErrors.areaId).toBeDefined();

    const r3 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'X', requiredTradeId: INACTIVE_TRADE })
      .expect(400);
    expect(r3.body.fieldErrors.requiredTradeId).toBeDefined();

    const r4 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        projectId: P1,
        workTypeId: ACTIVE_TYPE,
        title: 'X',
        plannedStartAt: '2026-10-02T08:00:00.000Z',
        plannedEndAt: '2026-10-01T08:00:00.000Z',
      })
      .expect(400);
    expect(r4.body.fieldErrors.plannedEndAt).toBeDefined();
  });

  it('requestKey replay → 200 existing + idempotentReplay, không audit mới', async () => {
    const pmToken = await login('pm-e2e-wo@example.com');
    const before = auditLogWithClient.mock.calls.length;
    const first = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'Việc replay', requestKey: REPLAY_KEY })
      .expect(201);
    expect(auditLogWithClient.mock.calls.length).toBe(before + 1);

    const second = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'Việc replay', requestKey: REPLAY_KEY })
      .expect(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.idempotentReplay).toBe(true);
    expect(auditLogWithClient.mock.calls.length).toBe(before + 1);
  });

  it('G3 project PAUSED/DRAFT → 400 WORK_ORDER_PROJECT_NOT_ACTIVE + fieldErrors projectId', async () => {
    const pmToken = await login('pm-e2e-wo@example.com');
    try {
      projectStatuses.set(P2, 'PAUSED');
      const r1 = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ projectId: P2, workTypeId: ACTIVE_TYPE, title: 'X' })
        .expect(400);
      expect(r1.body.code).toBe('WORK_ORDER_PROJECT_NOT_ACTIVE');
      expect(r1.body.fieldErrors.projectId).toBeDefined();

      projectStatuses.set(P2, 'DRAFT');
      const r2 = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({ projectId: P2, workTypeId: ACTIVE_TYPE, title: 'X' })
        .expect(400);
      expect(r2.body.code).toBe('WORK_ORDER_PROJECT_NOT_ACTIVE');
      expect(r2.body.fieldErrors.projectId).toBeDefined();
    } finally {
      projectStatuses.set(P2, 'ACTIVE');
    }
  });

  it('X-Correlation-Id sai → 400; ADMIN GET missing → 404', async () => {
    const pmToken = await login('pm-e2e-wo@example.com');
    await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', 'not-a-uuid')
      .send({ projectId: P1, workTypeId: ACTIVE_TYPE, title: 'X' })
      .expect(400);

    const adminToken = await login('admin-e2e-wo@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/work-orders/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('list: anon 401; non-admin chỉ WO project member; outsider membership rỗng → [] (không 403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/work-orders').expect(401);

    const pmToken = await login('pm-e2e-wo@example.com');
    // Seed 1 WO ở P2 (PM là COORDINATOR P2) để phân biệt scope.
    const p2wo = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ projectId: P2, workTypeId: ACTIVE_TYPE, title: 'Việc scope P2' })
      .expect(201);
    expect(p2wo.body.projectName).toBeUndefined();

    const workerToken = await login('worker-e2e-wo@example.com');
    const workerList = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(workerList.headers['cache-control']).toContain('no-store');
    expect(workerList.body.total).toBeGreaterThanOrEqual(1);
    for (const row of workerList.body.data as Array<{ projectId: string }>) {
      expect(row.projectId).toBe(P1);
    }
    expect(workerList.body.limit).toBe(20);
    expect(workerList.body.offset).toBe(0);

    const pmList = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(pmList.body.total).toBeGreaterThan(workerList.body.total);
    expect((pmList.body.data as Array<{ projectId: string }>).some((r) => r.projectId === P2)).toBe(true);

    const outsiderToken = await login('outsider-e2e-wo@example.com');
    const outsiderList = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200);
    expect(outsiderList.body).toMatchObject({ data: [], total: 0 });

    const adminToken = await login('admin-e2e-wo@example.com');
    const adminList = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.total).toBe(pmList.body.total);
  });

  it('list: projectId ngoài scope → 403; trong scope → lọc; query sai → 400', async () => {
    const workerToken = await login('worker-e2e-wo@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ projectId: P2 })
      .expect(403);

    const inScope = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ projectId: P1 })
      .expect(200);
    for (const row of inScope.body.data as Array<{ projectId: string }>) {
      expect(row.projectId).toBe(P1);
    }

    await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ projectId: 'not-a-uuid' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ status: 'WRONG' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ limit: '0' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ limit: '101' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${workerToken}`)
      .query({ offset: '-1' })
      .expect(400);
  });

  it('list: filter status/search + pagination limit/offset', async () => {
    const adminToken = await login('admin-e2e-wo@example.com');

    const drafts = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'DRAFT' })
      .expect(200);
    expect(drafts.body.total).toBeGreaterThanOrEqual(1);

    const open = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ status: 'OPEN' })
      .expect(200);
    expect(open.body).toMatchObject({ data: [], total: 0 });

    const byCode = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: createdCode.slice(0, 8) })
      .expect(200);
    expect(byCode.body.total).toBeGreaterThanOrEqual(1);

    const byTitle = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'scope p2' })
      .expect(200);
    expect(byTitle.body.total).toBe(1);
    expect(byTitle.body.data[0]).toMatchObject({
      projectId: P2,
      workTypeName: 'Đổ bê tông',
      projectName: 'Dự án 2',
    });

    const none = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ search: 'khong-ton-tai-xyz' })
      .expect(200);
    expect(none.body).toMatchObject({ data: [], total: 0 });

    const page1 = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ limit: '1', offset: '0' })
      .expect(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body).toMatchObject({ limit: 1, offset: 0 });
    expect(page1.body.total).toBeGreaterThan(1);

    const page2 = await request(app.getHttpServer())
      .get('/api/v1/work-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ limit: '1', offset: '1' })
      .expect(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
  });
});
