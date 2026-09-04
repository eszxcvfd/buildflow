import { Global, Module } from '@nestjs/common';
import { loadConfig } from '../../../../config/configuration';
import { TOKEN_REVOCATION_PORT } from '../../application/port/token-revocation.port';
import { InMemoryTokenRevocationService } from './in-memory-token-revocation.service';
import { RedisTokenRevocationService } from './redis-token-revocation.service';

/**
 * IAM-SRS-007: the revocation state (jti denylist + password-change cutoffs) must be
 * shared app-wide. A single @Global() provider guarantees IamModule and OrgModule
 * inject the SAME revocation service instance — a cutoff set through the IAM password
 * flow is immediately enforced by guards in every module.
 *
 * The port is resolved by a FACTORY (not useClass) because the adapter depends on
 * deployment topology, not on code: with REDIS_URL configured, revocation is shared
 * across instances through Redis (cache/coordination only — PostgreSQL
 * `users.password_changed_at` stays the system of truth per DATA.md); without it we
 * keep the zero-dependency in-memory adapter. Both concrete classes are registered so
 * test overrides of TOKEN_REVOCATION_PORT keep working and no provider is missing.
 */
@Global()
@Module({
  providers: [
    InMemoryTokenRevocationService,
    RedisTokenRevocationService,
    {
      provide: TOKEN_REVOCATION_PORT,
      useFactory: (redis: RedisTokenRevocationService, inMemory: InMemoryTokenRevocationService) =>
        loadConfig().redisUrl ? redis : inMemory,
      inject: [RedisTokenRevocationService, InMemoryTokenRevocationService],
    },
  ],
  exports: [TOKEN_REVOCATION_PORT],
})
export class TokenRevocationModule {}
