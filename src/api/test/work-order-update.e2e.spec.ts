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
import { WorkOrderEntity, WorkOrderStatus } from '../src/modules/job/domain/entity/work-order.entity';

// JOB-SRS-003 (issue #43) — PATCH /api/v1/work-orders/:id (supertest, mocks như
// work-orders.e2e.spec.ts): anon 401 / outsider 403 (kể cả id missing) / WORKER
// member 403 (write-scope) / DRAFT happy + dueAt / OPEN schedule 400 FIELD_LOCKED
// / ASSIGNED schedule + reason 200 + notification row + audit before/after /
// WORK_DONE non-admin 400 + ADMIN thiếu reason 400 + ADMIN+reason 200 EXCEPTION /
// 409 version stale + SQL guard / ADMIN missing 404 / validation refs + range.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

const ACTIVE_TYPE = '44444444-4444-4444-8444-444444444444';
const OTHER_TYPE = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const ACTIVE_TRADE = '55555555-5555-4555-8555-555555555555';
const OTHER_TRADE = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb';

function woId(n: number): string {
  return `11111111-1111-4111-8111-1111111111${String(n).padStart(2, '0')}`;
}

describe('JOB-SRS-003 work-order update (e2e HTTP contract)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderEntity>();
  const notifications: Array<{ text: string; params: unknown[] }> = [];
  const memberships = new Map<string, string>([
    [`${P1}:${PM_ID}`, 'MANAGER'],
    [`${P1}:${WORKER_ID}`, 'WORKER'],
  ]);
  const projects = new Set([P1]);
  let auditLogWithClient: jest.Mock;

  function seed(status: WorkOrderStatus, n: number): string {
    const id = woId(n);
    const e = WorkOrderEntity.fromPersistence({
      id,
      code: `WO-E2E-U${n}`,
      projectId: P1,
      areaId: null,
      workTypeId: ACTIVE_TYPE,
      requiredTradeId: null,
      title: `Việc ${n}`,
      description: 'Mô tả cũ',
      instructions: null,
      priority: 'NORMAL',
      status,
      plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
      plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
      dueAt: null,
      plannedHeadcount: null,
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
    process.env.JWT_SECRET = 'test-e2e-work-order-update-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-wou@example.com', makeUser(ADMIN_ID, 'admin-e2e-wou@example.com', hash)],
      ['pm-e2e-wou@example.com', makeUser(PM_ID, 'pm-e2e-wou@example.com', hash)],
      ['worker-e2e-wou@example.com', makeUser(WORKER_ID, 'worker-e2e-wou@example.com', hash)],
      ['outsider-e2e-wou@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-wou@example.com', hash)],
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
    const txClient = {
      query: jest.fn(async (text: string, params: unknown[]) => {
        notifications.push({ text, params });
        return { rowCount: 1 };
      }),
    };
    const fakeTx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn(txClient) };

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

    const mockWorkOrderRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByCode: jest.fn(async () => null),
      findByRequestKey: jest.fn(async () => null),
      findActiveWorkTypeById: jest.fn(async (id: string) => {
        if (id === ACTIVE_TYPE || id === OTHER_TYPE) return { id, isActive: true };
        return null;
      }),
      findActiveAreaById: jest.fn(async () => null),
      findActiveTradeById: jest.fn(async (id: string) => {
        if (id === ACTIVE_TRADE || id === OTHER_TRADE) return { id, isActive: true };
        return null;
      }),
      findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
      findProjectStatusById: jest.fn(async (id: string) => ({ id, status: 'ACTIVE' })),
      create: jest.fn(async (e: WorkOrderEntity) => { store.set(e.id, e); }),
      createWithClient: jest.fn(async (_c: unknown, e: WorkOrderEntity) => { store.set(e.id, e); }),
      // Mirror SQL guard: expectedVersion lệch stored → 0 dòng (409 ở use case).
      updateWithClient: jest.fn(async (_c: unknown, e: WorkOrderEntity, expectedVersion?: number) => {
        const stored = store.get(e.id);
        if (!stored) return 0;
        if (expectedVersion !== undefined && stored.version !== expectedVersion) return 0;
        store.set(e.id, e);
        return 1;
      }),
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

  it('anon 401; outsider 403 kể cả id missing; WORKER member 403 (write-scope)', async () => {
    const draftId = seed('DRAFT', 1);
    await request(app.getHttpServer()).patch(`/api/v1/work-orders/${draftId}`).send({ description: 'X' }).expect(401);

    const outsiderToken = await login('outsider-e2e-wou@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ description: 'X' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${MISSING_ID}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ description: 'X' })
      .expect(403);

    const workerToken = await login('worker-e2e-wou@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ description: 'X' })
      .expect(403);
  });

  it('DRAFT happy: description + priority + dueAt → 200 version 2; GET phản ánh', async () => {
    const pmToken = await login('pm-e2e-wou@example.com');
    const draftId = seed('DRAFT', 2);
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        description: 'Mô tả mới',
        priority: 'HIGH',
        dueAt: '2026-12-01T08:00:00.000Z',
        expectedVersion: 1,
      })
      .expect(200);
    expect(res.body.version).toBe(2);
    expect(res.body.description).toBe('Mô tả mới');
    expect(res.body.priority).toBe('HIGH');
    expect(res.body.dueAt).toBe('2026-12-01T08:00:00.000Z');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(detail.body.description).toBe('Mô tả mới');
    expect(detail.body.version).toBe(2);
  });

  it('OPEN đổi schedule → 400 FIELD_LOCKED; đổi description → 200', async () => {
    const pmToken = await login('pm-e2e-wou@example.com');
    const openId = seed('OPEN', 3);
    const locked = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${openId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ plannedStartAt: '2026-11-01T08:00:00.000Z' })
      .expect(400);
    expect(locked.body.code).toBe('WORK_ORDER_FIELD_LOCKED');
    expect(locked.body.fieldErrors.plannedStartAt).toBeDefined();

    const ok = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${openId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'Sửa mô tả khi OPEN' })
      .expect(200);
    expect(ok.body.version).toBe(2);
  });

  it('ASSIGNED đổi schedule thiếu reason → 400; kèm reason → 200 + notification row + audit before/after', async () => {
    const pmToken = await login('pm-e2e-wou@example.com');
    const assignedId = seed('ASSIGNED', 4);
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${assignedId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ plannedEndAt: '2026-10-05T08:00:00.000Z' })
      .expect(400);

    const auditBefore = auditLogWithClient.mock.calls.length;
    const notifBefore = notifications.filter((n) => n.text.includes('notifications')).length;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${assignedId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ plannedEndAt: '2026-10-05T08:00:00.000Z', reason: 'Dời lịch theo yêu cầu CĐT' })
      .expect(200);
    expect(res.body.version).toBe(2);
    expect(res.body.plannedEndAt).toBe('2026-10-05T08:00:00.000Z');

    expect(auditLogWithClient.mock.calls.length).toBe(auditBefore + 1);
    const payload = auditLogWithClient.mock.calls[auditBefore][1] as Record<string, unknown>;
    expect(payload['action']).toBe('JOB_WORK_ORDER_UPDATED');
    expect(payload['beforeData']).toEqual({ plannedEndAt: '2026-10-02T08:00:00.000Z' });
    expect(payload['afterData']).toEqual({ plannedEndAt: '2026-10-05T08:00:00.000Z' });

    const newNotifs = notifications.filter((n) => n.text.includes('notifications'));
    expect(newNotifs.length).toBe(notifBefore + 1);
    const lastNotif = newNotifs[newNotifs.length - 1];
    expect(lastNotif.params[0]).toBe(PM_ID);
    expect(String(lastNotif.params[6])).toMatch(/^woupd-[0-9a-f]{64}$/);
  });

  it('WORK_DONE: PM 400; ADMIN thiếu reason 400; ADMIN + reason → 200 EXCEPTION audit', async () => {
    const pmToken = await login('pm-e2e-wou@example.com');
    const adminToken = await login('admin-e2e-wou@example.com');
    const doneId = seed('WORK_DONE', 5);

    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${doneId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'PM sửa sau hoàn tất' })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${doneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Thiếu lý do' })
      .expect(400);

    const auditBefore = auditLogWithClient.mock.calls.length;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${doneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Hiệu chỉnh ngoại lệ', reason: 'Sửa sai mã cần hiệu chỉnh' })
      .expect(200);
    expect(res.body.version).toBe(2);
    const payload = auditLogWithClient.mock.calls[auditBefore][1] as Record<string, unknown>;
    expect(payload['action']).toBe('WORK_ORDER_EXCEPTION_EDIT');
    expect(payload['beforeData']).toEqual({ description: 'Mô tả cũ' });
    expect(payload['afterData']).toEqual({ description: 'Hiệu chỉnh ngoại lệ' });
  });

  it('expectedVersion stale → 409 WORK_ORDER_CONFLICT; ADMIN PATCH missing → 404', async () => {
    const pmToken = await login('pm-e2e-wou@example.com');
    const draftId = seed('DRAFT', 6);
    const conflict = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ description: 'Stale', expectedVersion: 99 })
      .expect(409);
    expect(conflict.body.code).toBe('WORK_ORDER_CONFLICT');

    const adminToken = await login('admin-e2e-wou@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${MISSING_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'X' })
      .expect(404);
  });

  it('validation: workType lạ → 400; schedule range sai → 400 plannedEndAt', async () => {
    const pmToken = await login('pm-e2e-wou@example.com');
    const draftId = seed('DRAFT', 7);
    const r1 = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ workTypeId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
      .expect(400);
    expect(r1.body.fieldErrors.workTypeId).toBeDefined();

    // UUID sai format bị DTO chặn trước (400 không fieldErrors custom — vẫn 400).
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${draftId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ plannedStartAt: '2026-10-05T08:00:00.000Z', plannedEndAt: '2026-10-01T08:00:00.000Z' })
      .expect(400);
  });
});
