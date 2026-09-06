import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { WORKER_REPOSITORY } from '../src/modules/org/domain/repository/worker-repository.port';
import { CREW_REPOSITORY, CrewMemberRow } from '../src/modules/org/domain/repository/crew-repository.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { CrewEntity } from '../src/modules/org/domain/entity/crew.entity';

// ORG-SRS-007 (issue #30) — crew members HTTP contract (supertest, in-process,
// mocks qua overrideProvider như resource-directory.e2e.spec.ts):
// role matrix ADMIN+PM read+write / WORKER 403 / anon 401, validation fieldErrors,
// double-submit 409, double-remove alreadyRemoved, overlap WARN, inactive crew 409,
// workers ?crewId= filter (D9 defer resolved).

const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const PM_ID = '55555555-5555-5555-5555-555555555555';
const WORKER_LOGIN_ID = '44444444-4444-4444-4444-444444444444';
const CREW_A = '11111111-1111-4111-8111-111111111111';
const CREW_B = '22222222-2222-4222-8222-222222222222';
const CREW_OFF = '33333333-3333-4333-8333-333333333333';
const U1 = 'a1111111-1111-4111-8111-111111111111';
const U2 = 'a2222222-2222-4222-8222-222222222222';
const U3 = 'a3333333-3333-4333-8333-333333333333';
const U4 = 'a4444444-4444-4333-8333-444444444444';

function makeUser(id: string, email: string, passwordHash: string, extra: Record<string, unknown> = {}): UserEntity {
  return new UserEntity({
    id,
    email,
    passwordHash,
    fullName: (extra.fullName as string) ?? 'E2E User',
    employeeCode: (extra.employeeCode as string | null) ?? null,
    userType: (extra.userType as 'STAFF' | 'WORKER') ?? 'STAFF',
    status: (extra.status as 'ACTIVE' | 'INACTIVE' | 'LOCKED') ?? 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeCrew(id: string, code: string, status: 'ACTIVE' | 'INACTIVE'): CrewEntity {
  return new CrewEntity({
    id,
    code,
    name: `Đội ${code}`,
    status,
    leaderUserId: null,
    createdBy: ADMIN_ID,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

interface MemInput { crewId: string; userId: string; effectiveFrom: string; addedBy: string }

describe('ORG-SRS-007 crew members (e2e HTTP contract)', () => {
  let app: INestApplication;
  let members: CrewMemberRow[];
  let memberSeq = 0;
  let mockAudit: { log: jest.Mock; logWithClient: jest.Mock };
  let workerFindMany: jest.Mock;
  let usersById: Map<string, UserEntity>;
  let crewsById: Map<string, CrewEntity>;

  function userLabel(id: string): { name: string | null; code: string | null } {
    const u = usersById.get(id);
    return { name: u ? u.fullName : null, code: u ? (u.employeeCode ?? null) : null };
  }

  function seedOverlapMember(): void {
    const label = userLabel(U2);
    members.push({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      crewId: CREW_B,
      userId: U2,
      memberRole: 'MEMBER',
      effectiveFrom: '2026-08-20',
      effectiveTo: null,
      isActive: true,
      addedBy: ADMIN_ID,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
      userName: label.name,
      userCode: label.code,
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-crew-members-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    usersById = new Map<string, UserEntity>([
      [ADMIN_ID, makeUser(ADMIN_ID, 'admin-e2e@example.com', hash)],
      [PM_ID, makeUser(PM_ID, 'pm-e2e@example.com', hash)],
      [WORKER_LOGIN_ID, makeUser(WORKER_LOGIN_ID, 'worker-e2e@example.com', hash)],
      [U1, makeUser(U1, 'u1@example.com', hash, { fullName: 'Member One', employeeCode: 'EMP-1', userType: 'WORKER' })],
      [U2, makeUser(U2, 'u2@example.com', hash, { fullName: 'Member Two', employeeCode: 'EMP-2', userType: 'WORKER' })],
      [U3, makeUser(U3, 'u3@example.com', hash, { fullName: 'Member Three', userType: 'WORKER', status: 'INACTIVE' })],
      [U4, makeUser(U4, 'u4@example.com', hash, { fullName: 'Staff Four', userType: 'STAFF' })],
    ]);
    const byEmail = new Map<string, UserEntity>(
      [...usersById.values()].map((u) => [u.email.toLowerCase(), u]),
    );
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PM_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'Project Manager' }]],
      [WORKER_LOGIN_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
    ]);

    const mockUserRepo = {
      findByEmail: jest.fn(async (email: string) => byEmail.get(email.toLowerCase()) ?? null),
      findById: jest.fn(async (id: string) => usersById.get(id) ?? null),
      save: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      findActiveRolesByUserId: jest.fn(async (id: string) => rolesByUser.get(id) ?? []),
      findActiveProjectIdsByUserId: jest.fn(async () => [] as string[]),
    };

    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hashStr: string) => bcrypt.compare(plain, hashStr),
    };

    mockAudit = { log: jest.fn(async () => {}), logWithClient: jest.fn(async () => {}) };
    const fakeTx = {
      withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never),
    };

    crewsById = new Map<string, CrewEntity>([
      [CREW_A, makeCrew(CREW_A, 'CREW-A', 'ACTIVE')],
      [CREW_B, makeCrew(CREW_B, 'CREW-B', 'ACTIVE')],
      [CREW_OFF, makeCrew(CREW_OFF, 'CREW-OFF', 'INACTIVE')],
    ]);
    members = [];
    seedOverlapMember();

    const mockCrewRepo = {
      findById: jest.fn(async (id: string) => crewsById.get(id) ?? null),
      findByCode: jest.fn(async () => null),
      findMany: jest.fn(async () => ({ entities: [...crewsById.values()], total: crewsById.size })),
      create: jest.fn(async () => {}),
      save: jest.fn(async () => {}),
      insertLeadWithClient: jest.fn(async () => {}),
      deactivateActiveLeadWithClient: jest.fn(async () => {}),
      countOpenAssignments: jest.fn(async () => 0),
      listMembers: jest.fn(async (filter: { crewId: string; at?: string; includeInactive?: boolean }) => {
        let rows = members.filter((m) => m.crewId === filter.crewId);
        if (filter.at) {
          // Inclusive [effective_from, effective_to] — at == effective_to vẫn tính.
          rows = rows.filter((m) => m.effectiveFrom <= (filter.at as string) && (m.effectiveTo === null || m.effectiveTo >= (filter.at as string)));
        } else if (!filter.includeInactive) {
          rows = rows.filter((m) => m.isActive);
        }
        return [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
      }),
      listMembersWithClient: jest.fn(async (_c: unknown, filter: { crewId: string; at?: string; includeInactive?: boolean }) => {
        let rows = members.filter((m) => m.crewId === filter.crewId);
        if (filter.at) {
          rows = rows.filter((m) => m.effectiveFrom <= (filter.at as string) && (m.effectiveTo === null || m.effectiveTo >= (filter.at as string)));
        } else if (!filter.includeInactive) {
          rows = rows.filter((m) => m.isActive);
        }
        return [...rows].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
      }),
      findMemberByIdWithClient: jest.fn(async (_c: unknown, id: string) => members.find((m) => m.id === id) ?? null),
      findActiveMemberWithClient: jest.fn(async (_c: unknown, crewId: string, userId: string) =>
        members.find((m) => m.crewId === crewId && m.userId === userId && m.isActive) ?? null),
      findActiveMembershipsOfUserWithClient: jest.fn(async (_c: unknown, userId: string, excludeCrewId: string) =>
        members
          .filter((m) => m.userId === userId && m.isActive && m.crewId !== excludeCrewId)
          .map((m) => {
            const crew = crewsById.get(m.crewId);
            return { crewId: m.crewId, crewCode: crew?.code ?? '', crewName: crew?.name ?? '' };
          })),
      insertMemberWithClient: jest.fn(async (_c: unknown, input: MemInput) => {
        if (members.some((m) => m.crewId === input.crewId && m.userId === input.userId && m.isActive)) {
          throw Object.assign(new Error('duplicate'), { code: '23505', constraint: 'ux_crew_member_active' });
        }
        memberSeq += 1;
        const label = userLabel(input.userId);
        const row: CrewMemberRow = {
          id: `c000000${memberSeq}-0000-4000-8000-00000000000${memberSeq}`,
          crewId: input.crewId,
          userId: input.userId,
          memberRole: 'MEMBER',
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          isActive: true,
          addedBy: input.addedBy,
          createdAt: new Date(),
          userName: label.name,
          userCode: label.code,
        };
        members.push(row);
        return row;
      }),
      deactivateMemberWithClient: jest.fn(async (_c: unknown, id: string, effectiveTo: string) => {
        const row = members.find((m) => m.id === id) ?? null;
        if (!row) return null;
        row.isActive = false;
        row.effectiveTo = effectiveTo;
        return row;
      }),
      findCrewForUpdateWithClient: jest.fn(async (_c: unknown, id: string) => {
        const crew = crewsById.get(id);
        if (!crew) return null;
        return { id: crew.id, code: crew.code, name: crew.name, status: crew.status };
      }),
      findCrewByIdWithClient: jest.fn(async (_c: unknown, id: string) => {
        const crew = crewsById.get(id);
        if (!crew) return null;
        return { id: crew.id, code: crew.code, name: crew.name, status: crew.status };
      }),
    };

    workerFindMany = jest.fn(async () => ({ entities: [], total: 0 }));
    const mockWorkerRepo = {
      findById: jest.fn(async () => null),
      findMany: workerFindMany,
      findByEmployeeCode: jest.fn(async () => null),
      save: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(async () => []),
      countOpenAssignments: jest.fn(async () => 0),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(CREW_REPOSITORY).useValue(mockCrewRepo)
      .overrideProvider(WORKER_REPOSITORY).useValue(mockWorkerRepo)
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

  it('role matrix members: anon 401 / WORKER 403 / PM + ADMIN 200-201', async () => {
    await request(app.getHttpServer()).get(`/api/v1/crews/${CREW_A}/members`).expect(401);
    await request(app.getHttpServer()).post(`/api/v1/crews/${CREW_A}/members`).send({ userId: U1 }).expect(401);

    const workerToken = await login('worker-e2e@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ userId: U1 })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/crews/${CREW_A}/members/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({})
      .expect(403);

    const pmToken = await login('pm-e2e@example.com');
    const list = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(Array.isArray(list.body.data)).toBe(true);

    const adminToken = await login('admin-e2e@example.com');
    const added = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U1 })
      .expect(201);
    expect(added.body.memberRole).toBe('MEMBER');
    expect(added.body.userName).toBe('Member One');
  });

  it('validation errors có fieldErrors actionable', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const badUser = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: 'not-a-uuid' })
      .expect(400);
    // DTO @IsUUID bị ValidationPipe chặn trước use case → shape mặc định
    // (message mảng, không fieldErrors — đúng 2-shape 400 của crews §8).
    expect(badUser.body.statusCode).toBe(400);
    expect(Array.isArray(badUser.body.message)).toBe(true);
    const badDate = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U4, effectiveFrom: '2026-02-30' })
      .expect(400);
    expect(badDate.body).toEqual(expect.objectContaining({
      statusCode: 400,
      fieldErrors: { effectiveFrom: ['Ngày hiệu lực không hợp lệ (YYYY-MM-DD)'] },
    }));
    const badAt = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members?at=nope`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(badAt.body.fieldErrors).toEqual({ at: ['Ngày tra cứu không hợp lệ (YYYY-MM-DD)'] });
  });

  it('double-submit add → lần 2 là 409 MEMBER_DUPLICATE, không nhân row', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const before = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members?includeInactive=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const countBefore = (before.body.data as unknown[]).filter(
      (m) => (m as { userId: string }).userId === U4,
    ).length;
    await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U4 })
      .expect(201);
    const dup = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U4 })
      .expect(409);
    expect(dup.body).toEqual(expect.objectContaining({ code: 'MEMBER_DUPLICATE' }));
    const after = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members?includeInactive=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const countAfter = (after.body.data as unknown[]).filter(
      (m) => (m as { userId: string }).userId === U4,
    ).length;
    expect(countAfter).toBe(countBefore + 1);
  });

  it('double remove → alreadyRemoved, không audit lần 2; history giữ lại', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const list = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const target = (list.body.data as Array<{ id: string; userId: string }>).find((m) => m.userId === U1);
    expect(target).toBeDefined();
    const auditsBefore = mockAudit.logWithClient.mock.calls.length;
    const first = await request(app.getHttpServer())
      .delete(`/api/v1/crews/${CREW_A}/members/${target!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Hết hợp đồng' })
      .expect(200);
    expect(first.body.alreadyRemoved).toBe(false);
    expect(first.body.isActive).toBe(false);
    expect(mockAudit.logWithClient.mock.calls.length).toBe(auditsBefore + 1);
    const lastAudit = mockAudit.logWithClient.mock.calls[mockAudit.logWithClient.mock.calls.length - 1][1] as {
      action: string; reason: string;
    };
    expect(lastAudit.action).toBe('ORG_CREW_MEMBER_REMOVED');
    expect(lastAudit.reason).toBe('Hết hợp đồng');
    const second = await request(app.getHttpServer())
      .delete(`/api/v1/crews/${CREW_A}/members/${target!.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(second.body.alreadyRemoved).toBe(true);
    expect(mockAudit.logWithClient.mock.calls.length).toBe(auditsBefore + 1);
    // History: includeInactive vẫn thấy row đã remove.
    const history = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members?includeInactive=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((history.body.data as Array<{ id: string }>).some((m) => m.id === target!.id)).toBe(true);
  });

  it('overlap đội khác → 201 kèm warning MEMBER_IN_OTHER_CREW', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U2 })
      .expect(201);
    expect(res.body.warning).toEqual(expect.objectContaining({ code: 'MEMBER_IN_OTHER_CREW' }));
    expect(res.body.warning.otherCrews).toEqual(
      expect.arrayContaining([expect.objectContaining({ crewCode: 'CREW-B' })]),
    );
  });

  it('đội INACTIVE → 409 CREW_INACTIVE; user INACTIVE → 409 USER_INACTIVE; user lạ → 404', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const off = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_OFF}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U1 })
      .expect(409);
    expect(off.body).toEqual(expect.objectContaining({ code: 'CREW_INACTIVE' }));
    const inactive = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: U3 })
      .expect(409);
    expect(inactive.body).toEqual(expect.objectContaining({ code: 'USER_INACTIVE' }));
    const missing = await request(app.getHttpServer())
      .post(`/api/v1/crews/${CREW_A}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: '99999999-9999-4999-8999-999999999999' })
      .expect(404);
    expect(missing.body).toEqual(expect.objectContaining({ code: 'USER_NOT_FOUND' }));
  });

  it('point-in-time inclusive: at == effective_to vẫn liệt kê member đã rời', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const history = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members?includeInactive=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const removed = (history.body.data as Array<{ id: string; userId: string; isActive: boolean; effectiveTo: string | null }>)
      .find((m) => m.userId === U1 && !m.isActive);
    expect(removed?.effectiveTo).toBeTruthy();
    const at = await request(app.getHttpServer())
      .get(`/api/v1/crews/${CREW_A}/members?at=${removed!.effectiveTo}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((at.body.data as Array<{ id: string }>).some((m) => m.id === removed!.id)).toBe(true);
  });

  it('GET workers ?crewId= forward xuống repository; sai → 400 fieldErrors (D9)', async () => {
    const pmToken = await login('pm-e2e@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/workers?crewId=${CREW_A}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(workerFindMany).toHaveBeenCalledWith(expect.objectContaining({ crewId: CREW_A }));
    const bad = await request(app.getHttpServer())
      .get('/api/v1/workers?crewId=nope')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(400);
    expect(bad.body).toEqual({
      statusCode: 400,
      message: 'Crew ID không hợp lệ',
      fieldErrors: { crewId: ['Crew ID không hợp lệ'] },
    });
  });
});
