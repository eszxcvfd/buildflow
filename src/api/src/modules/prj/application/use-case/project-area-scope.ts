import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';

export interface ProjectAreaScopeArgs {
  projectId: string;
  actorUserId: string;
  actorRoles?: string[];
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * PRJ-SRS-003 (issue #34, A4) — project scope cho area routes,
 * PRJ-SRS-006 (issue #37) — generalize qua `ProjectScopeService`
 * (API scope chung iam+prj) thay vì check trực tiếp trên repo.
 * Behavior giữ nguyên:
 * - ADMIN bypass (không check membership — precedent iam `get-project`).
 * - Mọi role còn lại (kể cả PROJECT_MANAGER) phải có ACTIVE membership
 *   trong project, ngược lại 403 (không leak qua 404 phân biệt).
 * - Reads (`listAreas`): bypass KHÔNG audit (tránh ồn — decision §15 C);
 *   writes (`create`/`update` area) truyền `auditBypass` default true.
 * Khác members M5 (roles-only, scope defer #37): areas enforce membership
 * ngay từ slice này vì WO picker (tương lai) đọc theo membership; members
 * sẽ align khi #37 landing. Không check project status (closed vẫn cho
 * phép — precedent M5, xem ENDPOINTS.md §13 A5).
 */
export async function assertProjectAreaScope(
  scope: Pick<ProjectScopeService, 'assertProjectMemberScope'>,
  args: ProjectAreaScopeArgs & { auditBypass?: boolean },
): Promise<{ isAdminBypass: boolean }> {
  return scope.assertProjectMemberScope({
    userId: args.actorUserId,
    actorRoles: args.actorRoles ?? [],
    projectId: args.projectId,
    correlationId: args.correlationId ?? null,
    ipAddress: args.ipAddress ?? null,
    userAgent: args.userAgent ?? null,
    auditBypass: args.auditBypass,
  });
}
