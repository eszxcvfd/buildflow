import { Test } from '@nestjs/testing';
import { TOKEN_REVOCATION_PORT } from '../../application/port/token-revocation.port';
import { InMemoryTokenRevocationService } from './in-memory-token-revocation.service';
import { RedisTokenRevocationService } from './redis-token-revocation.service';
import { TokenRevocationModule } from './token-revocation.module';

/**
 * `new Redis(...)` is mocked so compiling the module with REDIS_URL set never builds a
 * real socket; the factory only needs the class wiring to be observable.
 */
jest.mock('ioredis', () => {
  const instance = { set: jest.fn(), exists: jest.fn(), get: jest.fn(), on: jest.fn(), disconnect: jest.fn() };
  return { __esModule: true, default: jest.fn(() => instance) };
});

describe('TokenRevocationModule — chọn adapter theo REDIS_URL', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(async () => {
    // save/restore process.env để không nhiễm sang test khác
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
    jest.restoreAllMocks();
  });

  it('REDIS_URL set → TOKEN_REVOCATION_PORT là RedisTokenRevocationService', async () => {
    process.env.REDIS_URL = 'redis://localhost:6399';
    const moduleRef = await Test.createTestingModule({ imports: [TokenRevocationModule] }).compile();
    const port = moduleRef.get(TOKEN_REVOCATION_PORT);
    expect(port).toBeInstanceOf(RedisTokenRevocationService);
    await moduleRef.close(); // onModuleDestroy → disconnect client mock
  });

  it('không REDIS_URL → TOKEN_REVOCATION_PORT là InMemoryTokenRevocationService (fallback như cũ)', async () => {
    delete process.env.REDIS_URL;
    const moduleRef = await Test.createTestingModule({ imports: [TokenRevocationModule] }).compile();
    const port = moduleRef.get(TOKEN_REVOCATION_PORT);
    expect(port).toBeInstanceOf(InMemoryTokenRevocationService);
    await moduleRef.close();
  });

  it('REDIS_URL rỗng (empty string) → coi như không cấu hình, vẫn in-memory', async () => {
    process.env.REDIS_URL = '';
    const moduleRef = await Test.createTestingModule({ imports: [TokenRevocationModule] }).compile();
    expect(moduleRef.get(TOKEN_REVOCATION_PORT)).toBeInstanceOf(InMemoryTokenRevocationService);
    await moduleRef.close();
  });
});
