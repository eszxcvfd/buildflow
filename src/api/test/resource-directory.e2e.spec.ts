import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { WORKER_REPOSITORY } from '../src/modules/org/domain/repository/worker-repository.port';
import { CREW_REPOSITORY } from '../src/modules/org/domain/repository/crew-repository.port';
import { CONTRACTOR_REPOSITORY } from '../src/modules/org/domain/repository/contractor-repository.port';
import { TRADE_REPOSITORY } from '../src/modules/org/domain/repository/trade-repository.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkerEntity } from '../src/modules/org/domain/entity/worker.entity';
import { ContractorEntity } from '../src/modules/org/domain/entity/contractor.entity';
import { TradeEntity } from '../src/modules/org/domain/entity/trade.entity';

// ORG-SRS-005 (issue #28) — resource directory HTTP contract (supertest,
// in-process, mocks qua overrideProvider như resource-lifecycle.e2e.spec.ts):
// role matrix READ widen (ADMIN+PM OK; WORKER 403; anon 401), write giữ
// ADMIN-only, Cache-Control: no-store, sort whitelist + fieldErrors 400.

const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const PM_ID = '55555555-5555-5555-5555-555555555555';
const WORKER_USER_ID = '44444444-4444-4444-4444-444444444444';
const WRK_ID = '11111111-1111-4111-8111-111111111111';
const CTR_ID = '22222222-2222-4222-8222-222222222222';
const TRADE_ID = '66666666-6666-4666-8666-666666666666';

describe('ORG-SRS-005 resource directory (e2e HTTP contract)', () => {
  let app: INestApplication;

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

  function makeWorker(): WorkerEntity {
    const user = new UserEntity({
      id: WRK_ID,
      email: 'w@example.com',
      passwordHash: '$hash',
      fullName: 'Worker',
      phone: '+84901234567',
      avatarUrl: null,
      employeeCode: 'EMP-1',
      userType: 'WORKER',
      contractorId: null,
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date('2026-08-26T00:00:00.000Z'),
      updatedAt: new Date('2026-08-27T00:00:00.000Z'),
    });
    return new WorkerEntity({ user, trades: [] });
  }

  function makeContractor(): ContractorEntity {
    return new ContractorEntity({
      id: CTR_ID,
      code: 'CTR-001',
      name: 'Alpha',
      contactName: 'Nguyen Van A',
      phone: '+84901234567',
      email: 'alpha@example.com',
      status: 'ACTIVE',
      scope: 'Thi cong',
      createdBy: ADMIN_ID,
      createdAt: new Date('2026-08-26T00:00:00.000Z'),
      updatedAt: new Date('2026-08-27T00:00:00.000Z'),
    });
  }

  function makeTrade(): TradeEntity {
    return new TradeEntity({
      id: TRADE_ID,
      code: 'TRD-001',
      name: 'Phan tho',
      description: null,
      isActive: true,
      createdAt: new Date('2026-08-26T00:00:00.000Z'),
      updatedAt: new Date('2026-08-27T00:00:00.000Z'),
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-resource-directory-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e@example.com', makeUser(ADMIN_ID, 'admin-e2e@example.com', hash)],
      ['pm-e2e@example.com', makeUser(PM_ID, 'pm-e2e@example.com', hash)],
      ['worker-e2e@example.com', makeUser(WORKER_USER_ID, 'worker-e2e@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PM_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'Project Manager' }]],
      [WORKER_USER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
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

    const workerEntity = makeWorker();
    const mockWorkerRepo = {
      findById: jest.fn(async () => workerEntity),
      findMany: jest.fn(async () => ({ entities: [workerEntity], total: 1 })),
      findByEmployeeCode: jest.fn(async () => null),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(async () => []),
      countOpenAssignments: jest.fn(async () => 0),
    };

    const contractorEntity = makeContractor();
    const mockContractorRepo = {
      findById: jest.fn(async () => contractorEntity),
      findByCode: jest.fn(async () => null),
      findMany: jest.fn(async () => ({ entities: [contractorEntity], total: 1 })),
      findActiveForAssignment: jest.fn(async () => ({ entities: [contractorEntity], total: 1 })),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      countOpenAssignments: jest.fn(async () => 0),
    };

    const tradeEntity = makeTrade();
    const mockTradeRepo = {
      findById: jest.fn(async () => tradeEntity),
      findByIds: jest.fn(async () => [tradeEntity]),
      findAllActive: jest.fn(async () => [tradeEntity]),
      findByCode: jest.fn(async () => null),
      search: jest.fn(async () => ({ entities: [tradeEntity], total: 1 })),
      create: jest.fn(async () => {}),
      save: jest.fn(async () => {}),
      countActiveUsage: jest.fn(async () => 0),
    };

    // ORG-05 (Worker ↔ Crew link) — worker search/detail use-case nay batch
    // memberships qua CREW_REPOSITORY (mock rỗng: workers không thuộc đội nào).
    const mockCrewRepo = {
      findMembershipsByUser: jest.fn(async () => []),
      findMembershipsByUserIds: jest.fn(async () => []),
      findListEnrichments: jest.fn(async () => new Map()),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(WORKER_REPOSITORY).useValue(mockWorkerRepo)
      .overrideProvider(CONTRACTOR_REPOSITORY).useValue(mockContractorRepo)
      .overrideProvider(TRADE_REPOSITORY).useValue(mockTradeRepo)
      .overrideProvider(CREW_REPOSITORY).useValue(mockCrewRepo)
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

  it('role matrix GET search: anon 401 / WORKER 403 / PM 200 / ADMIN 200', async () => {
    for (const path of ['/api/v1/workers', '/api/v1/contractors', '/api/v1/trades']) {
      await request(app.getHttpServer()).get(path).expect(401);
    }

    const workerToken = await login('worker-e2e@example.com');
    for (const path of ['/api/v1/workers', '/api/v1/contractors', '/api/v1/trades']) {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(403);
    }

    const pmToken = await login('pm-e2e@example.com');
    for (const path of ['/api/v1/workers', '/api/v1/contractors', '/api/v1/trades']) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${pmToken}`)
        .expect(200);
      expect(res.body.total).toBe(1);
      expect(res.headers['cache-control']).toBe('no-store');
    }

    const adminToken = await login('admin-e2e@example.com');
    for (const path of ['/api/v1/workers', '/api/v1/contractors', '/api/v1/trades']) {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    }
  });

  it('role matrix GET detail: anon 401 / WORKER 403 / PM 200 (mapper giới hạn, không leak thêm)', async () => {
    const paths = [`/api/v1/workers/${WRK_ID}`, `/api/v1/contractors/${CTR_ID}`, `/api/v1/trades/${TRADE_ID}`];
    for (const path of paths) {
      await request(app.getHttpServer()).get(path).expect(401);
    }

    const workerToken = await login('worker-e2e@example.com');
    for (const path of paths) {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(403);
    }

    const pmToken = await login('pm-e2e@example.com');
    const wRes = await request(app.getHttpServer())
      .get(`/api/v1/workers/${WRK_ID}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    // PM đọc được contact fields phục vụ điều phối, nhưng không leak passwordHash
    expect(wRes.body.email).toBe('w@example.com');
    expect(wRes.body.phone).toBe('+84901234567');
    expect(wRes.body.passwordHash).toBeUndefined();
    expect(wRes.headers['cache-control']).toBe('no-store');

    const cRes = await request(app.getHttpServer())
      .get(`/api/v1/contractors/${CTR_ID}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(cRes.body.email).toBe('alpha@example.com');
    expect(cRes.headers['cache-control']).toBe('no-store');

    await request(app.getHttpServer())
      .get(`/api/v1/trades/${TRADE_ID}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
  });

  it('write giữ ADMIN-only: PM PATCH → 403; PM open-work GET → 403', async () => {
    const pmToken = await login('pm-e2e@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/workers/${WRK_ID}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ fullName: 'Nope' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/contractors/${CTR_ID}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Nope' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/trades/${TRADE_ID}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'Nope' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/workers/${WRK_ID}/open-work`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/contractors/${CTR_ID}/open-work`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(403);
  });

  it('sort whitelist: name/createdAt × asc/desc OK; sai → 400 fieldErrors', async () => {
    const pmToken = await login('pm-e2e@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/workers?sort=name&order=asc')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/contractors?sort=createdAt&order=desc')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    const badSort = await request(app.getHttpServer())
      .get('/api/v1/workers?sort=salary')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(400);
    expect(badSort.body).toEqual({
      statusCode: 400,
      message: 'Sort không hợp lệ (name|createdAt)',
      fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
    });

    const badOrder = await request(app.getHttpServer())
      .get('/api/v1/contractors?order=sideways')
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(400);
    expect(badOrder.body.fieldErrors).toEqual({ order: ['Order không hợp lệ (asc|desc)'] });
    // message tổng giữ text cũ — client cũ chỉ đọc message không break
    expect(badOrder.body.message).toBe('Order không hợp lệ (asc|desc)');
  });

  it('filter kết hợp status+tradeId+skillLevel vẫn pass (PM)', async () => {
    const pmToken = await login('pm-e2e@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/workers?status=ACTIVE&tradeId=${TRADE_ID}&skillLevel=3`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(res.body.total).toBe(1);
  });
});
