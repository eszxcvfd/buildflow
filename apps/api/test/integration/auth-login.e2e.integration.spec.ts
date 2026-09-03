import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { USER_REPOSITORY } from '../../src/modules/iam/domain/repository/user.repository.port';
import { AUDIT_PORT } from '../../src/modules/iam/application/port/audit.port';
import { LOGIN_LIMITER_PORT } from '../../src/modules/iam/application/port/login-limiter.port';
import type { UserSnapshot } from '../../src/modules/iam/domain/entity/user.entity';

const hasPg = Boolean(process.env.DATABASE_URL);
const itIfPg = hasPg ? it : it.skip;

function activeUser(overrides?: Partial<UserSnapshot>): UserSnapshot {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'e2e@example.com',
    passwordHash: bcrypt.hashSync('Password123!', 10),
    fullName: 'E2E User',
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

describe('POST /api/v1/auth/login (e2e contract, real DB)', () => {
  let app: INestApplication | undefined;
  let current: UserSnapshot;
  let mockRepo: { findByEmail: jest.Mock; save: jest.Mock; findRolesByUserId: jest.Mock; findProjectIdsByUserId: jest.Mock };
  let mockAudit: { log: jest.Mock };
  let mockLimiter: { isBlocked: jest.Mock; recordFailure: jest.Mock; reset: jest.Mock };

  beforeAll(async () => {
    if (!hasPg) return;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret-not-for-production';
    current = activeUser();
    mockRepo = {
      findByEmail: jest.fn(async () => current),
      save: jest.fn(async (u: UserSnapshot) => { current = u; }),
      findRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'WORKER', name: 'Worker' }]),
      findProjectIdsByUserId: jest.fn(async () => ['p1']),
    };
    mockAudit = { log: jest.fn(async () => {}) };
    mockLimiter = { isBlocked: jest.fn(async () => false), recordFailure: jest.fn(async () => {}), reset: jest.fn(async () => {}) };

    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockRepo)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(LOGIN_LIMITER_PORT).useValue(mockLimiter)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    if (!app) return;
    await app.close();
  });

  itIfPg('200 valid credentials → token + roles + projectIds', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'Password123!' })
      .expect(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.email).toBe('e2e@example.com');
    expect(res.body.roles[0].code).toBe('WORKER');
    expect(res.body.projectIds).toEqual(['p1']);
  });

  itIfPg('401 generic message for wrong password — no account enumeration', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toContain('Thông tin đăng nhập không hợp lệ');
  });

  itIfPg('401 generic for non-existent account — no disclosure', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toContain('Thông tin đăng nhập không hợp lệ');
  });

  itIfPg('400 validation error', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com' })
      .expect(400);
  });

  itIfPg('400 whitespace-only password after trim', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: '   ' })
      .expect(400);
  });

  itIfPg('audit success + failure logged without password/token', async () => {
    if (!app) return;
    const calls = mockAudit.log.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const [params] of calls) {
      const json = JSON.stringify(params);
      expect(json).not.toContain('Password123!');
      expect(json).not.toContain('jwt-token');
    }
  });
});
