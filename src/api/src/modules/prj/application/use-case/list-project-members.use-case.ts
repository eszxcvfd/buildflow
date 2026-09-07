import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';

export interface ListProjectMembersInput {
  projectId: string;
  includeInactive?: boolean;
}

export interface ListProjectMembersOutput {
  members: ProjectMemberRow[];
}

/**
 * PRJ-SRS-005 (issue #36, M1) — tra cứu thành viên dự án.
 * - Default chỉ active (`is_active`); `?includeInactive=true` toàn bộ lịch sử.
 * - Cả hai sắp `joined_at` DESC; rows kèm `userName`/`userCode` join từ users.
 * - Thuần SELECT → pool read trực tiếp, không mở write transaction (mirror #30 fix F7).
 */
@Injectable()
export class ListProjectMembersUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
  ) {}

  async execute(input: ListProjectMembersInput): Promise<ListProjectMembersOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const members = await this.projectRepo.listMembers({
      projectId: input.projectId,
      includeInactive: input.includeInactive,
    });
    return { members };
  }
}
