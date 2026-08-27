export const TOKEN_REVOCATION_PORT = Symbol('TOKEN_REVOCATION_PORT');

export interface TokenRevocationPort {
  /**
   * Revoke a token by jti until its natural expiry.
   * TTL = expiresAt - now, auto-cleanup after expiry.
   */
  revoke(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
