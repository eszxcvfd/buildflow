import { WorkOrderEntity } from '../../../../domain/entity/work-order.entity';
import { WorkOrderListRef } from '../../../../domain/repository/work-order-repository.port';
import { deriveJobBoardState, JobBoardState } from '../../../../domain/service/work-order-job-board.policy';
import { WorkOrderPriority } from '../../../../domain/service/work-order.policy';

/**
 * JOB-SRS-005 (issue #45) — item Job Board (`GET /api/v1/job-board`, BD6):
 * shape card tối thiểu, KHÔNG PII thừa — **`createdBy` bị loại chủ đích**
 * (issue: "Không hiển thị dữ liệu cá nhân không cần thiết"; mapper spec
 * assert vắng mặt). `areaName`/`requiredTradeName` resolve từ batch refs
 * (`findAreaRefs`/`findTradeRefs`); ref thiếu → `undefined`/id rút gọn do
 * web fallback (mirror `toWorkOrderListResponse`). Boolean
 * `hasActiveAssignment` KHÔNG trả trên item list (thừa — `state` đã encode).
 */
export interface JobBoardItemResponse {
  id: string;
  code: string;
  title: string;
  projectId: string;
  projectName?: string | null;
  areaId: string | null;
  areaName?: string | null;
  workTypeId: string;
  workTypeName?: string | null;
  requiredTradeId: string | null;
  requiredTradeName?: string | null;
  priority: WorkOrderPriority;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedHeadcount: number | null;
  version: number;
  jobBoard: {
    open: boolean;
    openFrom: string | null;
    openUntil: string | null;
    state: JobBoardState;
  };
}

export interface JobBoardListResponseOptions {
  workTypeRefs?: Map<string, WorkOrderListRef>;
  projectRefs?: Map<string, WorkOrderListRef>;
  areaRefs?: Map<string, WorkOrderListRef>;
  tradeRefs?: Map<string, WorkOrderListRef>;
  /** Assignment hiện tại trên page (batch từ use case — BD5 "báo rõ"). */
  activeAssignmentIds?: Set<string>;
  /**
   * Clock server capture MỘT lần trong use case (BD5) — derive `state` bằng
   * ĐÚNG instant này, không `new Date()` riêng.
   */
  now?: Date;
}

/**
 * Map MỘT entity sang item Job Board. `state` derive với `now` chung +
 * `hasActiveAssignment` từ batch set: item bị claim giữa page-SQL và
 * enrichment được serve với `state: 'ASSIGNED'`.
 */
export function toJobBoardItemResponse(
  entity: WorkOrderEntity,
  options?: JobBoardListResponseOptions,
): JobBoardItemResponse {
  const pub = entity.toPublic();
  const workTypeRef = pub.workTypeId ? options?.workTypeRefs?.get(pub.workTypeId) ?? null : null;
  const projectRef = pub.projectId ? options?.projectRefs?.get(pub.projectId) ?? null : null;
  const areaRef = pub.areaId ? options?.areaRefs?.get(pub.areaId) ?? null : null;
  const tradeRef = pub.requiredTradeId ? options?.tradeRefs?.get(pub.requiredTradeId) ?? null : null;
  const hasActiveAssignment = options?.activeAssignmentIds?.has(pub.id) ?? false;
  return {
    id: pub.id,
    code: pub.code,
    title: pub.title,
    projectId: pub.projectId,
    projectName: projectRef ? projectRef.name : undefined,
    areaId: pub.areaId,
    areaName: areaRef ? areaRef.name : undefined,
    workTypeId: pub.workTypeId,
    workTypeName: workTypeRef ? workTypeRef.name : undefined,
    requiredTradeId: pub.requiredTradeId,
    requiredTradeName: tradeRef ? tradeRef.name : undefined,
    priority: pub.priority,
    plannedStartAt: pub.plannedStartAt ? pub.plannedStartAt.toISOString() : null,
    plannedEndAt: pub.plannedEndAt ? pub.plannedEndAt.toISOString() : null,
    plannedHeadcount: pub.plannedHeadcount,
    version: pub.version,
    jobBoard: {
      open: pub.jobBoardOpen,
      openFrom: pub.jobBoardOpenFrom ? pub.jobBoardOpenFrom.toISOString() : null,
      openUntil: pub.jobBoardOpenUntil ? pub.jobBoardOpenUntil.toISOString() : null,
      state: deriveJobBoardState({
        status: pub.status,
        jobBoardOpen: pub.jobBoardOpen,
        jobBoardOpenFrom: pub.jobBoardOpenFrom,
        jobBoardOpenUntil: pub.jobBoardOpenUntil,
        hasActiveAssignment,
        now: options?.now,
      }),
    },
  };
}

/**
 * Map page entities sang items Job Board (thiếu ref → field `undefined`,
 * web fallback id rút gọn — mirror `toWorkOrderListResponse`).
 */
export function toJobBoardListResponse(
  entities: WorkOrderEntity[],
  options?: JobBoardListResponseOptions,
): JobBoardItemResponse[] {
  return entities.map((entity) => toJobBoardItemResponse(entity, options));
}
