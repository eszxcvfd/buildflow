import { ForbiddenException } from '@nestjs/common';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';
import { ProjectAreaRepositoryPort } from '../../domain/repository/project-repository.port';

/**
 * PRJ-SRS-003 (issue #34, A4) — project scope cho area routes.
 * - ADMIN bypass (không check membership — precedent iam `get-project`).
 * - Mọi role còn lại (kể cả PROJECT_MANAGER) phải có ACTIVE membership
 *   trong project, ngược lại 403 (không leak qua 404 phân biệt).
 * Khác members M5 (roles-only, scope defer #37): areas enforce membership
 * ngay từ slice này vì WO picker (tương lai) đọc theo membership; members
 * sẽ align khi #37 landing. Không check project status (closed vẫn cho
 * phép — precedent M5, xem ENDPOINTS.md §13 A5).
 */
export async function assertProjectAreaScope(
  repo: Pick<ProjectAreaRepositoryPort, 'isActiveProjectMember'>,
  args: { projectId: string; actorUserId: string; actorRoles?: string[] },
): Promise<void> {
  if (isAdminRole(args.actorRoles ?? [])) return;
  const ok = await repo.isActiveProjectMember(args.projectId, args.actorUserId);
  if (!ok) throw new ForbiddenException('Không có quyền truy cập dự án này');
}
