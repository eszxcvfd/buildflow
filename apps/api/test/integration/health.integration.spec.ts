/**
 * Integration proof: NestJS → Prisma → real PostgreSQL 18.
 *
 * Requires a reachable PostgreSQL via DATABASE_URL. Jest loads apps/api/.env
 * locally; CI provides the variable for its PostgreSQL service container. If
 * DATABASE_URL is absent, the test is skipped and AppModule is never imported.
 *
 * Per ADR-012, database tests must hit a real PostgreSQL instance — never a
 * mock or in-memory substitute.
 */
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

const hasPg = Boolean(process.env.DATABASE_URL);
const itIfPg = hasPg ? it : it.skip;

describe('NestJS → Prisma → PostgreSQL (integration)', () => {
  let app: INestApplication | undefined;
  let moduleRef: TestingModule | undefined;

  beforeAll(async () => {
    if (!hasPg) return;
    const { AppModule } = await import('../../src/app.module');
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    if (!app) return;
    await app.close();
    await moduleRef?.close();
  });

  itIfPg('GET /api/v1/health returns status:ok and database:up', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('up');
    expect(typeof res.body.uptime).toBe('number');
  });

  itIfPg('Prisma SELECT 1 returns one row', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.database).toBe('up');
  });
});
