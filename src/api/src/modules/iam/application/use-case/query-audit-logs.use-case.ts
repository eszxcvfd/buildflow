import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AUDIT_LOG_REPOSITORY, AuditLogRepositoryPort, AuditLogFilter } from '../../domain/repository/audit-log-repository.port';
import { AuditLogEntity } from '../../domain/entity/audit-log.entity';

export interface QueryAuditLogsInput {
  actorUserId: string;
  actorRoles: string[];
  filter: AuditLogFilter;
}

export interface QueryAuditLogsOutput {
  entities: AuditLogEntity[];
  total: number;
}

const ALLOWED_ACTIONS = new Set([
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_LOGOUT',
  'IAM_USER_CREATED',
  'IAM_USER_UPDATED',
  'IAM_USER_LOCKED',
  'IAM_USER_UNLOCKED',
  'IAM_USER_DEACTIVATED',
  'IAM_USER_REACTIVATED',
  'IAM_USER_STATUS_CHANGED',
  'IAM_ROLE_ASSIGNED',
  'IAM_PROFILE_UPDATED',
  'PROJECT_SCOPE_ADMIN_BYPASS',
]);

@Injectable()
export class QueryAuditLogsUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepo: AuditLogRepositoryPort,
  ) {}

  async execute(input: QueryAuditLogsInput): Promise<QueryAuditLogsOutput> {
    // Server-side authorization: only ADMIN can query audit trail
    if (!input.actorRoles.includes('ADMIN')) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    const f = input.filter;

    if (f.limit !== undefined) {
      if (!Number.isInteger(f.limit) || f.limit < 1 || f.limit > 100) {
        throw new BadRequestException('Limit không hợp lệ (1-100)');
      }
    }
    if (f.offset !== undefined) {
      if (!Number.isInteger(f.offset) || f.offset < 0) {
        throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
      }
    }
    if (f.action && !ALLOWED_ACTIONS.has(f.action) && f.action !== '') {
      // Allow any action but validate format: alphanumeric + underscore
      if (!/^[A-Z_]{3,50}$/.test(f.action)) {
        throw new BadRequestException('Action không hợp lệ');
      }
    }
    if (f.result && !['SUCCESS', 'FAILED'].includes(f.result)) {
      throw new BadRequestException('Result không hợp lệ');
    }
    if (f.from && f.to && f.from.getTime() > f.to.getTime()) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ');
    }

    // Apply sanitization check: ensure stored data does not contain secrets (defense in depth)
    // This does not filter but verifies; if leak detected, we still return but log would be flagged
    // Actual secret filtering happens at write time (log payloads use toPublicProfile, never passwordHash)
    const result = await this.auditLogRepo.findMany({
      action: f.action,
      actorUserId: f.actorUserId,
      entityType: f.entityType,
      entityId: f.entityId,
      result: f.result,
      correlationId: f.correlationId,
      from: f.from,
      to: f.to,
      limit: f.limit,
      offset: f.offset,
    });

    // Post-read sanitization guard: reject the listing if any record contains a
    // secret — secrets must never be exposed (IAM-SRS-008). The write path should
    // have prevented this; append-only storage means a poisoned record can only
    // be removed via an owner-approved migration, not deleted ad hoc.
    for (const e of result.entities) {
      const before = e.beforeData as Record<string, unknown> | null;
      const after = e.afterData as Record<string, unknown> | null;
      if (before && !AuditLogEntity.isSanitized(before)) {
        throw new BadRequestException('Dữ liệu audit chứa bí mật không hợp lệ');
      }
      if (after && !AuditLogEntity.isSanitized(after)) {
        throw new BadRequestException('Dữ liệu audit chứa bí mật không hợp lệ');
      }
    }

    return result;
  }
}
