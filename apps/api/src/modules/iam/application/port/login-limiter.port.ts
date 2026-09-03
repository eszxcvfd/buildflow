export interface LoginLimiterPort {
  /**
   * Sliding-window failure counter per IP+email key (NFR-SEC-005).
   * Returns true when the caller is currently blocked.
   */
  isBlocked(key: string): Promise<boolean>;
  recordFailure(key: string, windowSeconds: number): Promise<void>;
  reset(key: string): Promise<void>;
}

export const LOGIN_LIMITER_PORT = Symbol('LOGIN_LIMITER_PORT');
