import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestDatabase, dropTestDatabase } from '../support/test-database';

describe('API (e2e, real PostgreSQL)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL = await createTestDatabase();
    process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await dropTestDatabase();
  });

  it('GET /health/live returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health/ready reports postgres and redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toEqual({
      status: 'ok',
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('GET /api/v1/status returns v1 status', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/status').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('v1');
    expect(res.body.service).toBe('buildflow-api');
  });

  it('PrismaService queries the real PostgreSQL database', async () => {
    const prisma = app.get(PrismaService);
    const rows = await prisma.$queryRaw`SELECT 1 AS one`;
    expect(rows).toEqual([{ one: 1 }]);
  });
});
