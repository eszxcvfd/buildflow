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
import { JOB_WORK_ORDER_REPOSITORY } from '../src/modules/job/domain/repository/work-order-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkOrderEntity } from '../src/modules/job/domain/entity/work-order.entity';

// JOB-SRS-007 (issue #47) — GET /api/v1/job-board/:id
// INTEGRATION-IN-MEMORY (supertest qua Nest app với repository/scope/tx/
// audit MOCK bằng Map) — KHÔNG phải real-DB proof. Real-DB proof chỉ ở
// evidence driver (stage sau, ngoài scope task backend này). KHÔNG cite file
// này như bằng chứng Postgres thật.
// Phạm vi (in-memory): worker trong scope 200 đủ sections §3.1; non-member
// 403 (kể cả id missing/unknown); anon 401; ADMIN missing 404; checklist/type
// ref lỗi → 409 JOB_BOARD_CONFIG_INVALID; UUID sai → 400; `/filter-options`
// vẫn 200 (R1 route order); state đổi giữa 2 GET (AVAILABLE→ASSIGNED); audit
// delta 0 (read-only); không PII (createdBy/requestKey/hasActiveAssignment).

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';

const WT = '44444444-4444-4444-8444-444444444444';
const WT_MISSING = '44444444-4444-4444-8444-444444444445';
const AREA_ID = '55555555-5555-4555-8555-555555555555';
const TRADE_ID = '66666666-6666-4666-8666-666666666666';

const WO_AVAIL = '11111111-1111-4111-8111-111111111101';
const WO_BADTYPE = '11111111-1111-4111-8111-111111111102';
const WO_P2 = '11111111-1111-4111-8111-111111111103';
const WO_UNKNOWN = '11111111-1111-4111-8111-111111111199';

const CL_PER_TYPE = '77777777-7777-4777-8777-777777777771';
const CL_GENERIC = '77777777-7777-4777-8777-777777777772';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

describe('JOB-SRS-007 job-board detail (integration in-memory HTTP contract — mock repo, KHÔNG phải real-DB)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderEntity>();
  const assignments = new Map<string, string>();
  let auditLogWithClient: jest.Mock;
  let auditLog: jest.Mock;

  function seedWo(id: string, over: Partial<Record<string, unknown>> = {}): void {
    const e = WorkOrderEntity.fromPersistence({
      id,
      code: `WO-E2E-JBD${id.slice(-2)}`,
      projectId: P1,
      areaId: AREA_ID,
      workTypeId: WT,
      requiredTradeId: TRADE_ID,
      title: 'Viec board detail',
      description: 'Mo ta chi tiet',
      instructions: 'Huong dan thuc hien',
      priority: 'NORMAL',
      status: 'OPEN',
      plannedStartAt: new Date('2026-11-05T08:00:00.000Z'),
      plannedEndAt: new Date('2026-11-06T08:00:00.000Z'),
      dueAt: null,
      plannedHeadcount: 5,
      customFields: { dien_tich: 12 },
      jobBoardOpen: true,
      jobBoardOpenFrom: new Date(now - 30 * DAY),
      jobBoardOpenUntil: new Date(now + 30 * DAY),
      createdBy: ADMIN_ID,
      version: 2,
      requestKey: 'req-key-secret-should-not-leak',
      createdAt: new Date(now - 10 * DAY),
      updatedAt: new Date(now - 1 * DAY),
      ...(over as Record<string, never>),
    });
    store.set(id, e);
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
    process.env.JWT_SECRET = 'test-e2e-job-board-detail-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    seedWo(WO_AVAIL);
    seedWo(WO_BADTYPE, { workTypeId: WT_MISSING });
    seedWo(WO_P2, { projectId: P2 });

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-jbd@example.com', makeUser(ADMIN_ID, 'admin-e2e-jbd@example.com', hash)],
      ['worker-e2e-jbd@example.com', makeUser(WORKER_ID, 'worker-e2e-jbd@example.com', hash)],
      ['outsider-e2e-jbd@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-jbd@example.com', hash)],
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

    // Scope-first mirror get-work-order: ADMIN bypass; WORKER member P1;
    // outsider không member project nào.
    const mockScope = {
      assertProjectMemberScope: jest.fn(
        async ({ userId, actorRoles, projectId }: { userId: string; actorRoles: string[]; projectId: string }) => {
          if (actorRoles.includes('ADMIN')) return { isAdminBypass: true };
          if (userId === WORKER_ID && projectId === P1) return { isAdminBypass: false };
          const { ForbiddenException } = await import('@nestjs/common');
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        },
      ),
      resolveAccessibleProjectIds: jest.fn(async () => [P1]),
    };

    const isActiveAssignment = (id: string): boolean => {
      const s = assignments.get(id);
      return s === 'PENDING_ACCEPTANCE' || s === 'ACTIVE';
    };

    const mockWorkOrderRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findWorkTypeDetailById: jest.fn(async (id: string) => {
        if (id === WT) {
          return {
            id: WT,
            name: 'Do be tong',
            description: 'Mo ta loai',
            requiredFields: [{ key: 'dien_tich', label: 'Dien tich', type: 'number' }],
            workTypeGroup: 'Ket cau',
            configVersion: 3,
          };
        }
        return null;
      }),
      findActiveChecklistTemplatesByWorkTypeId: jest.fn(async (workTypeId: string) => {
        if (workTypeId !== WT) return [];
        return [
          { id: CL_PER_TYPE, code: 'CL-PRE', name: 'Kiem tra truoc', workTypeId: WT, purpose: 'PRE_START', version: 2, description: null, status: 'ACTIVE' },
          { id: CL_GENERIC, code: 'CL-GEN', name: 'An toan chung', workTypeId: null, purpose: 'INSPECTION', version: 1, description: 'Mo ta chung', status: 'ACTIVE' },
        ];
      }),
      findChecklistItemsByTemplateIds: jest.fn(async (ids: string[]) =>
        ids.map((id) => ({
          templateId: id,
          sequenceNo: 1,
          title: `Muc 1 cua ${id.slice(-2)}`,
          description: null,
          answerType: 'YES_NO',
          isRequired: true,
          isBlocking: false,
          requiresPhoto: false,
          minValue: null,
          maxValue: null,
        })),
      ),
      hasActiveAssignmentByWorkOrderIds: jest.fn(async (ids: string[]) => new Set(ids.filter(isActiveAssignment))),
      // R1 route-order: filter-options đi qua use case riêng — mock tối thiểu
      findJobBoardFilterOptions: jest.fn(async () => ({ projectIds: [], areaIds: [], workTypeIds: [], tradeIds: [] })),
      findWorkTypeRefs: jest.fn(async () => new Map()),
      findProjectRefs: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, code: 'PRJ-001', name: 'Du an 1' }]))),
      findAreaRefs: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, code: 'A-01', name: 'Khu A' }]))),
      findTradeRefs: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, code: 'TR-01', name: 'Tho xay' }]))),
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

  it('anon → 401', async () => {
    await request(app.getHttpServer()).get(`/api/v1/job-board/${WO_AVAIL}`).expect(401);
  });

  it('worker trong scope → 200 đủ sections §3.1, no-store, không PII', async () => {
    const token = await login('worker-e2e-jbd@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board/${WO_AVAIL}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const b = res.body;
    expect(b.id).toBe(WO_AVAIL);
    expect(b.projectId).toBe(P1);
    expect(b.projectName).toBe('Du an 1');
    expect(b.areaId).toBe(AREA_ID);
    expect(b.areaName).toBe('Khu A');
    expect(b.workTypeId).toBe(WT);
    expect(b.workTypeName).toBe('Do be tong');
    expect(b.workTypeDescription).toBe('Mo ta loai');
    expect(b.workTypeRequiredFields).toEqual([{ key: 'dien_tich', label: 'Dien tich', type: 'number' }]);
    expect(b.workTypeGroup).toBe('Ket cau');
    expect(b.requiredTradeId).toBe(TRADE_ID);
    expect(b.requiredTradeName).toBe('Tho xay');
    expect(b.plannedStartAt).toBe('2026-11-05T08:00:00.000Z');
    expect(b.jobBoard.open).toBe(true);
    expect(b.jobBoard.state).toBe('AVAILABLE');
    expect(b.description).toBe('Mo ta chi tiet');
    expect(b.instructions).toBe('Huong dan thuc hien');
    expect(b.customFields).toEqual({ dien_tich: 12 });
    expect(b.checklists).toHaveLength(2);
    expect(b.checklists.map((c: { code: string }) => c.code)).toEqual(['CL-GEN', 'CL-PRE']);
    for (const c of b.checklists) {
      expect(c.items).toHaveLength(1);
      expect(c.items[0]).toMatchObject({ sequenceNo: 1, answerType: 'YES_NO', isRequired: true });
    }
    expect(b.version).toBe(2);
    // OMIT PII BD6 kéo dài
    expect(b).not.toHaveProperty('createdBy');
    expect(b).not.toHaveProperty('requestKey');
    expect(b).not.toHaveProperty('hasActiveAssignment');
    expect(b.jobBoard).not.toHaveProperty('hasActiveAssignment');
    expect(JSON.stringify(b)).not.toContain('req-key-secret-should-not-leak');
    expect(JSON.stringify(b)).not.toContain(ADMIN_ID);
  });

  it('non-member: WO ngoài scope + unknown id → 403 generic (không phân biệt)', async () => {
    const token = await login('outsider-e2e-jbd@example.com');
    for (const id of [WO_P2, WO_AVAIL, WO_UNKNOWN]) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/job-board/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(res.body.message).toBeDefined();
    }
  });

  it('ADMIN: missing → 404; tồn tại → 200', async () => {
    const token = await login('admin-e2e-jbd@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/job-board/${WO_UNKNOWN}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/v1/job-board/${WO_AVAIL}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('work-type ref lỗi → 409 JOB_BOARD_CONFIG_INVALID (withheld detail)', async () => {
    const token = await login('worker-e2e-jbd@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/job-board/${WO_BADTYPE}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.code).toBe('JOB_BOARD_CONFIG_INVALID');
    expect(res.body.message).toBeDefined();
  });

  it('id sai UUID → 400', async () => {
    const token = await login('worker-e2e-jbd@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/job-board/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('R1 route order: /filter-options vẫn 200 (không bị :id nuốt)', async () => {
    const token = await login('worker-e2e-jbd@example.com');
    const res = await request(app.getHttpServer())
      .get('/api/v1/job-board/filter-options')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('now');
  });

  it('state đổi giữa 2 GET: chèn assignment → AVAILABLE thành ASSIGNED', async () => {
    const token = await login('worker-e2e-jbd@example.com');
    const before = await request(app.getHttpServer())
      .get(`/api/v1/job-board/${WO_AVAIL}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body.jobBoard.state).toBe('AVAILABLE');
    assignments.set(WO_AVAIL, 'PENDING_ACCEPTANCE');
    const after = await request(app.getHttpServer())
      .get(`/api/v1/job-board/${WO_AVAIL}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.jobBoard.state).toBe('ASSIGNED');
    assignments.delete(WO_AVAIL);
  });

  it('read-only: 3 GET không đổi audit count', async () => {
    const token = await login('worker-e2e-jbd@example.com');
    const auditBefore = auditLogWithClient.mock.calls.length + auditLog.mock.calls.length;
    await request(app.getHttpServer()).get(`/api/v1/job-board/${WO_AVAIL}`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/job-board/${WO_AVAIL}`).set('Authorization', `Bearer ${token}`).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/job-board/${WO_AVAIL}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(auditLogWithClient.mock.calls.length + auditLog.mock.calls.length).toBe(auditBefore);
  });
});
