import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderListRef, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';

export interface SearchJobBoardInput {
  limit?: number;
  offset?: number;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope, chỉ debug-log — không audit row). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface SearchJobBoardOutput {
  entities: WorkOrderEntity[];
  total: number;
  /**
   * Clock server capture MỘT lần trong use case (BD5) — caller (controller/
   * mapper) derive `jobBoard.state` bằng ĐÚNG instant này, không `new Date()`
   * riêng (triệt tiêu lệch clock giữa SQL window và badge).
   */
  now: Date;
  /**
   * Assignment hiện tại trên page (batch MỘT query — mirror
   * `findWorkTypeRefs`): item bị claim giữa page-SQL và enrichment được serve
   * với `state: 'ASSIGNED'` (BD5 "báo rõ" thay vì giấu).
   */
  activeAssignmentIds: Set<string>;
  /**
   * Enrichment cho Job Board card (batch 1 query mỗi loại, tránh N+1 —
   * mirror `SearchWorkOrdersUseCase`): loại công việc + dự án + khu vực +
   * ngành yêu cầu. Id không có trong map → mapper fallback id rút gọn/null.
   */
  workTypeRefs: Map<string, WorkOrderListRef>;
  projectRefs: Map<string, WorkOrderListRef>;
  areaRefs: Map<string, WorkOrderListRef>;
  tradeRefs: Map<string, WorkOrderListRef>;
}

/**
 * List Job Board (`GET /api/v1/job-board`, JOB-SRS-005 issue #45, read scope).
 * - ADMIN: tất cả WO available (scope service trả `null` = unrestricted, chỉ
 *   debug-log bypass — không audit row ồn như list-all precedent ENDPOINTS §15 C).
 * - Non-ADMIN: chỉ WO available của các project mình là ACTIVE member
 *   (`resolveAccessibleProjectIds` → `project_id = ANY(...)` trong SQL, không
 *   post-filter memory); membership rỗng → `{ [], 0 }` (không 403 — BD2).
 * - Endpoint KHÔNG nhận filter param scope (`projectId`/`status`/`search`
 *   cấm — là của #46; "sửa URL không bypass" giữ bằng construction — BD2).
 * - Availability predicate nằm TRONG SQL (`searchJobBoard`, BD5), không
 *   post-filter (giữ `total` và page đúng).
 * - Read-only: không tx, không audit nghiệp vụ (parity §17 — BD8).
 */
@Injectable()
export class SearchJobBoardUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: SearchJobBoardInput): Promise<SearchJobBoardOutput> {
    const accessibleIds = await this.scope.resolveAccessibleProjectIds({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
    });

    const empty = (now: Date): SearchJobBoardOutput => ({
      entities: [],
      total: 0,
      now,
      activeAssignmentIds: new Set<string>(),
      workTypeRefs: new Map(),
      projectRefs: new Map(),
      areaRefs: new Map(),
      tradeRefs: new Map(),
    });

    // `now` capture MỘT lần (BD5) — dùng chung cho SQL lẫn derive state.
    const now = new Date();

    if (accessibleIds !== null && accessibleIds.length === 0) {
      return empty(now);
    }

    // F002 — fail-closed: port method thiếu là lỗi wiring máy chủ → 500
    // (mirror guard `hasAssignment` open-work-order-job-board.use-case.ts),
    // KHÔNG fail-open `[]` (giấu việc làm vỡ wiring).
    const searchJobBoard = this.workOrderRepo.searchJobBoard;
    if (typeof searchJobBoard !== 'function') {
      throw new InternalServerErrorException('Không thể tải bảng việc');
    }
    const { entities, total } = await searchJobBoard.call(this.workOrderRepo, {
      projectIds: accessibleIds ?? undefined,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
      now,
    });

    const pageIds = entities.map((e) => e.id);
    const workTypeIds = [...new Set(entities.map((e) => e.workTypeId))];
    const projectIds = [...new Set(entities.map((e) => e.projectId))];
    const areaIds = [...new Set(entities.map((e) => e.areaId).filter((id): id is string => id !== null))];
    const tradeIds = [
      ...new Set(entities.map((e) => e.requiredTradeId).filter((id): id is string => id !== null)),
    ];
    const [activeAssignmentIds, workTypeRefs, projectRefs, areaRefs, tradeRefs] = await Promise.all([
      this.workOrderRepo.hasActiveAssignmentByWorkOrderIds
        ? this.workOrderRepo.hasActiveAssignmentByWorkOrderIds(pageIds)
        : Promise.resolve(new Set<string>()),
      this.workOrderRepo.findWorkTypeRefs(workTypeIds),
      this.workOrderRepo.findProjectRefs(projectIds),
      this.workOrderRepo.findAreaRefs
        ? this.workOrderRepo.findAreaRefs(areaIds)
        : Promise.resolve(new Map<string, WorkOrderListRef>()),
      this.workOrderRepo.findTradeRefs
        ? this.workOrderRepo.findTradeRefs(tradeIds)
        : Promise.resolve(new Map<string, WorkOrderListRef>()),
    ]);
    return { entities, total, now, activeAssignmentIds, workTypeRefs, projectRefs, areaRefs, tradeRefs };
  }
}
