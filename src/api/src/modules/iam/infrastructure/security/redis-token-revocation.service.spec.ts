import { Logger } from '@nestjs/common';
import { RedisTokenRevocationService } from './redis-token-revocation.service';

/**
 * Mock ioredis: `new Redis(...)` returns the shared `redisClient` below so tests can
 * stub SET/EXISTS/GET and assert call args. lazyConnect semantics are irrelevant here
 * because the client is fully mocked.
 */
jest.mock('ioredis', () => {
  const instance = {
    set: jest.fn(),
    exists: jest.fn(),
    get: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
  };
  const RedisMock = jest.fn(() => instance);
  return { __esModule: true, default: RedisMock, __instance: instance };
});

const ioredisMock = jest.requireMock('ioredis') as {
  default: jest.Mock;
  __instance: {
    set: jest.Mock;
    exists: jest.Mock;
    get: jest.Mock;
    on: jest.Mock;
    disconnect: jest.Mock;
  };
};
const RedisCtor = ioredisMock.default;
const redisClient = ioredisMock.__instance;

const NOW = 1_700_000_000_000; // fixed epoch-ms for deterministic TTL math
const DB_CUTOFF = new Date(NOW);

/** Restore deterministic stubs after each test's per-branch overrides. */
function stubDefaults(): void {
  redisClient.set.mockReset().mockResolvedValue('OK');
  redisClient.exists.mockReset().mockResolvedValue(0);
  redisClient.get.mockReset().mockResolvedValue(null);
  redisClient.on.mockReset().mockReturnValue(undefined);
  redisClient.disconnect.mockReset().mockReturnValue(undefined);
}

function newService(): RedisTokenRevocationService {
  return new RedisTokenRevocationService();
}

describe('RedisTokenRevocationService', () => {
  let warnSpy: jest.SpyInstance;
  let dateNowSpy: jest.SpyInstance;

  beforeAll(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    stubDefaults();
    process.env.REDIS_URL = 'redis://localhost:6379';
    RedisCtor.mockClear();
    warnSpy.mockClear();
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    dateNowSpy.mockRestore();
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  describe('revoke — jti denylist (IAM-SRS-002)', () => {
    it('ghi đúng key `iam:revoked:jti:<jti>` với EX = ceil(expiresAt - now) giây', async () => {
      const svc = newService();
      await svc.revoke('jti-1', new Date(NOW + 4_000));
      expect(redisClient.set).toHaveBeenCalledWith('iam:revoked:jti:jti-1', '1', 'EX', 4);
    });

    it('EX được làm tròn lên khi expiresAt lệch dưới-giây', async () => {
      const svc = newService();
      await svc.revoke('jti-1', new Date(NOW + 1_500));
      expect(redisClient.set).toHaveBeenCalledWith('iam:revoked:jti:jti-1', '1', 'EX', 2);
    });

    it('expiresAt đã quá khứ → TTL tối thiểu 1 giây', async () => {
      const svc = newService();
      await svc.revoke('jti-1', new Date(NOW - 60_000));
      expect(redisClient.set).toHaveBeenCalledWith('iam:revoked:jti:jti-1', '1', 'EX', 1);
    });

    it('isRevoked: EXISTS > 0 → true', async () => {
      redisClient.exists.mockResolvedValue(1);
      await expect(newService().isRevoked('jti-1')).resolves.toBe(true);
    });

    it('isRevoked: EXISTS = 0 (miss) → false', async () => {
      await expect(newService().isRevoked('jti-miss')).resolves.toBe(false);
    });
  });

  describe('revokeAllForUserBefore — user cutoff (IAM-SRS-007)', () => {
    it('SET đúng key `iam:revoked:user:<userId>`, giá trị cutoff epoch-ms, EX = ceil(maxTtlMs/1000)', async () => {
      await newService().revokeAllForUserBefore('u1', DB_CUTOFF, 3_600_000);
      expect(redisClient.set).toHaveBeenCalledWith('iam:revoked:user:u1', String(NOW), 'EX', 3600);
    });

    it('maxTtlMs nhỏ hơn 1 giây → EX tối thiểu 1 (tái tạo semantics tự purge của in-memory)', async () => {
      await newService().revokeAllForUserBefore('u1', DB_CUTOFF, 500);
      expect(redisClient.set).toHaveBeenCalledWith('iam:revoked:user:u1', String(NOW), 'EX', 1);
    });
  });

  describe('isUserRevokedBefore — effective cutoff = max(redis, db)', () => {
    const REDIS_LATER = NOW + 60_000;
    const REDIS_EARLIER = NOW - 120_000;

    it('redis cutoff muộn hơn db cutoff → iat cũ hơn redis cutoff bị từ chối', async () => {
      redisClient.get.mockResolvedValue(String(REDIS_LATER));
      const iat = Math.floor(NOW / 1000) + 5; // sau db cutoff, trước redis cutoff
      await expect(newService().isUserRevokedBefore('u1', iat, DB_CUTOFF)).resolves.toBe(true);
    });

    it('redis cutoff muộn hơn → iat sau redis cutoff cho qua', async () => {
      redisClient.get.mockResolvedValue(String(REDIS_LATER));
      const iat = Math.floor(REDIS_LATER / 1000) + 5;
      await expect(newService().isUserRevokedBefore('u1', iat, DB_CUTOFF)).resolves.toBe(false);
    });

    it('redis cutoff sớm hơn db cutoff → dùng max (= db cutoff), không hạ thấp việc enforce', async () => {
      redisClient.get.mockResolvedValue(String(REDIS_EARLIER));
      const iat = Math.floor(REDIS_EARLIER / 1000) + 5; // sau redis cutoff, trước db cutoff
      await expect(newService().isUserRevokedBefore('u1', iat, DB_CUTOFF)).resolves.toBe(true);
      const iatAfter = Math.floor(NOW / 1000) + 5;
      await expect(newService().isUserRevokedBefore('u1', iatAfter, DB_CUTOFF)).resolves.toBe(false);
    });

    it('giá trị redis không parse được thành số → coi như không có, dùng db cutoff', async () => {
      redisClient.get.mockResolvedValue('not-a-number');
      const iat = Math.floor(NOW / 1000) + 5;
      await expect(newService().isUserRevokedBefore('u1', iat, DB_CUTOFF)).resolves.toBe(false);
    });

    it('thiếu iat → true (fail-closed, bất kể redis có cutoff hay không)', async () => {
      redisClient.get.mockResolvedValue(String(REDIS_LATER));
      await expect(newService().isUserRevokedBefore('u1', undefined, DB_CUTOFF)).resolves.toBe(true);
    });

    it('biên equality: iat*1000 == effective cutoff → false (chỉ token phát TRƯỚC cutoff bị chặn)', async () => {
      redisClient.get.mockResolvedValue(String(NOW));
      const iat = Math.floor(NOW / 1000);
      await expect(newService().isUserRevokedBefore('u1', iat, DB_CUTOFF)).resolves.toBe(false);
    });
  });

  describe('resilience khi Redis lỗi', () => {
    it('isRevoked lỗi → fail-open (false) + warn có rate-limit, không crash', async () => {
      redisClient.exists.mockRejectedValue(new Error('connection down'));
      const svc = newService();
      await expect(svc.isRevoked('jti-1')).resolves.toBe(false);
      await expect(svc.isRevoked('jti-1')).resolves.toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1); // warn thứ hai bị throttle trong cửa sổ
    });

    it('revoke lỗi → warn + swallow, không phá request', async () => {
      redisClient.set.mockRejectedValue(new Error('write failed'));
      await expect(newService().revoke('jti-1', new Date(NOW + 1_000))).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('revokeAllForUserBefore lỗi → warn + swallow, không crash', async () => {
      redisClient.set.mockRejectedValue(new Error('write failed'));
      await expect(newService().revokeAllForUserBefore('u1', DB_CUTOFF, 3_600_000)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('isUserRevokedBefore GET lỗi → fallback tính theo cutoff từ DB (không crash)', async () => {
      redisClient.get.mockRejectedValue(new Error('read failed'));
      const svc = newService();
      const iatBefore = Math.floor(NOW / 1000) - 5;
      const iatAfter = Math.floor(NOW / 1000) + 5;
      await expect(svc.isUserRevokedBefore('u1', iatBefore, DB_CUTOFF)).resolves.toBe(true);
      await expect(svc.isUserRevokedBefore('u1', iatAfter, DB_CUTOFF)).resolves.toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1); // throttle: 2 lần đọc lỗi chỉ warn 1 lần
    });
  });

  describe('không có REDIS_URL (defensive)', () => {
    beforeEach(() => {
      delete process.env.REDIS_URL;
    });

    it('không tạo client ioredis và các thao tác degrade an toàn', async () => {
      const svc = newService();
      expect(RedisCtor).not.toHaveBeenCalled();
      await svc.revoke('jti-1', new Date(NOW + 1_000)); // no-op, không crash
      await expect(svc.isRevoked('jti-1')).resolves.toBe(false);
      await svc.revokeAllForUserBefore('u1', DB_CUTOFF, 3_600_000); // no-op
      const iatBefore = Math.floor(NOW / 1000) - 5;
      const iatAfter = Math.floor(NOW / 1000) + 5;
      await expect(svc.isUserRevokedBefore('u1', iatBefore, DB_CUTOFF)).resolves.toBe(true);
      await expect(svc.isUserRevokedBefore('u1', iatAfter, DB_CUTOFF)).resolves.toBe(false);
      expect(redisClient.set).not.toHaveBeenCalled();
      expect(redisClient.get).not.toHaveBeenCalled();
    });
  });

  describe('vòng đời client', () => {
    it('tạo đúng 1 client dùng chung với tùy chọn như health probe', () => {
      newService();
      expect(RedisCtor).toHaveBeenCalledTimes(1);
      expect(RedisCtor).toHaveBeenCalledWith('redis://localhost:6379', {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
      });
    });

    it('onModuleDestroy disconnect client', async () => {
      const svc = newService();
      await svc.onModuleDestroy();
      expect(redisClient.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
