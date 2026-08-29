import { AuditLogEntity } from '../entity/audit-log.entity';

export interface AuditLogFilter {
  action?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  result?: 'SUCCESS' | 'FAILED';
  correlationId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLogRepositoryPort {
  findMany(filter: AuditLogFilter): Promise<{ entities: AuditLogEntity[]; total: number }>;
  findById(id: string): Promise<AuditLogEntity | null>;
  existsByCorrelation(correlationId: string, action: string, entityId?: string | null): Promise<boolean>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
