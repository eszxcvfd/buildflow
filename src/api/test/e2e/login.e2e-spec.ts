import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestDatabase, dropTestDatabase } from '../support/test-database';
import { ProblemDetailsFilter } from '../../src/shared/filters/problem-details.filter';

describe('Auth login (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const activeEmail = 'worker1@example.com';
  const activePassword = 'Password123!';
  const lockedEmail = 'locked@example.com';
  const disabledEmail = 'disabled@example.com';

  beforeAll(async () => {
    process.env.DATABASE_URL = await createTestDatabase();
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
    prisma = app.get(PrismaService);

    // Seed users directly with bcrypt cost 12
    const hashActive = await bcrypt.hash(activePassword, 12);
    const hashLocked = await bcrypt.hash('LockedPass123!', 12);
    const hashDisabled = await bcrypt.hash('DisabledPass123!', 12);

    await prisma.user.createMany({
      data: [
        { email: activeEmail, passwordHash: hashActive, status: 'ACTIVE', role: 'WORKER' },
        { email: 'worker2@example.com', passwordHash: hashActive, status: 'ACTIVE', role: 'WORKER' },
        { email: lockedEmail, passwordHash: hashLocked, status: 'LOCKED', role: 'WORKER' },
        { email: disabledEmail, passwordHash: hashDisabled, status: 'DISABLED', role: 'WORKER' },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase();
  });

  it('POST /api/v1/auth/login succeeds and token is accepted at GET /api/v1/me', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: activeEmail, password: activePassword })
      .expect(200);

    expect(loginRes.body.token).toBeDefined();
    expect(typeof loginRes.body.token).toBe('string');
    // 32 bytes hex = 64 chars
    expect(loginRes.body.token).toMatch(/^[a-f0-9]{64}$/);
    expect(loginRes.body.user.email).toBe(activeEmail);
    expect(loginRes.body.user.status).toBe('ACTIVE');

    const rawToken: string = loginRes.body.token;

    // Verify token is stored as SHA-256 hash, not plaintext
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    expect(session).not.toBeNull();
    expect(session?.tokenHash).toBe(tokenHash);
    // DB should not contain plaintext token
    const allSessions = await prisma.session.findMany();
    for (const s of allSessions) {
      expect(s.tokenHash).not.toBe(rawToken);
    }
    expect(allSessions.some((s) => s.tokenHash === rawToken)).toBe(false);

    // Token accepted at protected endpoint
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${rawToken}`)
      .expect(200);
    expect(meRes.body.email).toBe(activeEmail);
    expect(meRes.body.id).toBeDefined();
  });

  it('wrong password and non-existent account return same generic 401 INVALID_CREDENTIALS', async () => {
    const wrongPassRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: activeEmail, password: 'WrongPass123!' })
      .expect(401);

    const notFoundRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'does-not-exist@example.com', password: 'WrongPass123!' })
      .expect(401);

    for (const res of [wrongPassRes, notFoundRes]) {
      expect(res.body.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.title).toBe('Invalid credentials');
      expect(res.body.detail).toBe('Invalid email or password');
      expect(res.body.type).toBe('https://api.buildflow.invalid/problems/invalid-credentials');
      expect(res.body.traceId).toBeDefined();
    }

    // Must be identical shape (no existence leak)
    expect(wrongPassRes.body.code).toBe(notFoundRes.body.code);
    expect(wrongPassRes.body.title).toBe(notFoundRes.body.title);
    expect(wrongPassRes.body.detail).toBe(notFoundRes.body.detail);
    expect(wrongPassRes.body.status).toBe(notFoundRes.body.status);
  });

  it('locked and disabled accounts are rejected with same generic 401', async () => {
    const lockedRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: lockedEmail, password: 'LockedPass123!' })
      .expect(401);

    const disabledRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: disabledEmail, password: 'DisabledPass123!' })
      .expect(401);

    for (const res of [lockedRes, disabledRes]) {
      expect(res.body.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.title).toBe('Invalid credentials');
      expect(res.body.detail).toBe('Invalid email or password');
    }
  });

  it('unauthenticated request to GET /api/v1/me is rejected 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    expect(res.body.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.traceId).toBeDefined();
  });

  it('invalid token is rejected 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer invalid-token-xyz')
      .expect(401);
    expect(res.body.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('validation error returns 400 problem-details', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(400);
    expect(res.body.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.title).toBe('Validation failed');
    expect(res.body.traceId).toBeDefined();
  });
});
