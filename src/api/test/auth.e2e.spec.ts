import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { TOKEN_PORT } from '../src/modules/iam/application/port/token.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';

describe('POST /api/v1/auth/login (e2e contract)', () => {
  let app: INestApplication;
  let userEntity: UserEntity;

  beforeAll(async () => {
    userEntity = new UserEntity({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'e2e@example.com',
      passwordHash: await bcrypt.hash('Password123!', 10),
      fullName: 'E2E User',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRepo = {
      findByEmail: jest.fn(async (email: string) => (email.toLowerCase() === userEntity.email.toLowerCase() ? userEntity : null)),
      findById: jest.fn(async () => userEntity),
      save: jest.fn(async (u: UserEntity) => { userEntity = u; }),
      findActiveRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'WORKER', name: 'Worker' }]),
      findActiveProjectIdsByUserId: jest.fn(async () => ['proj-1']),
    };

    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };

    const mockToken = {
      sign: jest.fn(async (payload) => ({ token: `mock-jwt-${payload.sub}`, expiresAt: new Date(Date.now() + 3600 * 1000) })),
      verify: jest.fn(),
    };

    const mockAudit = { log: jest.fn(async () => {}) };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY).useValue(mockRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(TOKEN_PORT).useValue(mockToken)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 với thông tin hợp lệ', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'Password123!' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('e2e@example.com');
    expect(res.body.roles[0].code).toBe('WORKER');
  });

  it('401 generic khi sai mật khẩu (không lộ tồn tại)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toContain('Thông tin đăng nhập không hợp lệ');
  });

  it('400 khi thiếu field', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e@example.com' })
      .expect(400);
  });
});
