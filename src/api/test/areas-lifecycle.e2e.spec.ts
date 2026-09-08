import { Test } from '@nestjs/testing';
import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { ProjectScopeService } from '../src/modules/iam/application/service/project-scope.service';
import {
  PRJ_PROJECT_AREA_REPOSITORY,
  PRJ_PROJECT_REPOSITORY,
  ProjectAreaRow,
} from '../src/modules/prj/domain/repository/project-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { ProjectEntity } from '../src/modules/prj/domain/entity/project.entity';

// PRJ-SRS-007 (issue #38) — areas lifecycle HTTP contract (supertest,
// in-process, mocks qua overrideProvider như work-types.e2e.spec):
// anon 401 / WORKER write 403 / happy create→list→rename→deactivate→picker
// /active→repeat alreadyInactive / retire có WO mở → usage + warning /
// 409 AREA_DUPLICATE / X-Correlation-Id sai → 400 / audit PRJ_AREA_STATUS_CHANGED.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('PRJ-SRS-007 areas lifecycle (e2e HTTP contract)', () => {
  let app: INestApplication;
  const areaStore = new Map<string, ProjectAreaRow>();
  let openWorkOrders = 0;
  const mockAudit = {
    log: jest.fn(async () => {}),
    logWithClient: jest.fn(async () => {}),
  };

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

  function makeProject(): ProjectEntity {
    return new ProjectEntity({
      id: PROJECT_ID,
      code: 'PRJ-001',
      name: 'Dự án A',
      description: null,
      address: '123 Đường Láng',
      timezone: 'Asia/Ho_Chi_Minh',
      plannedStartDate: '2026-09-01',
      plannedEndDate: '2026-12-31',
      managerId: PM_ID,
      status: 'ACTIVE' as never,
      createdBy: ADMIN_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  function rowToStored(row: ProjectAreaRow): ProjectAreaRow {
    return { ...row };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-areas-lifecycle-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e@example.com', makeUser(ADMIN_ID, 'admin-e2e@example.com', hash)],
      ['pm-e2e@example.com', makeUser(PM_ID, 'pm-e2e@example.com', hash)],
      ['worker-e2e@example.com', makeUser(WORKER_ID, 'worker-e2e@example.com', hash)],
      ['outsider-e2e@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PM_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'PM' }]],
      [WORKER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
      [OUTSIDER_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'PM' }]],
    ]);
    // Membership trong PROJECT_ID: PM (COORDINATOR) + WORKER; outsider không member.
    const memberRoleByUser = new Map<string, string>([
      [PM_ID, 'COORDINATOR'],
      [WORKER_ID, 'WORKER'],
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

    const fakeTx = {
      withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never),
    };

    const mockScope = {
      assertProjectMemberScope: jest.fn(
        async (input: { userId: string; actorRoles?: string[] }) => {
          if ((input.actorRoles ?? []).includes('ADMIN')) return { isAdminBypass: true };
          if (memberRoleByUser.has(input.userId)) return { isAdminBypass: false };
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        },
      ),
      assertMemberScopeTxCheck: jest.fn((isAdminBypass: boolean, memberRole: string | null) => {
        if (!isAdminBypass && !memberRole) {
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        }
      }),
    };

    const project = makeProject();
    const mockProjectRepo = {
      findById: jest.fn(async (id: string) => (id === PROJECT_ID ? project : null)),
      findForUpdateWithClient: jest.fn(async (_c: unknown, id: string) =>
        id === PROJECT_ID ? { entity: project, managerName: null } : null,
      ),
      findActiveMemberWithClient: jest.fn(async (_c: unknown, projectId: string, userId: string) => {
        if (projectId !== PROJECT_ID) return null;
        const role = memberRoleByUser.get(userId);
        return role ? { projectRole: role } : null;
      }),
    };

    const now = () => new Date();
    const mockAreaRepo = {
      listAreas: jest.fn(async (filter: { projectId: string; activeOnly?: boolean }) => {
        let rows = [...areaStore.values()].filter((a) => a.projectId === filter.projectId);
        if (filter.activeOnly) rows = rows.filter((a) => a.isActive);
        else rows.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
        if (filter.activeOnly) rows.sort((a, b) => a.name.localeCompare(b.name));
        return rows.map(rowToStored);
      }),
      findAreaById: jest.fn(async (id: string) => {
        const row = areaStore.get(id);
        return row ? rowToStored(row) : null;
      }),
      findAreaForUpdateWithClient: jest.fn(async (_c: unknown, id: string) => {
        const row = areaStore.get(id);
        return row ? rowToStored(row) : null;
      }),
      findActiveAreaByNameWithClient: jest.fn(async (_c: unknown, projectId: string, name: string) => {
        const lowered = name.toLowerCase();
        const row = [...areaStore.values()].find(
          (a) => a.projectId === projectId && a.isActive && a.name.toLowerCase() === lowered,
        );
        return row ? rowToStored(row) : null;
      }),
      findAreaByCodeWithClient: jest.fn(async (_c: unknown, projectId: string, code: string) => {
        const row = [...areaStore.values()].find((a) => a.projectId === projectId && a.code === code);
        return row ? rowToStored(row) : null;
      }),
      insertAreaWithClient: jest.fn(
        async (_c: unknown, input: { projectId: string; code: string | null; name: string }) => {
          // UUID v4 hợp lệ cho ParseUUIDPipe ở :areaId.
          const n = areaStore.size + 1;
          const row: ProjectAreaRow = {
            id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`,
            projectId: input.projectId,
            code: input.code,
            name: input.name,
            isActive: true,
            createdAt: now(),
            updatedAt: now(),
          };
          areaStore.set(row.id, row);
          return rowToStored(row);
        },
      ),
      saveAreaWithClient: jest.fn(
        async (
          _c: unknown,
          input: { id: string; code: string | null; name: string; isActive: boolean },
        ) => {
          const row = areaStore.get(input.id);
          if (!row) return null;
          const next: ProjectAreaRow = {
            ...row,
            code: input.code,
            name: input.name,
            isActive: input.isActive,
            updatedAt: now(),
          };
          areaStore.set(next.id, next);
          return rowToStored(next);
        },
      ),
      // JOB module chưa tồn tại → điều khiển qua biến test (mặc định 0).
      countOpenWorkOrders: jest.fn(async () => openWorkOrders),
      isActiveProjectMember: jest.fn(async (projectId: string, userId: string) => {
        return projectId === PROJECT_ID && memberRoleByUser.has(userId);
      }),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(ProjectScopeService).useValue(mockScope)
      .overrideProvider(PRJ_PROJECT_REPOSITORY).useValue(mockProjectRepo)
      .overrideProvider(PRJ_PROJECT_AREA_REPOSITORY).useValue(mockAreaRepo)
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
  let createdId = '';

  it('anon → 401; WORKER write → 403; outsider PM → 403 scope', async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${PROJECT_ID}/areas`).expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .send({ name: 'Khu A' })
      .expect(401);

    const workerToken = await login('worker-e2e@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: 'Khu A' })
      .expect(403);

    const outsiderToken = await login('outsider-e2e@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('PM happy: create → list → rename → deactivate (STATUS audit) → picker /active → repeat alreadyInactive', async () => {
    const pmToken = await login('pm-e2e@example.com');

    const created = await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ code: 'KV-01', name: 'Khu A' })
      .expect(201);
    expect(created.body.code).toBe('KV-01');
    expect(created.body.isActive).toBe(true);
    createdId = created.body.id as string;

    const workerToken = await login('worker-e2e@example.com');
    const listed = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(listed.body.total).toBe(1);
    expect(listed.headers['cache-control']).toContain('no-store');

    const renamed = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT_ID}/areas/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ name: 'Khu A1' })
      .expect(200);
    expect(renamed.body.name).toBe('Khu A1');
    expect(renamed.body.usage).toBeUndefined();

    const deactivated = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT_ID}/areas/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ isActive: false, reason: 'Thu hẹp' })
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);
    expect(deactivated.body.alreadyInactive).toBe(false);
    expect(deactivated.body.usage).toEqual({ workOrders: 0 });
    expect(deactivated.body.warning).toBeUndefined();

    const statusAudits = (mockAudit.logWithClient as jest.Mock).mock.calls.filter(
      (c) => (c[1] as { action: string }).action === 'PRJ_AREA_STATUS_CHANGED',
    );
    expect(statusAudits.length).toBeGreaterThanOrEqual(1);
    expect(statusAudits[0][1]).toEqual(
      expect.objectContaining({ entityType: 'PROJECT', entityId: PROJECT_ID, reason: 'Thu hẹp' }),
    );

    const picker = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJECT_ID}/areas/active`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(picker.body.data.find((a: { id: string }) => a.id === createdId)).toBeUndefined();
    expect(picker.headers['cache-control']).toContain('no-store');

    const repeat = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJECT_ID}/areas/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ isActive: false })
      .expect(200);
    expect(repeat.body.alreadyInactive).toBe(true);
  });

  it('retire khi WO mở đang tham chiếu → usage + warning (không chặn)', async () => {
    const pmToken = await login('pm-e2e@example.com');
    const created = await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ code: 'KV-02', name: 'Khu B' })
      .expect(201);
    const areaId = created.body.id as string;

    openWorkOrders = 2;
    try {
      const retired = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${PROJECT_ID}/areas/${areaId}`)
        .set('Authorization', `Bearer ${pmToken}`)
        .set('X-Correlation-Id', VALID_CORR)
        .send({ isActive: false })
        .expect(200);
      expect(retired.body.isActive).toBe(false);
      expect(retired.body.usage).toEqual({ workOrders: 2 });
      expect(retired.body.warning).toBe('Khu vực đang được tham chiếu bởi Work Order đang hiệu lực');
    } finally {
      openWorkOrders = 0;
    }
  });

  it('trùng tên active (CI) → 409 AREA_DUPLICATE; X-Correlation-Id sai → 400', async () => {
    const pmToken = await login('pm-e2e@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Khu C' })
      .expect(201);
    const dup = await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'khu c' })
      .expect(409);
    expect(dup.body.code).toBe('AREA_DUPLICATE');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJECT_ID}/areas`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', 'not-a-uuid')
      .send({ name: 'Khu D' })
      .expect(400);
  });
});
