import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { PRJ_WORK_TYPE_REPOSITORY } from '../src/modules/prj/domain/repository/work-type-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkTypeEntity } from '../src/modules/prj/domain/entity/work-type.entity';

// PRJ-SRS-004 (issue #35) — work-types HTTP contract (supertest, in-process,
// mocks qua overrideProvider như các e2e spec hiện có):
// anon 401 / WORKER 403 / happy create→get→update→deactivate→picker /
// 409 code trùng / 409 conflict version / 400 trade inactive.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const INACTIVE_TRADE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ACTIVE_TRADE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

describe('PRJ-SRS-004 work-types (e2e HTTP contract)', () => {
  let app: INestApplication;
  const store = new Map<string, WorkTypeEntity>();

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
    process.env.JWT_SECRET = 'test-e2e-work-types-secret';
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

    const mockWorkTypeRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByCode: jest.fn(async (code: string) => {
        const lowered = code.trim().toLowerCase();
        return [...store.values()].find((e) => e.code.toLowerCase() === lowered) ?? null;
      }),
      search: jest.fn(async (filter: { status?: string; limit?: number; offset?: number }) => {
        let rows = [...store.values()];
        if (filter.status === 'ACTIVE') rows = rows.filter((e) => e.isActive);
        if (filter.status === 'INACTIVE') rows = rows.filter((e) => !e.isActive);
        rows.sort((a, b) => a.name.localeCompare(b.name));
        const total = rows.length;
        const offset = filter.offset ?? 0;
        const limit = filter.limit ?? 20;
        return { entities: rows.slice(offset, offset + limit), total };
      }),
      findAllActive: jest.fn(async () =>
        [...store.values()].filter((e) => e.isActive).sort((a, b) => a.name.localeCompare(b.name)),
      ),
      findActiveTradeById: jest.fn(async (tradeId: string) => {
        if (tradeId === INACTIVE_TRADE_ID) return { id: tradeId, isActive: false };
        if (tradeId === ACTIVE_TRADE_ID) return { id: tradeId, isActive: true };
        return null;
      }),
      // JOB module chưa tồn tại → usage = 0 trong e2e này.
      countActiveWorkOrders: jest.fn(async () => 0),
      create: jest.fn(async (e: WorkTypeEntity) => { store.set(e.id, e); }),
      createWithClient: jest.fn(async (_c: unknown, e: WorkTypeEntity) => { store.set(e.id, e); }),
      save: jest.fn(async (e: WorkTypeEntity) => { store.set(e.id, e); }),
      saveWithClient: jest.fn(async (_c: unknown, e: WorkTypeEntity) => { store.set(e.id, e); }),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(PRJ_WORK_TYPE_REPOSITORY).useValue(mockWorkTypeRepo)
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
    await request(app.getHttpServer()).get('/api/v1/work-types').expect(401);
    await request(app.getHttpServer()).post('/api/v1/work-types').send({ code: 'X', name: 'Y' }).expect(401);

    const workerToken = await login('worker-e2e@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/work-types')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/work-types')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ code: 'X', name: 'Y' })
      .expect(403);
  });

  it('PM happy: create → get → update → deactivate → picker', async () => {
    const pmToken = await login('pm-e2e@example.com');

    const created = await request(app.getHttpServer())
      .post('/api/v1/work-types')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({
        code: 'CONCRETE',
        name: 'Đổ bê tông',
        group: 'Kết cấu',
        requiredTradeId: ACTIVE_TRADE_ID,
        requiredFields: [{ key: 'photo', label: 'Ảnh hiện trường', type: 'PHOTO', required: true }],
        defaultDurationMinutes: 120,
        defaultPriority: 'HIGH',
      })
      .expect(201);
    expect(created.body.code).toBe('CONCRETE');
    expect(created.body.configVersion).toBe(1);
    expect(created.body.requiredFields).toHaveLength(1);
    createdId = created.body.id as string;

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/work-types/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(detail.body.usage).toEqual({ workOrders: 0 });
    expect(detail.headers['cache-control']).toContain('no-store');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/work-types/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ name: 'Đổ bê tông tươi', expectedConfigVersion: 1 })
      .expect(200);
    expect(updated.body.configVersion).toBe(2);
    expect(updated.body.versionChanged).toBe(true);

    const deactivated = await request(app.getHttpServer())
      .post(`/api/v1/work-types/${createdId}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'DEACTIVATE' })
      .expect(200);
    expect(deactivated.body.status).toBe('INACTIVE');
    expect(deactivated.body.alreadyInState).toBe(false);

    const picker = await request(app.getHttpServer())
      .get('/api/v1/work-types/active')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(picker.body.data.find((w: { id: string }) => w.id === createdId)).toBeUndefined();

    const repeat = await request(app.getHttpServer())
      .post(`/api/v1/work-types/${createdId}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'DEACTIVATE' })
      .expect(200);
    expect(repeat.body.alreadyInState).toBe(true);
  });

  it('trùng code (CI) → 409 WORK_TYPE_CODE_DUPLICATE', async () => {
    const pmToken = await login('pm-e2e@example.com');
    const res = await request(app.getHttpServer())
      .post('/api/v1/work-types')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'concrete', name: 'Tên khác' })
      .expect(409);
    expect(res.body.code).toBe('WORK_TYPE_CODE_DUPLICATE');
  });

  it('expectedConfigVersion cũ → 409 WORK_TYPE_CONFIG_CONFLICT', async () => {
    const pmToken = await login('pm-e2e@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-types/${createdId}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Ghi đè cũ', expectedConfigVersion: 1 })
      .expect(409);
    expect(res.body.code).toBe('WORK_TYPE_CONFIG_CONFLICT');
    expect(res.body.fieldErrors.expectedConfigVersion).toBeDefined();
  });

  it('trade inactive → 400 fieldErrors requiredTradeId; X-Correlation-Id sai → 400', async () => {
    const pmToken = await login('pm-e2e@example.com');
    const res = await request(app.getHttpServer())
      .post('/api/v1/work-types')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ code: 'PAINT', name: 'Sơn', requiredTradeId: INACTIVE_TRADE_ID })
      .expect(400);
    expect(res.body.fieldErrors.requiredTradeId).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/work-types')
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', 'not-a-uuid')
      .send({ code: 'PAINT', name: 'Sơn' })
      .expect(400);
  });
});
