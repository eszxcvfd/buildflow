export type AuditAction =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_LOGOUT'
  | 'IAM_USER_CREATED'
  | 'IAM_USER_UPDATED'
  | 'IAM_USER_LOCKED'
  | 'IAM_USER_UNLOCKED'
  | 'IAM_USER_DEACTIVATED'
  | 'IAM_USER_REACTIVATED'
  | 'IAM_USER_STATUS_CHANGED'
  | 'IAM_ROLE_ASSIGNED'
  | 'IAM_PROFILE_UPDATED'
  | 'PROJECT_SCOPE_ADMIN_BYPASS'
  | string;

export type AuditResult = 'SUCCESS' | 'FAILED';

export interface AuditLogProps {
  id: string;
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  beforeData: unknown | null;
  afterData: unknown | null;
  result: AuditResult;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: Date;
}

export class AuditLogEntity {
  constructor(private readonly props: AuditLogProps) {}

  get id(): string { return this.props.id; }
  get actorUserId(): string | null { return this.props.actorUserId; }
  get action(): string { return this.props.action; }
  get entityType(): string { return this.props.entityType; }
  get entityId(): string | null { return this.props.entityId; }
  get beforeData(): unknown | null { return this.props.beforeData; }
  get afterData(): unknown | null { return this.props.afterData; }
  get result(): AuditResult { return this.props.result; }
  get ipAddress(): string | null { return this.props.ipAddress; }
  get userAgent(): string | null { return this.props.userAgent; }
  get correlationId(): string | null { return this.props.correlationId; }
  get createdAt(): Date { return this.props.createdAt; }

  getProps(): AuditLogProps {
    return { ...this.props };
  }

  /**
   * Ensure no secret fields leak via audit data.
   * Secrets: password, passwordHash, token, resetCode, secret, hash
   */
  static isSanitized(data: unknown): boolean {
    if (!data || typeof data !== 'object') return true;
    const str = JSON.stringify(data).toLowerCase();
    const forbidden = ['password', 'passwd', 'pwd', 'secret', 'resetcode', 'reset_code', 'token', 'jwt', 'hash'];
    // Specifically check passwordHash as key, not just any hash word in description
    const keys = Object.keys(data as Record<string, unknown>).map((k) => k.toLowerCase());
    for (const k of keys) {
      if (k.includes('password') || k.includes('secret') || k.includes('token') || k === 'passwordhash' || k === 'resetcoderaw') return false;
      if (k === 'hash' || k.includes('password_hash')) return false;
    }
    // Also brute check payload string for password field patterns: "password":"
    if (str.includes('"password"') || str.includes('"passwordhash"') || str.includes('"token"') || str.includes('"secret"')) return false;
    // Allow "passwordHash" in forgot detection already covers
    // Additional check: if data contains forbidden substrings as keys
    for (const f of forbidden) {
      // Only flag if as key pattern
      if (str.includes(`"${f}"`)) return false;
    }
    return true;
  }
}
