import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { TOKEN_PORT } from '../src/modules/iam/application/port/token.port';
import { TOKEN_REVOCATION_PORT } from '../src/modules/iam/application/port/token-revocation.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';

describe('IAM-SRS-002 Đăng xuất và hết phiên (e2e)', () => {
  let app: INestApplication;
  let userEntity: UserEntity;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-logout-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    userEntity = new UserEntity({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'logout-e2e@example.com',
      passwordHash: await bcrypt.hash('Password123!', 10),
      fullName: 'Logout E2E',
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

    const mockAudit = { log: jest.fn(async () => {}) };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY).useValue(mockRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('đăng xuất làm mất hiệu lực phiên hiện tại, token sau đó bị từ chối 401', async () => {
    // login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'logout-e2e@example.com', password: 'Password123!' })
      .expect(200);
    const token = loginRes.body.accessToken as string;
    expect(token).toBeDefined();

    // me with fresh token OK
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);

    // logout
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);

    // subsequent request with same token must be 401 Phiên hết hạn
    const after = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    expect(after.body.message).toBe('Phiên hết hạn, vui lòng đăng nhập lại');

    // also logout endpoint itself with revoked token should 401
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('dữ liệu đã lưu hợp lệ không bị mất sau đăng xuất (login lại thành công)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'logout-e2e@example.com', password: 'Password123!' })
      .expect(200);
    const token = loginRes.body.accessToken as string;
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
    // login again with same credentials must succeed (data not lost)
    const relogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'logout-e2e@example.com', password: 'Password123!' })
      .expect(200);
    expect(relogin.body.accessToken).toBeDefined();
    // new token must be usable
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${relogin.body.accessToken}`).expect(200);
  });

  it('yêu cầu với phiên hết hạn/bị thu hồi bị từ chối 401 thống nhất', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid.token.here').expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });
});
