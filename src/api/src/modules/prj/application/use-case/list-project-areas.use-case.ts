import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PRJ_PROJECT_REPOSITORY,
  ProjectRepositoryPort,
  PRJ_PROJECT_AREA_REPOSITORY,
  ProjectAreaRepositoryPort,
  ProjectAreaRow,
} from '../../domain/repository/project-repository.port';
import { assertProjectAreaScope } from './project-area-scope';

export interface ListProjectAreasInput {
  projectId: string;
  /** true → chỉ active (future Work Order picker); thiếu/false → toàn bộ, kèm inactive. */
  activeOnly?: boolean;
  actorUserId: string;
  actorRoles?: string[];
}

export interface ListProjectAreasOutput {
  areas: ProjectAreaRow[];
}

/**
 * PRJ-SRS-003 (issue #34, A1/A4) — tra cứu khu vực theo dự án.
 * - Project phải tồn tại (404). Scope A4: ADMIN bypass, còn lại phải là
 *   ACTIVE member (mọi role — WO picker tương lai phục vụ cả worker).
 * - Default kèm inactive (flag qua `isActive`); `?activeOnly=true` chỉ active.
 * - Thuần SELECT → pool read trực tiếp, không mở write transaction (mirror #30 fix F7).
 */
@Injectable()
export class ListProjectAreasUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(PRJ_PROJECT_AREA_REPOSITORY) private readonly areaRepo: ProjectAreaRepositoryPort,
  ) {}

  async execute(input: ListProjectAreasInput): Promise<ListProjectAreasOutput> {
    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    await assertProjectAreaScope(this.areaRepo, {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
    });

    const areas = await this.areaRepo.listAreas({
      projectId: input.projectId,
      activeOnly: input.activeOnly,
    });
    return { areas };
  }
}
