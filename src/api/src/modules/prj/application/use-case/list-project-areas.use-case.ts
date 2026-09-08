import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PRJ_PROJECT_REPOSITORY,
  ProjectRepositoryPort,
  PRJ_PROJECT_AREA_REPOSITORY,
  ProjectAreaRepositoryPort,
  ProjectAreaRow,
} from '../../domain/repository/project-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
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
 * - Scope A4 TRƯỚC existence (review P1-1): ADMIN bypass, còn lại phải là
 *   ACTIVE member (mọi role — WO picker tương lai phục vụ cả worker);
 *   non-admin luôn 403 kể cả project không tồn tại, ADMIN giữ 404.
 * - Default kèm inactive (flag qua `isActive`); `?activeOnly=true` chỉ active.
 * - Thuần SELECT → pool read trực tiếp, không mở write transaction (mirror #30 fix F7).
 * - PRJ-SRS-006 (issue #37): scope qua `ProjectScopeService` (API chung);
 *   read ồn → bypass KHÔNG audit (decision §15 C, giữ behavior A4).
 */
@Injectable()
export class ListProjectAreasUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(PRJ_PROJECT_AREA_REPOSITORY) private readonly areaRepo: ProjectAreaRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: ListProjectAreasInput): Promise<ListProjectAreasOutput> {
    // PRJ-SRS-006 review P1-1: scope TRƯỚC existence (anti existence-oracle:
    // non-admin luôn 403 kể cả project không tồn tại; ADMIN được
    // `assertProjectMemberScope` check exists() trước → project missing vẫn 404).
    await assertProjectAreaScope(this.scope, {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
      auditBypass: false,
    });

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const areas = await this.areaRepo.listAreas({
      projectId: input.projectId,
      activeOnly: input.activeOnly,
    });
    return { areas };
  }
}
