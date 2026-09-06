import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { WORKER_REPOSITORY } from '../src/modules/org/domain/repository/worker-repository.port';
import { CONTRACTOR_REPOSITORY } from '../src/modules/org/domain/repository/contractor-repository.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { WorkerEntity } from '../src/modules/org/domain/entity/worker.entity';
import { ContractorEntity } from '../src/modules/org/domain/entity/contractor.entity';

// ORG-SRS-004 (issue #27) — lifecycle endpoints HTTP contract (supertest,
// in-process, mocks qua overrideProvider như các e2e spec hiện có):
// anon 401 / non-admin 403 / validation 400 / happy path + correlation strict.

const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const WORKER_ID = '44444444-4444-4444-4444-444444444444';
const WRK_ID = '11111111-1111-4111-8111-111111111111';
const CTR_ID = '22222222-2222-4222-8222-222222222222';

describe('ORG-SRS-004 resource lifecycle (e2e HTTP contract)', () => {
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

  let workerStore: WorkerEntity;
  let contractorStore: ContractorEntity;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-resource-lifecycle-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e@example.com', makeUser(ADMIN_ID, 'admin-e2e@example.com', hash)],
      ['worker-e2e@example.com', makeUser(WORKER_ID, 'worker-e2e@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [WORKER_ID, [{ id: 'r2', code: 'WORKER', name: 'Worker' }]],
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

    function makeWorker(): WorkerEntity {
      const user = new UserEntity({
        id: WRK_ID,
        email: 'w@example.com',
        passwordHash: '$hash',
        fullName: 'Worker',
        phone: null,
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
        phone: null,
        email: null,
        status: 'ACTIVE',
        scope: 'Thi cong',
        createdBy: ADMIN_ID,
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
        updatedAt: new Date('2026-08-27T00:00:00.000Z'),
      });
    }

    workerStore = makeWorker();
    contractorStore = makeContractor();

    const mockWorkerRepo = {
      findById: jest.fn(async () => workerStore),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findByEmployeeCode: jest.fn(async () => null),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(async () => []),
      countOpenAssignments: jest.fn(async () => 0),
    };

    const mockContractorRepo = {
      findById: jest.fn(async () => contractorStore),
      findByCode: jest.fn(async () => null),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findActiveForAssignment: jest.fn(async () => ({ entities: [], total: 0 })),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      countOpenAssignments: jest.fn(async () => 0),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(WORKER_REPOSITORY).useValue(mockWorkerRepo)
      .overrideProvider(CONTRACTOR_REPOSITORY).useValue(mockContractorRepo)
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

  it('worker status: chưa xác thực → 401; non-admin → 403; action sai → 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/workers/${WRK_ID}/status`)
      .send({ action: 'SUSPEND', reason: 'x' })
      .expect(401);

    const workerToken = await login('worker-e2e@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/workers/${WRK_ID}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ action: 'SUSPEND', reason: 'x' })
      .expect(403);

    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/workers/${WRK_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'NOPE' })
      .expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('worker status: SUSPEND thiếu reason → 400 actionable (không tạo audit)', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/workers/${WRK_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'SUSPEND' })
      .expect(400);
    expect(res.body.message).toContain('Lý do là bắt buộc khi tạm ngừng/chấm dứt');
  });

  it('worker status: ADMIN SUSPEND với reason → 200 alreadyInState=false', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/workers/${WRK_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'SUSPEND', reason: 'Nghỉ dài hạn' })
      .expect(200);
    expect(res.body.status).toBe('INACTIVE');
    expect(res.body.alreadyInState).toBe(false);
    expect(workerStore.status).toBe('INACTIVE');
  });

  it('worker open-work: ADMIN → 200 {openAssignments}; anon → 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/workers/${WRK_ID}/open-work`)
      .expect(401);
    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/workers/${WRK_ID}/open-work`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual({ openAssignments: 0 });
  });

  it('contractor status: anon → 401; ADMIN TERMINATE với reason → 200; open-work 200', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/contractors/${CTR_ID}/status`)
      .send({ action: 'TERMINATE', reason: 'x' })
      .expect(401);

    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/contractors/${CTR_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ action: 'TERMINATE', reason: 'Chấm dứt hợp đồng' })
      .expect(200);
    expect(res.body.status).toBe('INACTIVE');
    expect(res.body.alreadyInState).toBe(false);
    expect(contractorStore.status).toBe('INACTIVE');

    const open = await request(app.getHttpServer())
      .get(`/api/v1/contractors/${CTR_ID}/open-work`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(open.body).toEqual({ openAssignments: 0 });
  });

  it('contractor status: idempotent repeat TERMINATE khi INACTIVE → 200 alreadyInState=true', async () => {
    const adminToken = await login('admin-e2e@example.com');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/contractors/${CTR_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'TERMINATE', reason: 'lại lần nữa' })
      .expect(200);
    expect(res.body.alreadyInState).toBe(true);
    expect(res.body.status).toBe('INACTIVE');
  });
});
