import { ConflictException, ForbiddenException, Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ChecklistTemplateRow, JOB_WORK_ORDER_REPOSITORY, WorkOrderListRef, WorkOrderRepositoryPort, WorkTypeDetailRef } from '../../domain/repository/work-order-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';
import { ChecklistTemplateCandidate, isJobBoardConfigError, selectChecklistsForWorkType } from '../../domain/service/job-board-detail.policy';

export interface GetJobBoardDetailInput {
  workOrderId: string;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface JobBoardDetailChecklistItem {
  sequenceNo: number;
  title: string;
  description: string | null;
  answerType: string;
  isRequired: boolean;
  isBlocking: boolean;
  requiresPhoto: boolean;
  minValue: number | null;
  maxValue: number | null;
}

export interface JobBoardDetailChecklist {
  id: string;
  code: string;
  name: string;
  purpose: string;
  version: number;
  description: string | null;
  items: JobBoardDetailChecklistItem[];
}

export interface GetJobBoardDetailOutput {
  entity: WorkOrderEntity;
  /** Chi tiết loại công việc ("dữ liệu cần chuẩn bị", F6). */
  workTypeDetail: WorkTypeDetailRef;
  projectRef: WorkOrderListRef | null;
  areaRef: WorkOrderListRef | null;
  tradeRef: WorkOrderListRef | null;
  /** Checklist đã resolve theo BD-3 (version cao nhất mỗi code) + items batch. */
  checklists: JobBoardDetailChecklist[];
  /** True khi WO có assignment PENDING/ACTIVE (derive `jobBoard.state`). */
  hasActiveAssignment: boolean;
  /** Clock server capture MỘT lần (derive state bằng đúng instant này). */
  now: Date;
}

function configInvalid409(workTypeId: string): ConflictException {
  const message = `Loại công việc (${workTypeId}) của công việc này cấu hình chưa đúng, vui lòng liên hệ điều phối để kiểm tra lại`;
  return new ConflictException({ statusCode: 409, message, code: 'JOB_BOARD_CONFIG_INVALID' });
}

/**
 * JOB-SRS-007 (issue #47) — chi tiết công việc còn trống trên Job Board
 * (`GET /api/v1/job-board/:id`, read scope).
 * - Authz giữ rule #41 (F1): non-ADMIN `findById` (null → 403 generic) →
 *   `assertProjectMemberScope` → MỚI fetch related (issue: "Authorization
 *   trước fetch toàn bộ related data"). ADMIN bypass qua scope service
 *   (missing → 404). Mọi ACTIVE member kể cả WORKER đọc được — không RBAC mới.
 * - `now` capture MỘT lần cho `deriveJobBoardState` (parity list BD5).
 * - Config error (§3.5): work type không resolve → 409
 *   `JOB_BOARD_CONFIG_INVALID`, withheld toàn bộ detail (AC-6). Checklist
 *   rỗng là empty state hợp lệ, không phải lỗi.
 * - Read-only: không tx, không audit nghiệp vụ (parity §17 — BD8).
 */
@Injectable()
export class GetJobBoardDetailUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: GetJobBoardDetailInput): Promise<GetJobBoardDetailOutput> {
    const actorRoles = input.actorRoles ?? [];
    const admin = isAdminRole(actorRoles);

    if (!admin) {
      const entity = await this.workOrderRepo.findById(input.workOrderId);
      if (!entity) {
        throw new ForbiddenException('Không có quyền truy cập dự án này');
      }
      await this.scope.assertProjectMemberScope({
        userId: input.actorUserId,
        actorRoles,
        projectId: entity.projectId,
        correlationId: input.correlationId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      return this.enrich(entity);
    }

    const entity = await this.workOrderRepo.findById(input.workOrderId);
    if (!entity) throw new NotFoundException('Không tìm thấy công việc');
    await this.scope.assertProjectMemberScope({
      userId: input.actorUserId,
      actorRoles,
      projectId: entity.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    return this.enrich(entity);
  }

  private async enrich(entity: WorkOrderEntity): Promise<GetJobBoardDetailOutput> {
    // Fail-closed wiring (mirror F001 `get-work-order.use-case.ts:77-83`):
    // port method thiếu là lỗi cấu hình máy chủ → 500, không fail-open.
    const findWorkTypeDetail = this.workOrderRepo.findWorkTypeDetailById;
    const findTemplates = this.workOrderRepo.findActiveChecklistTemplatesByWorkTypeId;
    const findItems = this.workOrderRepo.findChecklistItemsByTemplateIds;
    const hasAssignment = this.workOrderRepo.hasActiveAssignmentByWorkOrderIds;
    if (
      typeof findWorkTypeDetail !== 'function' ||
      typeof findTemplates !== 'function' ||
      typeof findItems !== 'function' ||
      typeof hasAssignment !== 'function'
    ) {
      throw new InternalServerErrorException('Không thể tải chi tiết công việc');
    }

    // `now` capture MỘT lần — dùng chung cho derive state.
    const now = new Date();

    const [workTypeDetail, templates, activeAssignmentIds, projectRefs, areaRefs, tradeRefs] = await Promise.all([
      findWorkTypeDetail.call(this.workOrderRepo, entity.workTypeId),
      findTemplates.call(this.workOrderRepo, entity.workTypeId),
      hasAssignment.call(this.workOrderRepo, [entity.id]),
      this.workOrderRepo.findProjectRefs([entity.projectId]),
      entity.areaId && this.workOrderRepo.findAreaRefs
        ? this.workOrderRepo.findAreaRefs([entity.areaId])
        : Promise.resolve(new Map<string, WorkOrderListRef>()),
      entity.requiredTradeId && this.workOrderRepo.findTradeRefs
        ? this.workOrderRepo.findTradeRefs([entity.requiredTradeId])
        : Promise.resolve(new Map<string, WorkOrderListRef>()),
    ]);

    if (isJobBoardConfigError(workTypeDetail)) {
      throw configInvalid409(entity.workTypeId);
    }
    const detail = workTypeDetail as WorkTypeDetailRef;

    const candidates: ChecklistTemplateCandidate[] = (templates as ChecklistTemplateRow[]).map((t) => ({
      id: t.id,
      code: t.code,
      workTypeId: t.workTypeId,
      purpose: t.purpose as ChecklistTemplateCandidate['purpose'],
      version: t.version,
      status: t.status,
    }));
    const selected = selectChecklistsForWorkType(candidates, entity.workTypeId);
    const selectedById = new Map(
      (templates as ChecklistTemplateRow[]).filter((t) => selected.some((s) => s.id === t.id)).map((t) => [t.id, t]),
    );
    const itemRows =
      selected.length === 0
        ? []
        : await findItems.call(this.workOrderRepo, selected.map((s) => s.id));
    const itemsByTemplate = new Map<string, JobBoardDetailChecklistItem[]>();
    for (const row of itemRows) {
      const list = itemsByTemplate.get(row.templateId) ?? [];
      list.push({
        sequenceNo: row.sequenceNo,
        title: row.title,
        description: row.description,
        answerType: row.answerType,
        isRequired: row.isRequired,
        isBlocking: row.isBlocking,
        requiresPhoto: row.requiresPhoto,
        minValue: row.minValue,
        maxValue: row.maxValue,
      });
      itemsByTemplate.set(row.templateId, list);
    }
    const checklists: JobBoardDetailChecklist[] = selected.map((s) => {
      const t = selectedById.get(s.id);
      return {
        id: s.id,
        code: s.code,
        name: t?.name ?? s.code,
        purpose: s.purpose,
        version: s.version,
        description: t?.description ?? null,
        items: itemsByTemplate.get(s.id) ?? [],
      };
    });

    return {
      entity,
      workTypeDetail: detail,
      projectRef: projectRefs.get(entity.projectId) ?? null,
      areaRef: entity.areaId ? (areaRefs.get(entity.areaId) ?? null) : null,
      tradeRef: entity.requiredTradeId ? (tradeRefs.get(entity.requiredTradeId) ?? null) : null,
      checklists,
      hasActiveAssignment: activeAssignmentIds.has(entity.id),
      now,
    };
  }
}
