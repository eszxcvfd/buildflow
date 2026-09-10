import { ForbiddenException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderListRef, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';

export interface SearchJobBoardInput {
  limit?: number;
  offset?: number;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope, chỉ debug-log — không audit row). */
  actorRoles?: string[];
  /**
   * JOB-SRS-006 (issue #46) — 5 chiều filter (đã validate ở controller/policy):
   * `projectId` đơn, `areaIds`/`workTypeIds` lặp, `plannedFrom`/`plannedTo`
   * overlap instant, `skillMine` → resolve tradeIds server-side.
   */
  projectId?: string;
  areaIds?: string[];
  workTypeIds?: string[];
  plannedFrom?: Date;
  plannedTo?: Date;
  skillMine?: boolean;
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
 * List Job Board (`GET /api/v1/job-board`, JOB-SRS-005 issue #45, read scope)
 * + JOB-SRS-006 (issue #46, filter).
 * - ADMIN: tất cả WO available (scope service trả `null` = unrestricted, chỉ
 *   debug-log bypass — không audit row ồn như list-all precedent ENDPOINTS §15 C).
 * - Non-ADMIN: chỉ WO available của các project mình là ACTIVE member
 *   (`resolveAccessibleProjectIds` → `project_id = ANY(...)` trong SQL, không
 *   post-filter memory); membership rỗng + KHÔNG gửi `projectId` → `{ [], 0 }`
 *   (không 403 — BD2); đã gửi `projectId` ∉ scope là hành vi chủ động →
 *   `403` generic (BD12 — discharge ghi chú BD2).
 * - `skill=mine` → resolve tradeIds của actor từ `resource_trades`
 *   (BD11); không trade active → `{ [], 0 }` (không lỗi); ADMIN + `skill=mine`
 *   mà admin không hồ sơ trade → empty (conservative, BD11).
 * - Availability + filter predicate nằm TRONG SQL (`searchJobBoard`, BD5/
 *   BD10), không post-filter (giữ `total` và page đúng).
 * - Read-only: không tx, không audit nghiệp vụ (parity §17 — BD8/BD18).
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

    const isAdmin = (input.actorRoles ?? []).includes('ADMIN');

    // BD12 — `projectId` ngoài scope là hành vi chủ động → 403 generic
    // (parity §17; khác BD2: BD2 là khi KHÔNG gửi filter). ADMIN unrestricted
    // (project không tồn tại → empty, không 404).
    if (input.projectId && !isAdmin && accessibleIds !== null && !accessibleIds.includes(input.projectId)) {
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    }

    if (accessibleIds !== null && accessibleIds.length === 0 && !input.projectId) {
      return empty(now);
    }
    // Membership rỗng + gửi `projectId`: rơi vào nhánh 403 ở trên (mọi
    // projectId đều ∉ scope rỗng) — không tới được đây.

    // F002 — fail-closed: port method thiếu là lỗi wiring máy chủ → 500
    // (mirror guard `hasAssignment` open-work-order-job-board.use-case.ts),
    // KHÔNG fail-open `[]` (giấu việc làm vỡ wiring).
    const searchJobBoard = this.workOrderRepo.searchJobBoard;
    if (typeof searchJobBoard !== 'function') {
      throw new InternalServerErrorException('Không thể tải bảng việc');
    }

    // BD11 — `skill=mine`: resolve tradeIds server-side (client không được
    // gửi `tradeId` tự do). Không trade active → early-return `200 empty`.
    // Method absent → fail-closed 500 (mirror F002, m9).
    let requiredTradeIds: string[] | undefined;
    if (input.skillMine) {
      const findTrades = this.workOrderRepo.findActiveTradeIdsByUserId;
      if (typeof findTrades !== 'function') {
        throw new InternalServerErrorException('Không thể tải bảng việc');
      }
      requiredTradeIds = await findTrades.call(this.workOrderRepo, input.actorUserId);
      if (requiredTradeIds.length === 0) {
        return empty(now);
      }
    }

    const { entities, total } = await searchJobBoard.call(this.workOrderRepo, {
      projectIds: accessibleIds ?? undefined,
      projectId: input.projectId,
      areaIds: input.areaIds,
      workTypeIds: input.workTypeIds,
      plannedFrom: input.plannedFrom,
      plannedTo: input.plannedTo,
      requiredTradeIds,
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
