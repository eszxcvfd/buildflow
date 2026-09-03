export interface AuditLogParams {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  afterData?: unknown;
  result: 'SUCCESS' | 'FAILED';
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditPort {
  log(params: AuditLogParams): Promise<void>;
}

export const AUDIT_PORT = Symbol('AUDIT_PORT');
