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
import { JOB_PUBLISH_CHECK_READ_PORT } from '../src/modules/job/domain/repository/work-order-publish-check.read-port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkOrderEntity, WorkOrderStatus } from '../src/modules/job/domain/entity/work-order.entity';
import { PublishCheckSnapshot } from '../src/modules/job/domain/service/work-order-publish-check.policy';

// JOB-SRS-004 (issue #44) — POST /api/v1/work-orders/:id/job-board/open+close
// INTEGRATION-IN-MEMORY (supertest qua Nest app với repository/read-port/
// tx/audit MOCK bằng Map + fakeTx + assignment store) — KHÔNG phải real-DB
// proof. Real-DB proof chỉ ở evidence driver S8/S9 + psql excerpts
// (`docs/evidence/job-srs-004/JOB-SRS-004-E2E.md`). KHÔNG cite file này như
// bằng chứng Postgres thật ở bất kỳ đâu (F018).
// Phạm vi AC (in-memory): AC1 open valid → OPEN/AVAILABLE + audit + history;
// AC2 thiếu data/assignment/cancelled/expired reject; AC3 close không hủy
// assignment; AC4 concurrent open 1 winner; AC5 matrix quyền; AC6 validation;
// AC7 double-submit idempotent; R3 PATCH không clobber board.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const ACTIVE_TYPE = '44444444-4444-4444-8444-444444444444';
const CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function woId(n: number): string {
  return `11111111-1111-4111-8111-1111111111${String(n).padStart(2, '0')}`;
}

describe('JOB-SRS-004 work-order job board (integration in-memory HTTP contract — mock repo, KHÔNG phải real-DB)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderEntity>();
  /** assignments hiện tại: woId → status (PENDING_ACCEPTANCE/ACTIVE = đang nhận). */
  const assignments = new Map<string, string>();
  const history: unknown[] = [];
  let auditLogWithClient: jest.Mock;

  function seed(
    status: WorkOrderStatus,
    n: number,
    over: { board?: boolean; schedule?: boolean } = {},
  ): string {
    const id = woId(n);
    const withSchedule = over.schedule ?? true;
    const board = over.board ?? false;
    const e = WorkOrderEntity.fromPersistence({
      id,
      code: `WO-E2E-B${n}`,
      projectId: P1,
      areaId: null,
      workTypeId: ACTIVE_TYPE,
      requiredTradeId: null,
      title: `Việc board ${n}`,
      description: 'Mô tả cũ',
      instructions: null,
      priority: 'NORMAL',
      status,
      plannedStartAt: withSchedule ? new Date('2026-10-01T08:00:00.000Z') : null,
      plannedEndAt: withSchedule ? new Date('2026-10-02T08:00:00.000Z') : null,
      dueAt: null,
      plannedHeadcount: null,
      customFields: {},
      jobBoardOpen: board,
      jobBoardOpenFrom: board ? new Date('2026-10-15T08:00:00.000Z') : null,
      jobBoardOpenUntil: board ? new Date('2026-12-15T08:00:00.000Z') : null,
      createdBy: PM_ID,
      version: 1,
      requestKey: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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
    process.env.JWT_SECRET = 'test-e2e-work-order-job-board-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-wob@example.com', makeUser(ADMIN_ID, 'admin-e2e-wob@example.com', hash)],
      ['pm-e2e-wob@example.com', makeUser(PM_ID, 'pm-e2e-wob@example.com', hash)],
      ['worker-e2e-wob@example.com', makeUser(WORKER_ID, 'worker-e2e-wob@example.com', hash)],
      ['outsider-e2e-wob@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-wob@example.com', hash)],
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
    const mockAudit = { log: jest.fn(async () => {}), logWithClient: auditLogWithClient };
    const txClient = { query: jest.fn(async () => ({ rowCount: 1 })) };
    const fakeTx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn(txClient) };

    const memberships = new Map<string, string>([
      [`${P1}:${PM_ID}`, 'MANAGER'],
      [`${P1}:${WORKER_ID}`, 'WORKER'],
    ]);
    const projects = new Set([P1]);
    const mockScope = {
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

    const isActiveAssignment = (id: string): boolean => {
      const s = assignments.get(id);
      return s === 'PENDING_ACCEPTANCE' || s === 'ACTIVE';
    };

    const mockWorkOrderRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByCode: jest.fn(async () => null),
      findByRequestKey: jest.fn(async () => null),
      findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
      hasActiveAssignmentByWorkOrderIds: jest.fn(async (ids: string[]) => new Set(ids.filter(isActiveAssignment))),
      // Mirror guarded UPDATE §1.2 (flag + status + version + NOT EXISTS).
      updateJobBoardWithClient: jest.fn(
        async (
          _c: unknown,
          input: {
            workOrderId: string;
            jobBoardOpen: boolean;
            jobBoardOpenFrom: Date | null;
            jobBoardOpenUntil: Date | null;
            toStatus: string;
            expectedVersion?: number | null;
          },
        ) => {
          const stored = store.get(input.workOrderId);
          if (!stored) return 0;
          if (input.expectedVersion !== undefined && input.expectedVersion !== null) {
            if (stored.version !== input.expectedVersion) return 0;
          }
          if (input.jobBoardOpen) {
            if (stored.jobBoardOpen) return 0;
            if (!['DRAFT', 'READY', 'OPEN'].includes(stored.status)) return 0;
            if (isActiveAssignment(input.workOrderId)) return 0;
            store.set(
              input.workOrderId,
              WorkOrderEntity.fromPersistence({
                ...stored.getProps(),
                jobBoardOpen: true,
                jobBoardOpenFrom: input.jobBoardOpenFrom,
                jobBoardOpenUntil: input.jobBoardOpenUntil,
                status: 'OPEN',
                version: stored.version + 1,
                updatedAt: new Date(),
              }),
            );
            return 1;
          }
          if (!stored.jobBoardOpen) return 0;
          if (stored.status === 'CANCELLED') return 0;
          store.set(
            input.workOrderId,
            WorkOrderEntity.fromPersistence({
              ...stored.getProps(),
              jobBoardOpen: false,
              status: stored.status === 'OPEN' ? 'READY' : stored.status,
              version: stored.version + 1,
              updatedAt: new Date(),
            }),
          );
          return 1;
        },
      ),
      insertStateHistoryWithClient: jest.fn(async (_c: unknown, p: unknown) => {
        history.push(p);
      }),
      // PATCH #43 mirror (giữ nguyên board props — R3).
      updateWithClient: jest.fn(async (_c: unknown, e: WorkOrderEntity, expectedVersion?: number) => {
        const stored = store.get(e.id);
        if (!stored) return 0;
        if (expectedVersion !== undefined && stored.version !== expectedVersion) return 0;
        store.set(e.id, e);
        return 1;
      }),
    };

    const mockPublishCheckRead = {
      fetchSnapshot: jest.fn(async (id: string): Promise<PublishCheckSnapshot | null> => {
        const e = store.get(id);
        if (!e) return null;
        const p = e.getProps();
        return {
          workOrder: {
            id: p.id,
            projectId: p.projectId,
            areaId: null,
            requiredTradeId: null,
            title: p.title,
            code: p.code,
            description: p.description,
            instructions: null,
            priority: 'NORMAL',
            status: p.status,
            plannedStartAt: p.plannedStartAt,
            plannedEndAt: p.plannedEndAt,
            plannedHeadcount: null,
            jobBoardOpen: p.jobBoardOpen,
            customFields: {},
          },
          project: { id: P1, status: 'ACTIVE' },
          workType: { id: ACTIVE_TYPE, isActive: true, requiredTradeId: null, requiredFieldsRaw: [] },
          area: null,
          workTypeTrade: null,
          workOrderTrade: null,
        };
      }),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(ProjectScopeService).useValue(mockScope)
      .overrideProvider(JOB_WORK_ORDER_REPOSITORY).useValue(mockWorkOrderRepo)
      .overrideProvider(JOB_PUBLISH_CHECK_READ_PORT).useValue(mockPublishCheckRead)
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

  function boardCalls(action: string): unknown[] {
    return auditLogWithClient.mock.calls
      .map((c) => c[1] as Record<string, unknown>)
      .filter((p) => p['action'] === action);
  }

  it('AC5: anon 401 / outsider 403 kể cả id missing / WORKER 403 / ADMIN+missing 404 / id sai 400 / correlation sai 400', async () => {
    const draftId = seed('DRAFT', 1);
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${draftId}/job-board/open`).send({}).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${draftId}/job-board/close`).send({}).expect(401);

    const outsiderToken = await login('outsider-e2e-wob@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${MISSING_ID}/job-board/open`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({})
      .expect(403);

    const workerToken = await login('worker-e2e-wob@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/close`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({})
      .expect(403);

    const adminToken = await login('admin-e2e-wob@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${MISSING_ID}/job-board/open`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(404);

    const pmToken = await login('pm-e2e-wob@example.com');
    await request(app.getHttpServer())
      .post('/api/v1/work-orders/not-a-uuid/job-board/open')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({})
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', 'not-a-uuid')
      .send({})
      .expect(400);
  });

  it('AC1: open DRAFT đủ điều kiện → 200 OPEN + jobBoard AVAILABLE + audit + history', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 2);
    const before = boardCalls('JOB_BOARD_OPENED').length;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', CORR)
      .send({ jobBoardOpenFrom: '2026-09-01T08:00:00.000Z', jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' })
      .expect(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.version).toBe(2);
    expect(res.body.jobBoard).toMatchObject({ open: true, state: 'AVAILABLE', hasActiveAssignment: false });
    expect(boardCalls('JOB_BOARD_OPENED')).toHaveLength(before + 1);
    const audit = boardCalls('JOB_BOARD_OPENED').at(-1) as Record<string, unknown>;
    expect(audit['beforeData']).toMatchObject({ status: 'DRAFT', jobBoardOpen: false, version: 1 });
    expect(audit['afterData']).toMatchObject({ status: 'OPEN', jobBoardOpen: true, version: 2 });
    expect(history.filter((h) => (h as { toStatus: string }).toStatus === 'OPEN')).toHaveLength(1);

    const get = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(get.body.jobBoard).toMatchObject({ open: true, state: 'AVAILABLE' });
  });

  it('AC2: thiếu schedule → 400 NOT_PUBLISHABLE; CANCELLED → 400; có assignment → 409; until quá khứ → 400', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');

    const noScheduleId = seed('DRAFT', 3, { schedule: false });
    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${noScheduleId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' })
      .expect(400);
    expect(r1.body.code).toBe('WORK_ORDER_NOT_PUBLISHABLE');
    expect(r1.body.unmet).toEqual(expect.any(Array));

    const cancelledId = seed('CANCELLED', 4);
    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${cancelledId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' })
      .expect(400);
    expect(r2.body.code).toBe('WORK_ORDER_STATUS_NOT_OPENABLE');

    const assignedId = seed('READY', 5);
    assignments.set(assignedId, 'ACTIVE');
    const r3 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${assignedId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' })
      .expect(409);
    expect(r3.body.code).toBe('JOB_BOARD_HAS_ASSIGNEE');
    assignments.delete(assignedId);

    const draftId = seed('DRAFT', 6);
    const r4 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: '2026-01-01T08:00:00.000Z', jobBoardOpenUntil: '2026-02-01T08:00:00.000Z' })
      .expect(400);
    expect(r4.body.code).toBe('JOB_BOARD_WINDOW_INVALID');
    expect(r4.body.fieldErrors.jobBoardOpenUntil).toEqual(expect.any(Array));
  });

  it('AC3: close không hủy assignment (row nguyên trạng) + audit CLOSED + OPEN→READY', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const openId = seed('OPEN', 7, { board: true });
    assignments.set(openId, 'ACTIVE');
    const before = boardCalls('JOB_BOARD_CLOSED').length;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${openId}/job-board/close`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ reason: 'Tạm dừng nhận việc' })
      .expect(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.jobBoard).toMatchObject({ open: false, state: 'ASSIGNED', hasActiveAssignment: true });
    expect(assignments.get(openId)).toBe('ACTIVE');
    expect(boardCalls('JOB_BOARD_CLOSED')).toHaveLength(before + 1);
    assignments.delete(openId);
  });

  it('AC4: concurrent open cùng window → 1 mutate + 1 alreadyOpen, đúng 1 audit', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 8);
    const before = boardCalls('JOB_BOARD_OPENED').length;
    const body = { jobBoardOpenFrom: '2026-10-15T08:00:00.000Z', jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' };
    const call = (): Promise<{ status: number; body: unknown }> =>
      request(app.getHttpServer())
        .post(`/api/v1/work-orders/${draftId}/job-board/open`)
        .set('Authorization', `Bearer ${pmToken}`)
        .send(body)
        .then((r) => ({ status: r.status, body: r.body }));
    const [a, b] = await Promise.all([call(), call()]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const bodies = [a.body, b.body] as Array<Record<string, unknown>>;
    expect(bodies.filter((x) => x['alreadyOpen'] === true)).toHaveLength(1);
    expect(boardCalls('JOB_BOARD_OPENED')).toHaveLength(before + 1);
    expect(store.get(draftId)?.version).toBe(2);
  });

  it('AC6: from>until → 400 fieldErrors; window khác khi đang mở → 409 ALREADY_OPEN', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 9);
    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: '2026-12-15T08:00:00.000Z', jobBoardOpenUntil: '2026-10-15T08:00:00.000Z' })
      .expect(400);
    expect(r1.body.code).toBe('JOB_BOARD_WINDOW_INVALID');

    const openId = seed('OPEN', 10, { board: true });
    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${openId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: '2026-10-15T08:00:00.000Z', jobBoardOpenUntil: '2026-11-30T08:00:00.000Z' })
      .expect(409);
    expect(r2.body.code).toBe('JOB_BOARD_ALREADY_OPEN');
  });

  it('AC7: double-submit cùng window → alreadyOpen, 1 audit, version +1 một lần; close ×2 → alreadyClosed', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 11);
    const body = { jobBoardOpenFrom: '2026-10-15T08:00:00.000Z', jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' };
    const before = boardCalls('JOB_BOARD_OPENED').length;
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(body)
      .expect(200);
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(body)
      .expect(200);
    expect(replay.body.alreadyOpen).toBe(true);
    expect(boardCalls('JOB_BOARD_OPENED')).toHaveLength(before + 1);
    expect(store.get(draftId)?.version).toBe(2);

    const closedBefore = boardCalls('JOB_BOARD_CLOSED').length;
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/close`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({})
      .expect(200);
    const replayClose = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/close`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({})
      .expect(200);
    expect(replayClose.body.alreadyClosed).toBe(true);
    expect(boardCalls('JOB_BOARD_CLOSED')).toHaveLength(closedBefore + 1);
  });

  it('F003: double-submit KHÔNG gửi from (server default now) → lần 2 alreadyOpen, audit 1 row', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 13);
    const before = boardCalls('JOB_BOARD_OPENED').length;
    const first = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({})
      .expect(200);
    expect(first.body.alreadyOpen).toBeUndefined();
    expect(first.body.jobBoard.open).toBe(true);
    const v0 = store.get(draftId)?.version;
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({})
      .expect(200);
    expect(replay.body.alreadyOpen).toBe(true);
    expect(replay.body.jobBoard.openFrom).toBe(first.body.jobBoard.openFrom);
    expect(store.get(draftId)?.version).toBe(v0);
    expect(boardCalls('JOB_BOARD_OPENED')).toHaveLength(before + 1);
  });

  it('F004: ISO +07:00 lưu đúng instant UTC; naive không offset → 400 WINDOW_INVALID', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 14);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: '2026-10-15T15:00:00+07:00', jobBoardOpenUntil: '2026-12-15T15:00:00+07:00' })
      .expect(200);
    expect(res.body.jobBoard.openFrom).toBe('2026-10-15T08:00:00.000Z');
    expect(res.body.jobBoard.openUntil).toBe('2026-12-15T08:00:00.000Z');

    const naiveId = seed('DRAFT', 15);
    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${naiveId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: '2026-10-15T08:00' })
      .expect(400);
    expect(r1.body.code).toBe('JOB_BOARD_WINDOW_INVALID');
    expect(r1.body.fieldErrors.jobBoardOpenFrom).toEqual(expect.any(Array));
    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${naiveId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: '2026-10-15T08:00:00.000Z', jobBoardOpenUntil: '2026-12-15' })
      .expect(400);
    expect(r2.body.code).toBe('JOB_BOARD_WINDOW_INVALID');
    expect(r2.body.fieldErrors.jobBoardOpenUntil).toEqual(expect.any(Array));
  });

  it('F005: body malformed qua ValidationPipe → 400 có code + fieldErrors (use-case single-validator)', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 16);

    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenFrom: 'not-a-date' })
      .expect(400);
    expect(r1.body.code).toBe('JOB_BOARD_WINDOW_INVALID');
    expect(r1.body.fieldErrors.jobBoardOpenFrom).toEqual(expect.any(Array));

    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ reason: 'x'.repeat(501) })
      .expect(400);
    expect(r2.body.code).toBe('JOB_BOARD_REASON_TOO_LONG');
    expect(r2.body.fieldErrors.reason).toEqual(expect.any(Array));

    const r3 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ expectedVersion: 0 })
      .expect(400);
    expect(r3.body.code).toBe('JOB_BOARD_VERSION_INVALID');
    expect(r3.body.fieldErrors.expectedVersion).toEqual(expect.any(Array));

    const r4 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/close`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ expectedVersion: 0 })
      .expect(400);
    expect(r4.body.code).toBe('JOB_BOARD_VERSION_INVALID');
    expect(r4.body.fieldErrors.expectedVersion).toEqual(expect.any(Array));

    const r4b = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/close`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ reason: 'y'.repeat(501) })
      .expect(400);
    expect(r4b.body.code).toBe('JOB_BOARD_REASON_TOO_LONG');
    expect(r4b.body.fieldErrors.reason).toEqual(expect.any(Array));

    // Field lạ vẫn bị whitelist chặn (400 stock Nest, không code — xem ENDPOINTS §19).
    const r5 = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ bogusProp: 1 })
      .expect(400);
    expect(r5.body.code).toBeUndefined();
  });

  it('R3: PATCH #43 sau open không clobber board (GET lại jobBoard.open=true)', async () => {
    const pmToken = await login('pm-e2e-wob@example.com');
    const draftId = seed('DRAFT', 12);
    await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${draftId}/job-board/open`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ jobBoardOpenUntil: '2026-12-15T08:00:00.000Z' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'Mô tả sau open' })
      .expect(200);
    const get = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(get.body.jobBoard).toMatchObject({ open: true, state: 'AVAILABLE' });
    expect(get.body.description).toBe('Mô tả sau open');
  });
});
