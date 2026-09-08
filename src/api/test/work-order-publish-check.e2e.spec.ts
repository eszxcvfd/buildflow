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
import { JOB_PUBLISH_CHECK_READ_PORT } from '../src/modules/job/domain/repository/work-order-publish-check.read-port';
import { PublishCheckSnapshot } from '../src/modules/job/domain/service/work-order-publish-check.policy';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';

// JOB-SRS-002 (issue #42) — publish-check HTTP contract (supertest, in-process,
// mocks qua overrideProvider như work-orders.e2e.spec):
// anon 401 / bad id 400 / DRAFT thiếu schedule → unmet cụ thể / đủ điều kiện
// → ready true / area khác project → AREA_INVALID / outsider 403 (kể cả id
// missing — no-leak) / ADMIN missing 404 / no-store / không audit nghiệp vụ.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';
const MISSING_WO = '00000000-0000-4000-8000-000000000000';

const WT_PLAIN = '44444444-4444-4444-8444-444444444444';
const AREA_P2 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

const WO_DRAFT_NOSCHED = '11111111-1111-4111-8111-111111111111';
const WO_READY = '22222222-1111-4111-8111-222222222222';
const WO_AREA_OTHER = '33333333-1111-4111-8111-333333333333';

function makeSnapshot(over: Partial<PublishCheckSnapshot['workOrder']> & { projectStatus?: string }): PublishCheckSnapshot {
  const { projectStatus, ...woOver } = over;
  return {
    workOrder: {
      id: WO_DRAFT_NOSCHED,
      projectId: P1,
      areaId: null,
      requiredTradeId: null,
      title: 'Đổ bê tông cột C1',
      code: 'WO-2026-A1',
      description: 'Mô tả',
      instructions: 'Hướng dẫn',
      priority: 'NORMAL',
      status: 'DRAFT',
      plannedStartAt: null,
      plannedEndAt: null,
      plannedHeadcount: 5,
      jobBoardOpen: false,
      ...woOver,
    },
    project: { id: P1, status: projectStatus ?? 'ACTIVE' },
    workType: { id: WT_PLAIN, isActive: true, requiredTradeId: null, requiredFieldsRaw: [] },
    area:
      woOver.areaId === AREA_P2
        ? { id: AREA_P2, projectId: P2, isActive: true }
        : null,
    workTypeTrade: null,
    workOrderTrade: null,
  };
}

describe('JOB-SRS-002 publish-check (e2e HTTP contract)', () => {
  let app: INestApplication;
  const snapshots = new Map<string, PublishCheckSnapshot>([
    [WO_DRAFT_NOSCHED, makeSnapshot({ id: WO_DRAFT_NOSCHED })],
    [
      WO_READY,
      makeSnapshot({
        id: WO_READY,
        code: 'WO-2026-B2',
        plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
        plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
      }),
    ],
    [WO_AREA_OTHER, makeSnapshot({ id: WO_AREA_OTHER, code: 'WO-2026-C3', areaId: AREA_P2 })],
  ]);
  const memberships = new Map<string, string>([
    [`${P1}:${PM_ID}`, 'MANAGER'],
    [`${P1}:${WORKER_ID}`, 'WORKER'],
  ]);
  const projects = new Set([P1, P2]);
  let auditLog: jest.Mock;

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
    process.env.JWT_SECRET = 'test-e2e-publish-check-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-pc@example.com', makeUser(ADMIN_ID, 'admin-e2e-pc@example.com', hash)],
      ['pm-e2e-pc@example.com', makeUser(PM_ID, 'pm-e2e-pc@example.com', hash)],
      ['worker-e2e-pc@example.com', makeUser(WORKER_ID, 'worker-e2e-pc@example.com', hash)],
      ['outsider-e2e-pc@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-pc@example.com', hash)],
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
    auditLog = jest.fn(async () => {});
    const mockAudit = { log: auditLog, logWithClient: jest.fn(async () => {}) };
    const fakeTx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never) };

    const mockScope = {
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

    const mockReadPort = {
      fetchSnapshot: jest.fn(async (id: string) => snapshots.get(id) ?? null),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(ProjectScopeService).useValue(mockScope)
      .overrideProvider(JOB_PUBLISH_CHECK_READ_PORT).useValue(mockReadPort)
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

  it('anon 401; id sai 400', async () => {
    await request(app.getHttpServer()).get(`/api/v1/work-orders/${WO_READY}/publish-check`).expect(401);
    const pmToken = await login('pm-e2e-pc@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/work-orders/not-a-uuid/publish-check')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(400);
  });

  it('DRAFT thiếu schedule → ready false + unmet MISSING_SCHEDULE cụ thể (no-store, checkedAt, không audit)', async () => {
    const pmToken = await login('pm-e2e-pc@example.com');
    const before = auditLog.mock.calls.length;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO_DRAFT_NOSCHED}/publish-check`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(res.body.workOrderId).toBe(WO_DRAFT_NOSCHED);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.ready).toBe(false);
    expect(res.body.unmet.map((u: { code: string }) => u.code)).toEqual([
      'MISSING_SCHEDULE',
      'MISSING_SCHEDULE',
    ]);
    expect(res.body.unmet[0].field).toBe('plannedStartAt');
    expect(res.body.unmet[1].field).toBe('plannedEndAt');
    expect(res.body.checkedAt).toBeDefined();
    expect(res.headers['cache-control']).toContain('no-store');
    // Check-only: không ghi audit nghiệp vụ cho lần check.
    expect(auditLog.mock.calls.length).toBe(before);
  });

  it('đủ điều kiện → ready true, unmet rỗng', async () => {
    const workerToken = await login('worker-e2e-pc@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO_READY}/publish-check`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.unmet).toEqual([]);
    expect(res.body.status).toBe('DRAFT');
  });

  it('area khác project → AREA_INVALID', async () => {
    const pmToken = await login('pm-e2e-pc@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO_AREA_OTHER}/publish-check`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(res.body.ready).toBe(false);
    expect(res.body.unmet.map((u: { code: string }) => u.code)).toContain('AREA_INVALID');
  });

  it('non-member 403 kể cả id missing (no-leak); ADMIN missing 404', async () => {
    const outsiderToken = await login('outsider-e2e-pc@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO_READY}/publish-check`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${MISSING_WO}/publish-check`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    const adminToken = await login('admin-e2e-pc@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${MISSING_WO}/publish-check`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    // ADMIN bypass đọc được WO tồn tại.
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO_READY}/publish-check`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
