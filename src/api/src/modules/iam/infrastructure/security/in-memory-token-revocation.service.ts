import { Injectable } from '@nestjs/common';
import { TokenRevocationPort } from '../../application/port/token-revocation.port';

/**
 * In-memory jti denylist with TTL = token remaining lifetime.
 * - No migration required, minimal cost, fits single-instance MVP.
 * - Complies with DATA.md: Redis is cache-only, PostgreSQL is system of record;
 *   revocation here is short-lived coordination (cache pattern) not domain truth.
 *   Entry lives only until natural expiry, then auto-removed.
 * - Trade-off: loss on restart and not shared across multi-instance;
 *   acceptable for IAM-SRS-002 at current scale, documented for future ADR
 *   if durable or distributed revocation is required.
 */
@Injectable()
export class InMemoryTokenRevocationService implements TokenRevocationPort {
  private readonly revoked = new Map<string, number>(); // jti -> expiresAt ms

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    this.purgeExpired();
    this.revoked.set(jti, expiresAt.getTime());
  }

  async isRevoked(jti: string): Promise<boolean> {
    this.purgeExpired();
    const exp = this.revoked.get(jti);
    if (exp === undefined) return false;
    if (exp <= Date.now()) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }

  // Exposed for tests
  size(): number {
    this.purgeExpired();
    return this.revoked.size;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [jti, exp] of this.revoked.entries()) {
      if (exp <= now) this.revoked.delete(jti);
    }
  }
}
