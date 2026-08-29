import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PROJECT_MEMBERSHIP_REPOSITORY, ProjectMembershipRepositoryPort } from '../../domain/repository/project-membership-repository.port';
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { decideProjectAccess, isValidUuid, ADMIN_ROLE_CODE, isAdminRole } from '../../domain/service/project-scope.policy';

export interface AssertProjectAccessInput {
  userId: string;
  actorRoles: string[];
  projectId: string;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ProjectScopeService {
  constructor(
    @Inject(PROJECT_MEMBERSHIP_REPOSITORY) private readonly membership: ProjectMembershipRepositoryPort,
    @Inject(PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  /**
   * Enforce project-scoped access at service/query layer (not post-filter).
   * - Does NOT trust projectId from client without DB membership check
   * - ADMIN bypass is explicitly logged via audit
   * - Throws 400 for invalid UUID, 403 for out-of-scope (does not leak existence beyond 403/404 boundary)
   */
  async assertAccess(input: AssertProjectAccessInput): Promise<{ isAdminBypass: boolean }> {
    const { userId, actorRoles, projectId } = input;

    if (!projectId || !isValidUuid(projectId)) {
      throw new BadRequestException('Project ID không hợp lệ');
    }

    // Admin exception path: verify existence first so ADMIN gets proper 404 if project truly missing
    if (isAdminRole(actorRoles)) {
      const exists = await this.projectRepo.exists(projectId);
      if (!exists) {
        throw new NotFoundException('Không tìm thấy dự án');
      }
      // Admin bypass: audit and allow without membership check
      try {
        await this.audit.log({
          actorUserId: userId,
          action: 'PROJECT_SCOPE_ADMIN_BYPASS',
          entityType: 'PROJECT',
          entityId: projectId,
          afterData: {
            reason: 'ADMIN_EXCEPTION',
            actorRoles,
            correlationId: input.correlationId ?? null,
          },
          result: 'SUCCESS',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch (_e) { void _e; }
      return { isAdminBypass: true };
    }

    // Non-admin: check membership directly; isMember false covers both missing and not-member
    // This avoids leaking existence via 404 vs 403 distinction for non-admin callers
    const isMember = await this.membership.isMember(userId, projectId);
    const decision = decideProjectAccess({ actorRoles, isMember, projectId });

    if (!decision.allowed) {
      // Do not leak object existence beyond policy: for NOT_MEMBER we return Forbidden with generic message
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    }

    return { isAdminBypass: false };
  }

  /**
   * Filter list query at repository layer: only query projects user is member of (unless ADMIN)
   * Prevents list/detail/dashboard from leaking records outside scope
   */
  async resolveAccessibleProjectIds(params: {
    userId: string;
    actorRoles: string[];
  }): Promise<string[] | null> {
    // null means unrestricted (admin sees all) — caller should not filter
    if (params.actorRoles.includes(ADMIN_ROLE_CODE)) {
      return null;
    }
    return this.membership.findActiveProjectIdsByUserId(params.userId);
  }

  async isMember(userId: string, projectId: string): Promise<boolean> {
    if (!isValidUuid(projectId)) return false;
    return this.membership.isMember(userId, projectId);
  }
}
