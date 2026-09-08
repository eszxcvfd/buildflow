import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { PROJECT_MEMBERSHIP_REPOSITORY } from '../src/modules/iam/domain/repository/project-membership-repository.port';
import { PROJECT_REPOSITORY } from '../src/modules/iam/domain/repository/project-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import {
  PRJ_PROJECT_REPOSITORY,
  PRJ_PROJECT_AREA_REPOSITORY,
  ProjectMemberRow,
} from '../src/modules/prj/domain/repository/project-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { ProjectEntity } from '../src/modules/prj/domain/entity/project.entity';

// PRJ-SRS-006 (issue #37) — kiểm soát truy cập dự án (HTTP contract, supertest,
// in-process, mocks qua overrideProvider như crew-members.e2e.spec.ts).
// Ma trận (member, non-member, admin, revoked) × từng endpoint có project id:
// - Tampering: PM của project A PATCH project B → 403, không leak (message
//   generic, project B không đổi).
// - Revoked member: request kế tiếp → 403.
// - Admin bypass: 200 + audit row PROJECT_SCOPE_ADMIN_BYPASS.
// - WORKER list chỉ thấy project mình; members READ mở cho mọi ACTIVE member;
//   members WRITE/PATCH/status cần MANAGER/COORDINATOR hoặc ADMIN.

const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const PMA_ID = '55555555-5555-5555-5555-555555555555';
const PMB_ID = '66666666-6666-6666-6666-666666666666';
const WORKERA_ID = '44444444-4444-4444-4444-444444444444';
const OUTSIDER_ID = '77777777-7777-4777-8777-777777777777';
const NEWUSER_ID = '88888888-8888-4888-8888-888888888888';
const PROJ_A = '11111111-1111-4111-8111-111111111111';
const PROJ_B = '22222222-2222-4222-8222-222222222222';
const MEMBER_WA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeUser(id: string, email: string, passwordHash: string, userType: 'STAFF' | 'WORKER' = 'STAFF'): UserEntity {
  return new UserEntity({
    id,
    email,
    passwordHash,
    fullName: `User ${email}`,
    employeeCode: null,
    userType,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeProject(id: string, code: string, managerId: string): ProjectEntity {
  return new ProjectEntity({
    id,
    code,
    name: `Project ${code}`,
    description: null,
    address: '123 Duong Lang',
    timezone: 'Asia/Ho_Chi_Minh',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-31',
    managerId,
    status: 'DRAFT',
    createdBy: ADMIN_ID,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function makeMemberRow(id: string, projectId: string, userId: string, projectRole: ProjectMemberRow['projectRole']): ProjectMemberRow {
  const joinedAt = new Date('2026-09-07T01:00:00.000Z');
  return {
    id,
    projectId,
    userId,
    projectRole,
    joinedAt,
    leftAt: null,
    isActive: true,
    addedBy: ADMIN_ID,
    createdAt: joinedAt,
    userName: `User ${userId.slice(0, 4)}`,
    userCode: null,
  };
}

describe('PRJ-SRS-006 project access (e2e HTTP contract)', () => {
  let app: INestApplication;
  let mockAudit: { log: jest.Mock; logWithClient: jest.Mock };
  // membership state: `${userId}:${projectId}` → project_role (xóa = revoked)
  let memberships: Map<string, string>;
  let projectsById: Map<string, ProjectEntity>;
  let membersById: Map<string, ProjectMemberRow>;
  let memberSeq = 0;

  function roleOf(userId: string, projectId: string): string | null {
    return memberships.get(`${userId}:${projectId}`) ?? null;
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-project-access-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const usersById = new Map<string, UserEntity>([
      [ADMIN_ID, makeUser(ADMIN_ID, 'admin-pa@example.com', hash)],
      [PMA_ID, makeUser(PMA_ID, 'pma@example.com', hash)],
      [PMB_ID, makeUser(PMB_ID, 'pmb@example.com', hash)],
      [WORKERA_ID, makeUser(WORKERA_ID, 'workera@example.com', hash, 'WORKER')],
      [OUTSIDER_ID, makeUser(OUTSIDER_ID, 'outsider@example.com', hash, 'WORKER')],
      [NEWUSER_ID, makeUser(NEWUSER_ID, 'newuser@example.com', hash, 'WORKER')],
    ]);
    const byEmail = new Map<string, UserEntity>(
      [...usersById.values()].map((u) => [u.email.toLowerCase(), u]),
    );
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PMA_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'Project Manager' }]],
      [PMB_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'Project Manager' }]],
      [WORKERA_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
      [OUTSIDER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
      [NEWUSER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
    ]);

    memberships = new Map<string, string>([
      [`${PMA_ID}:${PROJ_A}`, 'MANAGER'],
      [`${PMB_ID}:${PROJ_B}`, 'MANAGER'],
      [`${WORKERA_ID}:${PROJ_A}`, 'WORKER'],
    ]);
    projectsById = new Map<string, ProjectEntity>([
      [PROJ_A, makeProject(PROJ_A, 'PRJ-A', PMA_ID)],
      [PROJ_B, makeProject(PROJ_B, 'PRJ-B', PMB_ID)],
    ]);
    membersById = new Map<string, ProjectMemberRow>([
      [MEMBER_WA, makeMemberRow(MEMBER_WA, PROJ_A, WORKERA_ID, 'WORKER')],
    ]);

    const mockUserRepo = {
      findByEmail: jest.fn(async (email: string) => byEmail.get(email.toLowerCase()) ?? null),
      findById: jest.fn(async (id: string) => usersById.get(id) ?? null),
      save: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      findActiveRolesByUserId: jest.fn(async (id: string) => rolesByUser.get(id) ?? []),
      findActiveProjectIdsByUserId: jest.fn(async (id: string) => {
        const ids: string[] = [];
        for (const [key] of memberships) {
          const [uid, pid] = key.split(':');
          if (uid === id) ids.push(pid);
        }
        return ids;
      }),
    };

    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hashStr: string) => bcrypt.compare(plain, hashStr),
    };

    mockAudit = { log: jest.fn(async () => {}), logWithClient: jest.fn(async () => {}) };
    const fakeTx = {
      withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never),
    };

    // iam scope ports — đọc cùng `memberships` state (revoke giữa test thấy ngay).
    const mockMembershipRepo = {
      isMember: jest.fn(async (userId: string, projectId: string) => roleOf(userId, projectId) !== null),
      findActiveProjectIdsByUserId: jest.fn(async (userId: string) => {
        const ids: string[] = [];
        for (const [key] of memberships) {
          const [uid, pid] = key.split(':');
          if (uid === userId) ids.push(pid);
        }
        return ids;
      }),
      findActiveMemberUserIdsByProjectId: jest.fn(async (projectId: string) => {
        const ids: string[] = [];
        for (const [key] of memberships) {
          const [uid, pid] = key.split(':');
          if (pid === projectId) ids.push(uid);
        }
        return ids;
      }),
      findActiveProjectRole: jest.fn(async (userId: string, projectId: string) => roleOf(userId, projectId)),
    };
    const mockIamProjectRepo = {
      findById: jest.fn(async (id: string) => projectsById.get(id) ?? null),
      findByIds: jest.fn(async (ids: string[]) => ids.map((id) => projectsById.get(id)).filter(Boolean)),
      findAll: jest.fn(async () => [...projectsById.values()]),
      exists: jest.fn(async (id: string) => projectsById.has(id)),
    };

    const profileOf = (id: string): { entity: ProjectEntity; managerName: string | null } | null => {
      const entity = projectsById.get(id);
      if (!entity) return null;
      return { entity, managerName: `Manager of ${entity.code}` };
    };

    // prj repo — cùng `memberships`/`membersById` state để revoke mid-flight thấy ngay.
    const mockPrjRepo = {
      findById: jest.fn(async (id: string) => projectsById.get(id) ?? null),
      findByCode: jest.fn(async () => null),
      findProfileById: jest.fn(async (id: string) => profileOf(id)),
      findForUpdateWithClient: jest.fn(async (_c: unknown, id: string) => profileOf(id)),
      findManagerNameWithClient: jest.fn(async () => 'Manager X'),
      createWithClient: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      insertManagerMembershipWithClient: jest.fn(async () => {}),
      listMembers: jest.fn(async (filter: { projectId: string; includeInactive?: boolean }) => {
        const rows = [...membersById.values()].filter(
          (m) => m.projectId === filter.projectId && (filter.includeInactive || m.isActive),
        );
        return rows.sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1));
      }),
      listMembersWithClient: jest.fn(async () => []),
      findMemberByIdWithClient: jest.fn(async (_c: unknown, id: string) => membersById.get(id) ?? null),
      findActiveMemberWithClient: jest.fn(async (_c: unknown, projectId: string, userId: string) => {
        const role = roleOf(userId, projectId);
        if (!role) return null;
        return {
          id: `m-${userId.slice(0, 8)}`,
          projectId,
          userId,
          projectRole: role,
          joinedAt: new Date('2026-09-07T01:00:00.000Z'),
          leftAt: null,
          isActive: true,
          addedBy: ADMIN_ID,
          createdAt: new Date('2026-09-07T01:00:00.000Z'),
        } as ProjectMemberRow;
      }),
      insertMemberWithClient: jest.fn(async (_c: unknown, input: { projectId: string; userId: string; projectRole: string; addedBy: string }) => {
        memberSeq += 1;
        const seq = String(memberSeq).padStart(2, '0');
        const row = makeMemberRow(
          `c00000${seq}-0000-4000-8000-0000000000${seq}`,
          input.projectId,
          input.userId,
          input.projectRole as ProjectMemberRow['projectRole'],
        );
        membersById.set(row.id, row);
        memberships.set(`${input.userId}:${input.projectId}`, input.projectRole);
        return row;
      }),
      deactivateMemberWithClient: jest.fn(async (_c: unknown, id: string) => {
        const row = membersById.get(id);
        if (!row) return null;
        row.isActive = false;
        row.leftAt = new Date();
        memberships.delete(`${row.userId}:${row.projectId}`);
        return row;
      }),
    };

    const mockAreaRepo = {
      listAreas: jest.fn(async () => []),
      findAreaById: jest.fn(async () => null),
      findAreaForUpdateWithClient: jest.fn(async () => null),
      findActiveAreaByNameWithClient: jest.fn(async () => null),
      findAreaByCodeWithClient: jest.fn(async () => null),
      insertAreaWithClient: jest.fn(async () => null),
      saveAreaWithClient: jest.fn(async () => null),
      isActiveProjectMember: jest.fn(async (projectId: string, userId: string) => roleOf(userId, projectId) !== null),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(PROJECT_MEMBERSHIP_REPOSITORY).useValue(mockMembershipRepo)
      .overrideProvider(PROJECT_REPOSITORY).useValue(mockIamProjectRepo)
      .overrideProvider(PRJ_PROJECT_REPOSITORY).useValue(mockPrjRepo)
      .overrideProvider(PRJ_PROJECT_AREA_REPOSITORY).useValue(mockAreaRepo)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('tampering: PM của A PATCH project B → 403 generic, B không đổi + DENIED audit', async () => {
    const token = await login('pma@example.com');
    mockAudit.log.mockClear();
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_B}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Đổi trộm' })
      .expect(403);
    expect(res.body.message).toBe('Không có quyền truy cập dự án này');
    expect(projectsById.get(PROJ_B)?.name).toBe('Project PRJ-B');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROJECT_SCOPE_DENIED', entityId: PROJ_B, result: 'FAILED' }),
    );
    // UUID lạ (không tồn tại) cũng 403 y hệt — không phân biệt tồn tại/không.
    const ghost = await request(app.getHttpServer())
      .patch('/api/v1/projects/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Đổi trộm' })
      .expect(403);
    expect(ghost.body.message).toBe(res.body.message);
  });

  it('member MANAGER PATCH project mình → 200', async () => {
    const token = await login('pma@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project PRJ-A Updated' })
      .expect(200);
    expect(res.body.name).toBe('Project PRJ-A Updated');
  });

  it('WORKER của project: PATCH → 403; GET detail + GET members → 200', async () => {
    const token = await login('workera@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Worker đổi trộm' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJ_A}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const members = await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJ_A}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(members.body.total).toBeGreaterThanOrEqual(1);
  });

  it('non-member: GET members + PATCH + PATCH status → 403', async () => {
    const token = await login('outsider@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJ_A}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'ACTIVATE' })
      .expect(403);
  });

  it('members write: MANAGER project A add/remove → 201/200; PM của B xen vào A → 403', async () => {
    const tokenA = await login('pma@example.com');
    const added = await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJ_A}/members`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ userId: NEWUSER_ID, projectRole: 'WORKER' })
      .expect(201);
    expect(added.body.userId).toBe(NEWUSER_ID);

    const tokenB = await login('pmb@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${PROJ_A}/members`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ userId: OUTSIDER_ID, projectRole: 'WORKER' })
      .expect(403);

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/projects/${PROJ_A}/members/${added.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(removed.body.alreadyRemoved).toBe(false);
  });

  it('status: MANAGER project A ACTIVATE → 200; PM của B → 403', async () => {
    const tokenA = await login('pma@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ action: 'ACTIVATE' })
      .expect(200);
    expect(res.body.alreadyInState).toBe(false);

    const tokenB = await login('pmb@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}/status`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ action: 'PAUSE', reason: 'Ly do xen vao' })
      .expect(403);
  });

  it('revoked member: request kế tiếp → 403 (GET members + PATCH)', async () => {
    const token = await login('workera@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJ_A}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    // Revoke mid-flight: xóa membership trực tiếp (như remove-member đã commit).
    memberships.delete(`${WORKERA_ID}:${PROJ_A}`);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJ_A}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_A}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' })
      .expect(403);
  });

  it('admin bypass: PATCH + GET members project B → 200 + audit PROJECT_SCOPE_ADMIN_BYPASS', async () => {
    const token = await login('admin-pa@example.com');
    mockAudit.log.mockClear();
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${PROJ_B}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Admin edit' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${PROJ_B}/members`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const bypasses = mockAudit.log.mock.calls.filter((c) => c[0]?.action === 'PROJECT_SCOPE_ADMIN_BYPASS');
    expect(bypasses.length).toBeGreaterThanOrEqual(2);
    expect(bypasses[0][0]).toEqual(expect.objectContaining({ entityId: PROJ_B, result: 'SUCCESS' }));
  });

  it('WORKER list chỉ thấy project mình; ADMIN thấy tất cả', async () => {
    // Khôi phục membership WORKER-A (đã revoke ở test trước) để list ổn định.
    memberships.set(`${WORKERA_ID}:${PROJ_A}`, 'WORKER');
    const workerToken = await login('workera@example.com');
    const listed = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    const codes = (listed.body as Array<{ code: string }>).map((p) => p.code);
    expect(codes).toContain('PRJ-A');
    expect(codes).not.toContain('PRJ-B');

    const adminToken = await login('admin-pa@example.com');
    const all = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const allCodes = (all.body as Array<{ code: string }>).map((p) => p.code);
    expect(allCodes).toEqual(expect.arrayContaining(['PRJ-A', 'PRJ-B']));
  });
});
