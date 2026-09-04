import { Global, Module } from '@nestjs/common';
import { TOKEN_REVOCATION_PORT } from '../../application/port/token-revocation.port';
import { InMemoryTokenRevocationService } from './in-memory-token-revocation.service';

/**
 * IAM-SRS-007: the revocation state (jti denylist + password-change cutoffs) must be
 * shared app-wide. A single @Global() provider guarantees IamModule and OrgModule
 * inject the SAME InMemoryTokenRevocationService instance — a cutoff set through the
 * IAM password flow is immediately enforced by guards in every module.
 */
@Global()
@Module({
  providers: [{ provide: TOKEN_REVOCATION_PORT, useClass: InMemoryTokenRevocationService }],
  exports: [TOKEN_REVOCATION_PORT],
})
export class TokenRevocationModule {}
