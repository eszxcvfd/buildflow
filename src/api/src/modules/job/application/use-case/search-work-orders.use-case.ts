import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderFilter, WorkOrderListRef, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';

export type SearchWorkOrdersStatus = WorkOrderStatus | 'ALL';

export interface SearchWorkOrdersInput {
  projectId?: string;
  status?: SearchWorkOrdersStatus;
  search?: string;
  limit?: number;
  offset?: number;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope, chỉ debug-log — không audit row). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface SearchWorkOrdersOutput {
  entities: WorkOrderEntity[];
  total: number;
  /**
   * Enrichment cho list: refs hiển thị loại công việc + dự án (batch 1 query
   * mỗi loại, tránh N+1 — mirror prj `SearchWorkOrderTemplatesUseCase`).
   * Id không có trong map → mapper fallback id rút gọn.
   */
  workTypeRefs: Map<string, WorkOrderListRef>;
  projectRefs: Map<string, WorkOrderListRef>;
}

/**
 * List Work Order (`GET /api/v1/work-orders`, read scope).
 * - ADMIN: tất cả WO (scope service trả `null` = unrestricted, chỉ debug-log
 *   bypass — không audit row ồn như list-all precedent ENDPOINTS §15 C).
 * - Non-ADMIN: chỉ WO của các project mình là ACTIVE member
 *   (`resolveAccessibleProjectIds` → `project_id = ANY(...)` ở repo, không
 *   post-filter memory); membership rỗng → `{ [], 0 }` (không 403).
 * - `projectId` ngoài scope → 403 generic anti-leak (không phân biệt tồn tại).
 * - Read-only: không tx, không audit nghiệp vụ.
 */
@Injectable()
export class SearchWorkOrdersUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: SearchWorkOrdersInput): Promise<SearchWorkOrdersOutput> {
    const accessibleIds = await this.scope.resolveAccessibleProjectIds({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
    });

    if (accessibleIds !== null) {
      if (accessibleIds.length === 0) {
        return { entities: [], total: 0, workTypeRefs: new Map(), projectRefs: new Map() };
      }
      if (input.projectId && !accessibleIds.includes(input.projectId)) {
        throw new ForbiddenException('Không có quyền truy cập dự án này');
      }
    }

    const filter: WorkOrderFilter = {
      status: input.status ?? 'ALL',
      projectId: input.projectId?.trim() ? input.projectId.trim() : undefined,
      projectIds: accessibleIds ?? undefined,
      search: input.search?.trim() ? input.search.trim() : undefined,
      limit: input.limit,
      offset: input.offset,
    };
    const { entities, total } = await this.workOrderRepo.search(filter);
    const workTypeIds = [...new Set(entities.map((e) => e.workTypeId))];
    const projectIds = [...new Set(entities.map((e) => e.projectId))];
    const [workTypeRefs, projectRefs] = await Promise.all([
      this.workOrderRepo.findWorkTypeRefs(workTypeIds),
      this.workOrderRepo.findProjectRefs(projectIds),
    ]);
    return { entities, total, workTypeRefs, projectRefs };
  }
}
