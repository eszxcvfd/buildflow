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
  // IAM-SRS-007: userId -> cutoff ms; tokens issued before cutoff are rejected
  private readonly userCutoffs = new Map<string, number>();

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

  async revokeAllForUserBefore(userId: string, cutoff: Date, maxTtlMs: number): Promise<void> {
    this.purgeExpired();
    this.userCutoffs.set(userId, cutoff.getTime());
    // Self-purge when no token can still predate the cutoff
    const tid = setTimeout(() => this.userCutoffs.delete(userId), maxTtlMs);
    if (typeof tid === 'object' && 'unref' in tid) (tid as { unref: () => void }).unref();
  }

  async isUserRevokedBefore(userId: string, iat: number | undefined, cutoff: Date): Promise<boolean> {
    const set = this.userCutoffs.get(userId);
    // Effective cutoff: max(in-memory, provided from DB) — survives restarts via DB value
    const effective = set === undefined ? cutoff.getTime() : Math.max(set, cutoff.getTime());
    // Missing iat → cannot prove issued after cutoff → reject (fail closed)
    if (iat === undefined) return true;
    // 1-second acceptance window: JWT `iat` has whole-second precision, so a token is
    // only rejected when its whole second is strictly BEFORE the cutoff's whole second.
    // A token minted in the same second as the cutoff is accepted even though the ms
    // may predate the cutoff — this avoids wrongly rejecting the very tokens minted
    // right after a password change within the same second. This is safe because the
    // per-jti denylist still covers genuinely revoked sessions; the cutoff is only a
    // backstop for tokens issued before the change, not the revocation mechanism.
    return iat < Math.floor(effective / 1000);
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
