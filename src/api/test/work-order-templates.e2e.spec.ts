import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY } from '../src/modules/prj/domain/repository/work-order-template-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkOrderTemplateEntity } from '../src/modules/prj/domain/entity/work-order-template.entity';

// PRJ-SRS-008 (issue #39) — work-order-templates HTTP contract (supertest,
// in-process, mocks qua overrideProvider như work-types e2e):
// anon 401 / WORKER 403 / happy DRAFT→ACTIVATE→edit→409 conflict→
// DEACTIVATE→picker / 409 code trùng / 400 trade/work-type inactive /
// 400 publish mẫu rỗng.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const INACTIVE_TRADE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ACTIVE_TRADE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ACTIVE_WORK_TYPE_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const INACTIVE_WORK_TYPE_ID = '99999999-9999-4999-8999-999999999999';

describe('PRJ-SRS-008 work-order-templates (e2e HTTP contract)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkOrderTemplateEntity>();

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
    process.env.JWT_SECRET = 'test-e2e-wo-templates-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e@example.com', makeUser(ADMIN_ID, 'admin-e2e@example.com', hash)],
      ['pm-e2e@example.com', makeUser(PM_ID, 'pm-e2e@example.com', hash)],
      ['worker-e2e@example.com', makeUser(WORKER_ID, 'worker-e2e@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PM_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'PM' }]],
      [WORKER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
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

    const mockAudit = {
      log: jest.fn(async () => {}),
      logWithClient: jest.fn(async () => {}),
    };
    const fakeTx = {
      withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never),
    };

    const mockTemplateRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByCode: jest.fn(async (code: string) => {
        const lowered = code.trim().toLowerCase();
        return [...store.values()].find((e) => e.code.toLowerCase() === lowered) ?? null;
      }),
      search: jest.fn(async (filter: { status?: string; limit?: number; offset?: number }) => {
        let rows = [...store.values()];
        if (filter.status && filter.status !== 'ALL') rows = rows.filter((e) => e.status === filter.status);
        rows.sort((a, b) => a.name.localeCompare(b.name));
        const total = rows.length;
        const offset = filter.offset ?? 0;
        const limit = filter.limit ?? 20;
        return { entities: rows.slice(offset, offset + limit), total };
      }),
      findAllActive: jest.fn(async () =>
        [...store.values()].filter((e) => e.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name)),
      ),
      findActiveTradeById: jest.fn(async (tradeId: string) => {
        if (tradeId === INACTIVE_TRADE_ID) return { id: tradeId, code: 'OLD', isActive: false };
        if (tradeId === ACTIVE_TRADE_ID) return { id: tradeId, code: 'MASON', isActive: true };
        return null;
      }),
      findActiveTradeByCode: jest.fn(async (code: string) => {
        if (code.trim().toLowerCase() === 'mason') return { id: ACTIVE_TRADE_ID, code: 'MASON', isActive: true };
        return null;
      }),
      findActiveWorkTypeById: jest.fn(async (id: string) => {
        if (id === ACTIVE_WORK_TYPE_ID) return { id, isActive: true };
        if (id === INACTIVE_WORK_TYPE_ID) return { id, isActive: false };
        return null;
      }),
      findChecklistTemplateSnapshot: jest.fn(async () => null),
      create: jest.fn(async (e: WorkOrderTemplateEntity) => { store.set(e.id, e); }),
      createWithClient: jest.fn(async (_c: unknown, e: WorkOrderTemplateEntity) => { store.set(e.id, e); }),
      save: jest.fn(async (e: WorkOrderTemplateEntity) => { store.set(e.id, e); }),
      saveWithClient: jest.fn(async (_c: unknown, e: WorkOrderTemplateEntity) => { store.set(e.id, e); }),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY).useValue(mockTemplateRepo)
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

  it('anon → 401; WORKER → 403', async () => {
    await request(app.getHttpServer()).get('/api/v1/work-order-templates').expect(401);
    await request(app.getHttpServer()).post('/api/v1/work-order-templates').send({ code: 'X', name: 'Y' }).expect(401);

    const workerToken = await login('worker-e2e@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ code: 'X', name: 'Y' })
      .expect(403);
  });

  it('PM happy: DRAFT create → ACTIVATE → edit → 409 conflict → DEACTIVATE → picker', async () => {
    const pmToken = await login('pm-e2e@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({
        code: 'SLAB-POUR',
        name: 'Đổ sàn',
        description: 'Mẫu đổ sàn chuẩn',
        workTypeId: ACTIVE_WORK_TYPE_ID,
        requiredTradeId: ACTIVE_TRADE_ID,
        requiredSkills: [{ code: 'MASON', label: 'Thợ nề' }],
        checklistSnapshot: [{ title: 'Kiểm tra cốp pha', answerType: 'YES_NO', isRequired: true, isBlocking: true, sequenceNo: 1 }],
        defaultDurationMinutes: 120,
        defaultPriority: 'HIGH',
      })
      .expect(201);
    expect(created.body.code).toBe('SLAB-POUR');
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.version).toBe(1);
    expect(created.body.usableForNewWorkOrder).toBe(false);
    createdId = created.body.id as string;

    const draftPicker = await request(app.getHttpServer())
      .get('/api/v1/work-order-templates/active')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(draftPicker.body.data.find((t: { id: string }) => t.id === createdId)).toBeUndefined();

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/work-order-templates/${createdId}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'ACTIVATE' })
      .expect(200);
    expect(activated.body.status).toBe('ACTIVE');
    expect(activated.body.usableForNewWorkOrder).toBe(true);
    expect(activated.body.alreadyInState).toBe(false);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/work-order-templates/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(detail.body.requiredSkills).toHaveLength(1);
    expect(detail.body.checklistSnapshot).toHaveLength(1);
    expect(detail.headers['cache-control']).toContain('no-store');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/work-order-templates/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ name: 'Đổ sàn tầng 2', expectedVersion: 1 })
      .expect(200);
    expect(updated.body.version).toBe(2);
    expect(updated.body.versionChanged).toBe(true);

    const conflict = await request(app.getHttpServer())
      .patch(`/api/v1/work-order-templates/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Ghi đè cũ', expectedVersion: 1 })
      .expect(409);
    expect(conflict.body.code).toBe('WORK_ORDER_TEMPLATE_CONFIG_CONFLICT');
    expect(conflict.body.fieldErrors.expectedVersion).toBeDefined();

    const deactivated = await request(app.getHttpServer())
      .post(`/api/v1/work-order-templates/${createdId}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'DEACTIVATE' })
      .expect(200);
    expect(deactivated.body.status).toBe('INACTIVE');

    const picker = await request(app.getHttpServer())
      .get('/api/v1/work-order-templates/active')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(picker.body.data.find((t: { id: string }) => t.id === createdId)).toBeUndefined();
  });

  it('trùng code (CI) → 409 WORK_ORDER_TEMPLATE_CODE_DUPLICATE', async () => {
    const pmToken = await login('pm-e2e@example.com');
    const res = await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'slab-pour', name: 'Tên khác' })
      .expect(409);
    expect(res.body.code).toBe('WORK_ORDER_TEMPLATE_CODE_DUPLICATE');
  });

  it('trade/work-type inactive → 400; publish mẫu rỗng → 400; X-Correlation-Id sai → 400', async () => {
    const pmToken = await login('pm-e2e@example.com');

    const badTrade = await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'PAINT', name: 'Sơn', requiredTradeId: INACTIVE_TRADE_ID })
      .expect(400);
    expect(badTrade.body.fieldErrors.requiredTradeId).toBeDefined();

    const badType = await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'PAINT2', name: 'Sơn 2', workTypeId: INACTIVE_WORK_TYPE_ID })
      .expect(400);
    expect(badType.body.fieldErrors.workTypeId).toBeDefined();

    const badSkill = await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'PAINT3', name: 'Sơn 3', requiredSkills: [{ code: 'GHOST', label: 'Ma' }] })
      .expect(400);
    expect(badSkill.body.fieldErrors.requiredSkills).toBeDefined();

    const empty = await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'EMPTY', name: 'Mẫu rỗng' })
      .expect(201);
    const emptyPublish = await request(app.getHttpServer())
      .post(`/api/v1/work-order-templates/${empty.body.id}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ action: 'ACTIVATE' })
      .expect(400);
    expect(emptyPublish.body.fieldErrors.action).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/work-order-templates')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', 'not-a-uuid')
      .send({ code: 'PAINT4', name: 'Sơn 4' })
      .expect(400);
  });
});
