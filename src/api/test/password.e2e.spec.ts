import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { JwtTokenService } from '../src/modules/iam/infrastructure/security/jwt-token.service';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { PASSWORD_RESET_REPOSITORY, PasswordResetTokenRecord } from '../src/modules/iam/domain/repository/password-reset.repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const USER2_ID = '22222222-2222-2222-2222-222222222222';
const USER3_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';
const CURRENT_PASSWORD = 'Password123!';
const NEW_PASSWORD = 'NewPassword456!';

/** In-memory password_reset_tokens — no PostgreSQL needed for these HTTP tests. */
class InMemoryPasswordResetRepo {
  rows: PasswordResetTokenRecord[] = [];

  async create(record: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetTokenRecord> {
    const row: PasswordResetTokenRecord = { id: randomUUID(), usedAt: null, createdAt: new Date(), ...record };
    this.rows.push(row);
    return row;
  }

  async findLatestUsableByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
    const now = new Date();
    const usable = this.rows
      .filter((r) => r.tokenHash === tokenHash && r.usedAt === null && r.expiresAt.getTime() > now.getTime())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return usable[0] ?? null;
  }

  async markUsed(id: string, usedAt: Date): Promise<void> {
    const row = this.rows.find((r) => r.id === id);
    if (row) row.usedAt = usedAt;
  }

  async invalidateAllForUser(userId: string, now: Date): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.userId === userId && row.usedAt === null) {
        row.usedAt = now;
        count += 1;
      }
    }
    return count;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.expiresAt.getTime() > now.getTime());
    return before - this.rows.length;
  }
}

describe('IAM-SRS-007 password endpoints (HTTP contract, no real DB)', () => {
  let app: INestApplication;
  let resetRepo: InMemoryPasswordResetRepo;
  let updatePasswordHash: jest.Mock;
  let auditLog: jest.Mock;
  // Conditional-claim counter mimicking `UPDATE ... WHERE used_at IS NULL` rowCount
  let claimCount: number;

  const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

  async function issueTokenForUser(userId: string): Promise<string> {
    const raw = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    await resetRepo.create({ userId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
    return raw;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-password-secret-0123456789abcdef';
    process.env.JWT_EXPIRES_IN = '1h';
    claimCount = 0;
    resetRepo = new InMemoryPasswordResetRepo();
    updatePasswordHash = jest.fn(async () => 1);
    auditLog = jest.fn(async () => undefined);

    // Tiny fake-DB for the password cutoff: updatePasswordHash persists password_changed_at,
    // getPasswordChangedAt reads it back (like the real columns).
    let dbPasswordChangedAt: Date | null = null;
    updatePasswordHash.mockImplementation(async (_id: string, _hash: string, changedAt: Date) => {
      dbPasswordChangedAt = changedAt;
      return 1;
    });

    const userEntity = new UserEntity({
      id: USER_ID,
      email: 'e2e@example.com',
      passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 10),
      fullName: 'E2E User',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const user2Entity = new UserEntity({
      id: USER2_ID,
      email: 'e2e2@example.com',
      passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 10),
      fullName: 'E2E User 2',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const user3Entity = new UserEntity({
      id: USER3_ID,
      email: 'e2e3@example.com',
      passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 10),
      fullName: 'E2E User 3',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockRepo = {
      findByEmail: jest.fn(async (email: string) => {
        if (email.toLowerCase() === 'e2e@example.com') return userEntity;
        if (email.toLowerCase() === 'e2e2@example.com') return user2Entity;
        if (email.toLowerCase() === 'e2e3@example.com') return user3Entity;
        return null;
      }),
      findById: jest.fn(async (id: string) =>
        id === USER_ID ? userEntity : id === USER2_ID ? user2Entity : id === USER3_ID ? user3Entity : null),
      save: jest.fn(async () => undefined),
      create: jest.fn(async () => undefined),
      findActiveRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'WORKER', name: 'Worker' }]),
      findActiveProjectIdsByUserId: jest.fn(async () => ['proj-1']),
      updatePasswordHash,
      getPasswordChangedAt: jest.fn(async () => dbPasswordChangedAt),
    };

    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };

    // Fake tx: conditional claim returns rowCount 1 on first call, 0 afterwards —
    // same semantics as the real one-time UPDATE under concurrency.
    const fakeTx = {
      withTransaction: async (fn: (client: { query: (q: string) => Promise<{ rowCount: number }> }) => Promise<unknown>) =>
        fn({
          query: async (q: string) => {
            if (q.includes('used_at = $2')) {
              claimCount += 1;
              return { rowCount: claimCount === 1 ? 1 : 0 };
            }
            return { rowCount: 1 };
          },
        }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(USER_REPOSITORY).useValue(mockRepo)
      .overrideProvider(PASSWORD_RESET_REPOSITORY).useValue(resetRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(AUDIT_PORT).useValue({ log: auditLog, logWithClient: auditLog })
      .compile();

    app = moduleRef.createNestApplication();
    // KHÔNG đăng ký global pipe: mirror production (main.ts), nơi mỗi controller tự gắn
    // ValidationPipe theo route. Global forbidNonWhitelisted ở đây sẽ che khuất hành vi
    // strip của route /me/password.
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function authHeader(userId: string = USER_ID): Promise<string> {
    const jwtService = app.get(JwtTokenService);
    const email = userId === USER_ID ? 'e2e@example.com' : userId === USER2_ID ? 'e2e2@example.com' : 'e2e3@example.com';
    const { token } = await jwtService.sign({ sub: userId, email, roles: ['WORKER'] });
    return `Bearer ${token}`;
  }

  describe('PATCH /api/v1/me/password', () => {
    it('không có JWT → 401', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Phiên hết hạn, vui lòng đăng nhập lại');
    });

    it('JWT hợp lệ + sai currentPassword → 400 kèm field error currentPassword, password không đổi', async () => {
      updatePasswordHash.mockClear();
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', await authHeader())
        .send({ currentPassword: 'TotallyWrong1', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Mật khẩu hiện tại không đúng');
      expect(res.body.errors?.currentPassword).toContain('Mật khẩu hiện tại không đúng');
      expect(updatePasswordHash).not.toHaveBeenCalled();
    });

    it('body kèm trường userId của user khác → vẫn đổi cho subject của JWT', async () => {
      updatePasswordHash.mockClear();
      // dùng user2 để tránh cutoffCache 30s của guard trong app instance
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', await authHeader(USER2_ID))
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD, userId: OTHER_USER_ID });
      expect(res.status).toBe(200);
      expect(res.body.reauthRequired).toBe(true);
      // hash được cập nhật cho đúng subject của JWT, không phải userId client tự khai
      expect(updatePasswordHash).toHaveBeenCalledTimes(1);
      expect(updatePasswordHash.mock.calls[0][0]).toBe(USER2_ID);
      expect(updatePasswordHash.mock.calls[0][0]).not.toBe(OTHER_USER_ID);
    });

    it('confirmPassword mismatch → 400 kèm field error confirmPassword', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', await authHeader())
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: 'Different123!' });
      expect(res.status).toBe(400);
      expect(res.body.errors?.confirmPassword).toBeDefined();
      expect(res.body.message).toContain('khớp');
    });

    it('thiếu confirmPassword (bắt buộc theo contract) → 400', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', await authHeader())
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('đổi thành công → 200 + reauthRequired (đổi cho subject JWT)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', await authHeader(USER2_ID))
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.reauthRequired).toBe(true);
    });

    it('đổi mật khẩu (qua reset flow, không qua guard) → token cũ phát TRƯỚC cutoff bị 401 ở request sau', async () => {
      // token cũ: ký TRƯỚC khi đổi mật khẩu
      const oldAuth = await authHeader(USER3_ID);
      await new Promise((r) => setTimeout(r, 1100)); // đảm bảo changedAt vượt qua giây của iat
      claimCount = 0;
      const raw = await issueTokenForUser(USER3_ID);
      const confirm = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(confirm.status).toBe(200);

      // request sau với token cũ → password_changed_at (DB) + in-memory cutoff → 401
      const after = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', oldAuth);
      expect(after.status).toBe(401);
      expect(after.body.message).toBe('Phiên hết hạn, vui lòng đăng nhập lại');
    });
  });

  describe('POST /api/v1/auth/password-reset/request', () => {
    it('email tồn tại vs không tồn tại → status + body GIỐNG HỆT (deep equal), không có resetUrl', async () => {
      const known = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'e2e@example.com' });
      const unknown = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'ghost@example.com' });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(known.status);
      expect(known.body).toEqual(unknown.body);
      expect(known.body.message).toContain('Nếu email tồn tại');
      expect(known.body).not.toHaveProperty('resetUrl');
      expect(unknown.body).not.toHaveProperty('resetUrl');
      // JSON shape identical: only `message` key
      expect(Object.keys(known.body).sort()).toEqual(['message']);
    });

    it('email không hợp lệ → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/password-reset/confirm', () => {
    it('token invalid (không tồn tại) → 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: 'does-not-exist-anywhere', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(401);
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_PASSWORD_RESET_FAILED', result: 'FAILED' }));
    });

    it('token đã used lần 2 → 401 (one-time claim)', async () => {
      claimCount = 0;
      const raw = await issueTokenForUser(USER_ID);
      const first = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(first.status).toBe(200);
      const second = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(second.status).toBe(401);
    });

    it('confirmPassword mismatch → 400 kèm field error confirmPassword', async () => {
      claimCount = 0;
      const raw = await issueTokenForUser(USER_ID);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: 'Different123!' });
      expect(res.status).toBe(400);
      expect(res.body.errors?.confirmPassword).toBeDefined();
      // mismatch KHÔNG tiêu thụ token (request tiếp theo vẫn dùng được)
      const retry = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(retry.status).toBe(200);
    });

    it('body rỗng → 400 message dạng mảng', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({});
      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('body format sai (confirmPassword là số) → 400 message dạng mảng', async () => {
      const raw = await issueTokenForUser(USER_ID);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: 12345678 });
      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('confirm thành công → 200 + reauthRequired', async () => {
      claimCount = 0;
      const raw = await issueTokenForUser(USER_ID);
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', reauthRequired: true });
    });
  });

  describe('X-Correlation-Id lenient wiring qua HTTP (IAM-SRS-008)', () => {
    const CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

    function lastAuditCall(action: string): Record<string, unknown> {
      const calls = (auditLog as unknown as jest.Mock).mock.calls as unknown as Array<[Record<string, unknown>]>;
      const matched = calls.filter((c) => c[0].action === action);
      return matched[matched.length - 1][0];
    }

    it('reset-request (email tồn tại) với header hợp lệ → audit IAM_PASSWORD_RESET_REQUESTED mang correlationId', async () => {
      (auditLog as unknown as jest.Mock).mockClear();
      await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .set('X-Correlation-Id', CORR)
        .send({ email: 'e2e@example.com' })
        .expect(200);
      expect(lastAuditCall('IAM_PASSWORD_RESET_REQUESTED').correlationId).toBe(CORR);
    });

    it('reset-request header không phải UUID → vẫn 200, correlationId null (lenient, không block public flow)', async () => {
      (auditLog as unknown as jest.Mock).mockClear();
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/request')
        .set('X-Correlation-Id', 'not-a-uuid')
        .send({ email: 'ghost@example.com' })
        .expect(200);
      expect(res.body.message).toContain('Nếu email tồn tại');
      expect(lastAuditCall('IAM_PASSWORD_RESET_REQUESTED').correlationId).toBeNull();
    });

    it('confirm thành công với header hợp lệ → audit IAM_PASSWORD_RESET_COMPLETED mang correlationId', async () => {
      claimCount = 0;
      (auditLog as unknown as jest.Mock).mockClear();
      const raw = await issueTokenForUser(USER_ID);
      await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .set('X-Correlation-Id', CORR)
        .send({ token: raw, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD })
        .expect(200);
      const calls = (auditLog as unknown as jest.Mock).mock.calls as unknown as Array<[unknown, Record<string, unknown>]>;
      const completed = calls.filter((c) => c[1] && c[1].action === 'IAM_PASSWORD_RESET_COMPLETED');
      expect(completed[completed.length - 1][1].correlationId).toBe(CORR);
    });

    it('confirm token sai với header không phải UUID → 401 (không 400) và FAILED audit correlationId null', async () => {
      (auditLog as unknown as jest.Mock).mockClear();
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/password-reset/confirm')
        .set('X-Correlation-Id', 'not-a-uuid')
        .send({ token: 'does-not-exist-anywhere', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(401);
      expect(lastAuditCall('IAM_PASSWORD_RESET_FAILED').correlationId).toBeNull();
    });

    it('change-password (PATCH /me/password) header hợp lệ → audit IAM_PASSWORD_CHANGED mang correlationId', async () => {
      (auditLog as unknown as jest.Mock).mockClear();
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/password')
        .set('Authorization', await authHeader(USER2_ID))
        .set('X-Correlation-Id', CORR)
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      const calls = (auditLog as unknown as jest.Mock).mock.calls as unknown as Array<[unknown, Record<string, unknown>]>;
      const changed = calls.filter((c) => c[1] && c[1].action === 'IAM_PASSWORD_CHANGED');
      expect(changed[changed.length - 1][1].correlationId).toBe(CORR);
    });
  });
});
