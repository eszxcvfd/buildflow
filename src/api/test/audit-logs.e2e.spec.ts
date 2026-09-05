import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { AUDIT_LOG_REPOSITORY } from '../src/modules/iam/domain/repository/audit-log-repository.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';
import { AuditLogEntity } from '../src/modules/iam/domain/entity/audit-log.entity';

// IAM-SRS-008 — GET /api/v1/audit-logs permission + contract (supertest, in-process).
// Repositories are mocked via overrideProvider like the existing e2e specs.

const ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const WORKER_ID = '44444444-4444-4444-4444-444444444444';

describe('GET /api/v1/audit-logs (e2e IAM-SRS-008)', () => {
  let app: INestApplication;
  let auditLogFindMany: jest.Mock;
  let auditLogCalls: Array<Record<string, unknown>>;

  function makeUser(id: string, email: string, passwordHash: string): UserEntity {
    return new UserEntity({
      id,
      email,
      passwordHash,
      fullName: 'E2E Audit',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  function makeLog(): AuditLogEntity {
    return new AuditLogEntity({
      id: 'log-1',
      actorUserId: ADMIN_ID,
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'USER',
      entityId: WORKER_ID,
      beforeData: null,
      afterData: { email: 'worker@e2e.com', reason: 'invalid_password' },
      reason: null,
      result: 'FAILED',
      ipAddress: '10.0.0.1',
      userAgent: 'supertest',
      correlationId: 'correlation-1',
      createdAt: new Date('2026-08-27T00:00:00.000Z'),
    });
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-audit-logs-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const adminHash = await bcrypt.hash('Password123!', 10);
    const workerHash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e@example.com', makeUser(ADMIN_ID, 'admin-e2e@example.com', adminHash)],
      ['worker-e2e@example.com', makeUser(WORKER_ID, 'worker-e2e@example.com', workerHash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [WORKER_ID, [{ id: 'r2', code: 'WORKER', name: 'Worker' }]],
    ]);

    const mockUserRepo = {
      findByEmail: jest.fn(async (email: string) => users.get(email.toLowerCase()) ?? null),
      findById: jest.fn(async (id: string) =>
        [...users.values()].find((u) => u.id === id) ?? null),
      save: jest.fn(async (u: UserEntity) => { users.set(u.email, u); }),
      findActiveRolesByUserId: jest.fn(async (id: string) => rolesByUser.get(id) ?? []),
      findActiveProjectIdsByUserId: jest.fn(async () => [] as string[]),
    };

    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };

    auditLogCalls = [];
    const mockAudit = {
      log: jest.fn(async (params: Record<string, unknown>) => { auditLogCalls.push(params); }),
    };

    auditLogFindMany = jest.fn(async () => ({ entities: [makeLog()], total: 1 }));
    const mockAuditLogRepo = {
      findMany: auditLogFindMany,
      findById: jest.fn(async () => null),
      existsByCorrelation: jest.fn(async () => false),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(AUDIT_LOG_REPOSITORY).useValue(mockAuditLogRepo)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('no token → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/audit-logs').expect(401);
  });

  it('token sai/không hợp lệ → 401', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', 'Bearer not.a.jwt')
      .expect(401);
  });

  it('non-admin role (WORKER) → 403, không gọi repository', async () => {
    const token = await login('worker-e2e@example.com', 'Password123!');
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.message).toContain('Không có quyền truy cập');
    expect(auditLogFindMany).not.toHaveBeenCalled();
  });

  it('admin + filters → 200 với shape {data,total,limit,offset} và filter được truyền đúng', async () => {
    const token = await login('admin-e2e@example.com', 'Password123!');
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ action: 'AUTH_LOGIN_FAILED', result: 'FAILED', limit: '5', offset: '10' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(10);
    expect(res.body.data[0]).toMatchObject({ action: 'AUTH_LOGIN_FAILED', result: 'FAILED', correlationId: 'correlation-1' });
    expect(auditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({
      action: 'AUTH_LOGIN_FAILED',
      result: 'FAILED',
      limit: 5,
      offset: 10,
    }));
  });

  it('invalid query: result enum sai → 400 với body lỗi có statusCode/message', async () => {
    const token = await login('admin-e2e@example.com', 'Password123!');
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ result: 'BOGUS' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(typeof res.body.message).toBe('string');
  });

  it('invalid query: from/to không phải ISO date → 400', async () => {
    const token = await login('admin-e2e@example.com', 'Password123!');
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ from: 'not-a-date' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ from: '2026-08-28T00:00:00Z', to: '2026-08-27T00:00:00Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('invalid query: from là ngày không tồn tại trên lịch hoặc format lạ → 400', async () => {
    const token = await login('admin-e2e@example.com', 'Password123!');
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ from: '2026-08-32' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ from: 'Aug 27 2026' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('date-only from/to được chuẩn hóa về UTC boundary trước khi chạm repository', async () => {
    const token = await login('admin-e2e@example.com', 'Password123!');
    auditLogFindMany.mockClear();
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ from: '2026-08-27', to: '2026-08-27' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(auditLogFindMany).toHaveBeenLastCalledWith(expect.objectContaining({
      filter: expect.objectContaining({
        from: new Date('2026-08-27T00:00:00.000Z'),
        to: new Date('2026-08-27T23:59:59.999Z'),
      }),
    }));
  });

  it('invalid query: limit ngoài 1..100 → 400', async () => {
    const token = await login('admin-e2e@example.com', 'Password123!');
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ limit: '0' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .query({ limit: '101' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('anonymous failed login vẫn traceable: AUTH_LOGIN_FAILED với actor null, không chứa plaintext password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ghost-e2e@example.com', password: 'E2ELeakPass123!' })
      .expect(401);

    const failedCalls = auditLogCalls.filter((c) => c.action === 'AUTH_LOGIN_FAILED');
    expect(failedCalls.length).toBeGreaterThanOrEqual(1);
    const last = failedCalls[failedCalls.length - 1];
    expect(last.actorUserId).toBeNull();
    expect(last.result).toBe('FAILED');
    const serialized = JSON.stringify(auditLogCalls);
    expect(serialized).not.toContain('E2ELeakPass123!');
    expect(serialized.toLowerCase()).not.toContain('"password"');
  });
});
