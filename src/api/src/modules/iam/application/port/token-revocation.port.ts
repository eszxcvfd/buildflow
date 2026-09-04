export const TOKEN_REVOCATION_PORT = Symbol('TOKEN_REVOCATION_PORT');

export interface TokenRevocationPort {
  /**
   * Revoke a token by jti until its natural expiry.
   * TTL = expiresAt - now, auto-cleanup after expiry.
   */
  revoke(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
  /**
   * IAM-SRS-007: revoke every token for userId issued before cutoff (password change/reset).
   * cutoff = password_changed_at; tokens without iat are treated as issued before cutoff.
   */
  revokeAllForUserBefore?(userId: string, cutoff: Date, maxTtlMs: number): Promise<void>;
  isUserRevokedBefore?(userId: string, iat: number | undefined, cutoff: Date): Promise<boolean>;
}
