import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestDatabase, dropTestDatabase } from '../support/test-database';
import { ProblemDetailsFilter } from '../../src/shared/filters/problem-details.filter';

describe('Auth logout & session expiry (e2e, real PostgreSQL) — IAM-SRS-002', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = 'worker1@example.com';
  const password = 'Password123!';

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

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email, passwordHash: hash, status: 'ACTIVE', role: 'WORKER' },
    });
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase();
  });

  it('health and status routes are public (no token required)', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    await request(app.getHttpServer()).get('/api/v1/status').expect(200);
  });

  it('protected route requires token and logout invalidates current session without losing persisted data', async () => {
    // Login to get token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const token: string = loginRes.body.token;
    expect(token).toMatch(/^[a-f0-9]{64}$/);

    // Protected route succeeds with valid token
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Verify session exists in DB as hash
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const sessionBefore = await prisma.session.findUnique({ where: { tokenHash } });
    expect(sessionBefore).not.toBeNull();

    // Logout current session — 204
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Session row deleted
    const sessionAfter = await prisma.session.findUnique({ where: { tokenHash } });
    expect(sessionAfter).toBeNull();

    // Business data preserved: user still exists
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(email);
    expect(user?.status).toBe('ACTIVE');

    // Subsequent request with revoked token is 401
    const meAfter = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    expect(meAfter.body.code).toBe('UNAUTHORIZED');
    expect(meAfter.body.status).toBe(401);

    // Second logout with same revoked token also 401 (guard rejects)
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    // Can still login again — data not lost, new session works
    const login2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(login2.body.token).toBeDefined();
    expect(login2.body.token).not.toBe(token);
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login2.body.token}`)
      .expect(200);
  });

  it('request with expired token is rejected 401', async () => {
    // Create an expired session directly in DB
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();

    await prisma.session.create({
      data: {
        userId: user!.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${rawToken}`)
      .expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');

    // Expired session should have been cleaned up by guard (best-effort)
    const after = await prisma.session.findUnique({ where: { tokenHash } });
    expect(after).toBeNull();
  });

  it('request with never-issued token is rejected 401 with same shape as revoked', async () => {
    const randomToken = randomBytes(32).toString('hex');
    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${randomToken}`)
      .expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.status).toBe(401);
  });

  it('session guard protects /api/v1/me but not health; logout requires auth', async () => {
    // No token -> 401 for protected
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    // No token -> 200 for health
    await request(app.getHttpServer()).get('/health/live').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('multiple sessions are independent: logging out one does not revoke the other', async () => {
    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const tokenA: string = loginA.body.token;

    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const tokenB: string = loginB.body.token;
    expect(tokenA).not.toBe(tokenB);

    // Logout A
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);

    // A revoked
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(401);

    // B still valid
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    // Cleanup B
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(204);
  });
});
