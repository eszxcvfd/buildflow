import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';

export interface ListProjectMembersInput {
  projectId: string;
  includeInactive?: boolean;
  /** Actor server-derived từ JWT (sub + roles). */
  actorUserId: string;
  actorRoles?: string[];
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ListProjectMembersOutput {
  members: ProjectMemberRow[];
}

/**
 * PRJ-SRS-005 (issue #36, M1) — tra cứu thành viên dự án.
 * - Default chỉ active (`is_active`); `?includeInactive=true` toàn bộ lịch sử.
 * - Cả hai sắp `joined_at` DESC; rows kèm `userName`/`userCode` join từ users.
 * - Thuần SELECT → pool read trực tiếp, không mở write transaction (mirror #30 fix F7).
 * - PRJ-SRS-006 (issue #37): bất kỳ ACTIVE member nào (mọi project_role —
 *   WORKER/QC/VIEWER được xem danh sách đồng đội) + ADMIN bypass (audited
 *   `PROJECT_SCOPE_ADMIN_BYPASS`). Guard TRƯỚC 404 (anti-leak: non-member
 *   luôn 403 bất kể project tồn tại hay không).
 */
@Injectable()
export class ListProjectMembersUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: ListProjectMembersInput): Promise<ListProjectMembersOutput> {
    await this.scope.assertProjectMemberScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId: input.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const members = await this.projectRepo.listMembers({
      projectId: input.projectId,
      includeInactive: input.includeInactive,
    });
    return { members };
  }
}
