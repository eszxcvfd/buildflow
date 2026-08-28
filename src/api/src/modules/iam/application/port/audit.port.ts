import { PoolClient } from 'pg';

export interface AuditPort {
  log(params: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    beforeData?: unknown;
    afterData?: unknown;
    result: 'SUCCESS' | 'FAILED';
    ipAddress?: string | null;
    userAgent?: string | null;
    correlationId?: string | null;
  }): Promise<void>;
  logWithClient?(client: PoolClient, params: {
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    beforeData?: unknown;
    afterData?: unknown;
    result: 'SUCCESS' | 'FAILED';
    ipAddress?: string | null;
    userAgent?: string | null;
    correlationId?: string | null;
  }): Promise<void>;
}

export const AUDIT_PORT = Symbol('AUDIT_PORT');
