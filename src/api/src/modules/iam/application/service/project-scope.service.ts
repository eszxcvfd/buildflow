import { Injectable, Inject, ForbiddenException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PROJECT_MEMBERSHIP_REPOSITORY, ProjectMembershipRepositoryPort } from '../../domain/repository/project-membership-repository.port';
import { PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { decideProjectAccess, isValidUuid, ADMIN_ROLE_CODE, isAdminRole, hasProjectManageRole } from '../../domain/service/project-scope.policy';

export interface AssertProjectAccessInput {
  userId: string;
  actorRoles: string[];
  projectId: string;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AssertProjectScopeInput extends AssertProjectAccessInput {
  /**
   * Ghi audit `PROJECT_SCOPE_ADMIN_BYPASS` khi ADMIN bypass (default true).
   * Read ồn (list-all, areas list) truyền false → chỉ debug log (xem ENDPOINTS §15 C).
   */
  auditBypass?: boolean;
}

export interface ProjectScopeResult {
  isAdminBypass: boolean;
}

const FORBIDDEN_MESSAGE = 'Không có quyền truy cập dự án này';

@Injectable()
export class ProjectScopeService {
  private readonly logger = new Logger(ProjectScopeService.name);

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
   *
   * PRJ-SRS-006 (issue #37): giữ nguyên signature/behavior — delegate sang
   * `assertProjectMemberScope` (any ACTIVE member). Audit bypass best-effort
   * nhưng KHÔNG nuốt âm thầm: fail → warn log, vẫn cho qua.
   */
  async assertAccess(input: AssertProjectAccessInput): Promise<ProjectScopeResult> {
    return this.assertProjectMemberScope(input);
  }

  /**
   * PRJ-SRS-006 (issue #37) — read scope chung cho iam + prj:
   * ADMIN bypass (audited, trừ khi `auditBypass: false`) HOẶC bất kỳ ACTIVE
   * member nào (mọi project_role — WORKER/QC/VIEWER được xem đồng đội, areas,
   * detail). Non-member → 403 + audit `PROJECT_SCOPE_DENIED` (best-effort).
   * Anti-leak: non-ADMIN luôn 403 bất kể project tồn tại hay không; ADMIN
   * check `exists()` trước nên project missing → 404.
   */
  async assertProjectMemberScope(input: AssertProjectScopeInput): Promise<ProjectScopeResult> {
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
      await this.logAdminBypass(input);
      return { isAdminBypass: true };
    }

    // Non-admin: check membership directly; null covers both missing and not-member
    // This avoids leaking existence via 404 vs 403 distinction for non-admin callers
    const role = await this.membership.findActiveProjectRole(userId, projectId);
    const decision = decideProjectAccess({ actorRoles, isMember: role !== null, projectId });

    if (!decision.allowed) {
      await this.logDenied({ ...input, scope: 'READ' });
      // Do not leak object existence beyond policy: for NOT_MEMBER we return Forbidden with generic message
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return { isAdminBypass: false };
  }

  /**
   * PRJ-SRS-006 (issue #37) — write scope chung cho prj mutations
   * (PATCH project/status, members CRUD):
   * ADMIN bypass (audited) HOẶC ACTIVE member với project_role
   * MANAGER/COORDINATOR. PM global nhưng không member → 403; WORKER global
   * nhưng là project MANAGER → cho qua (membership là source of truth).
   * Denied → 403 + audit `PROJECT_SCOPE_DENIED` (best-effort).
   */
  async assertProjectWriteScope(input: AssertProjectScopeInput): Promise<ProjectScopeResult> {
    const { userId, actorRoles, projectId } = input;

    if (!projectId || !isValidUuid(projectId)) {
      throw new BadRequestException('Project ID không hợp lệ');
    }

    if (isAdminRole(actorRoles)) {
      const exists = await this.projectRepo.exists(projectId);
      if (!exists) {
        throw new NotFoundException('Không tìm thấy dự án');
      }
      await this.logAdminBypass(input);
      return { isAdminBypass: true };
    }

    const role = await this.membership.findActiveProjectRole(userId, projectId);
    if (!hasProjectManageRole(role)) {
      await this.logDenied({ ...input, scope: 'WRITE' });
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }

    return { isAdminBypass: false };
  }

  /**
   * PRJ-SRS-006 (issue #37) — re-check trong CÙNG transaction với mutation
   * (gọi ngay sau `SELECT ... FOR UPDATE` trên project row, trước mutation).
   * Revoke commit sau outer check nhưng trước khi tx giữ lock → thấy ở đây →
   * 403 → tx rollback, không partial-write. Không audit (tránh noise; outer
   * check đã audit denied). ADMIN bypass (`isAdminBypass: true`) → skip.
   */
  assertWriteScopeTxCheck(isAdminBypass: boolean, memberRole: string | null): void {
    if (isAdminBypass) return;
    if (!hasProjectManageRole(memberRole)) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }
  }

  /**
   * Re-check read-scope trong tx (khi read-modify-write cần chắc member còn
   * hiệu lực tại thời điểm lock). Cùng semantics anti-leak như outer check.
   */
  assertMemberScopeTxCheck(isAdminBypass: boolean, memberRole: string | null): void {
    if (isAdminBypass) return;
    if (memberRole === null) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE);
    }
  }

  /**
   * Filter list query at repository layer: only query projects user is member of (unless ADMIN)
   * Prevents list/detail/dashboard from leaking records outside scope.
   *
   * PRJ-SRS-006 decision (C): list ADMIN bypass KHÔNG ghi audit row (noisy —
   * mỗi lần list một row) → chỉ debug log. Audit bypass chỉ cho
   * detail/write/members-read (1 row / 1 hành động có chủ đích).
   */
  async resolveAccessibleProjectIds(params: {
    userId: string;
    actorRoles: string[];
  }): Promise<string[] | null> {
    // null means unrestricted (admin sees all) — caller should not filter
    if (params.actorRoles.includes(ADMIN_ROLE_CODE)) {
      this.logger.debug(`project list ADMIN bypass (log-only, no audit row): user=${params.userId}`);
      return null;
    }
    return this.membership.findActiveProjectIdsByUserId(params.userId);
  }

  async isMember(userId: string, projectId: string): Promise<boolean> {
    if (!isValidUuid(projectId)) return false;
    return this.membership.isMember(userId, projectId);
  }

  /**
   * Best-effort nhưng không nuốt âm thầm: audit fail → warn log có
   * action/project/actor, vẫn cho qua (scope decision đã đúng; audit là
   * quan sát, không phải authorization — precedent non-tx best-effort 8.5).
   */
  private async logAdminBypass(input: AssertProjectScopeInput): Promise<void> {
    if (input.auditBypass === false) {
      this.logger.debug(`project scope ADMIN bypass (audit skipped by caller): project=${input.projectId} user=${input.userId}`);
      return;
    }
    try {
      await this.audit.log({
        actorUserId: input.userId,
        action: 'PROJECT_SCOPE_ADMIN_BYPASS',
        entityType: 'PROJECT',
        entityId: input.projectId,
        afterData: {
          reason: 'ADMIN_EXCEPTION',
          actorRoles: input.actorRoles,
          correlationId: input.correlationId ?? null,
        },
        result: 'SUCCESS',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch (e) {
      this.logger.warn(
        `scope audit PROJECT_SCOPE_ADMIN_BYPASS failed (allowed through): project=${input.projectId} user=${input.userId} err=${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async logDenied(input: AssertProjectScopeInput & { scope: 'READ' | 'WRITE' }): Promise<void> {
    try {
      await this.audit.log({
        actorUserId: input.userId,
        action: 'PROJECT_SCOPE_DENIED',
        entityType: 'PROJECT',
        entityId: input.projectId,
        afterData: {
          reason: 'NOT_MEMBER',
          scope: input.scope,
          actorRoles: input.actorRoles,
          correlationId: input.correlationId ?? null,
        },
        result: 'FAILED',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch (e) {
      this.logger.warn(
        `scope audit PROJECT_SCOPE_DENIED failed (denial stands): project=${input.projectId} user=${input.userId} err=${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
