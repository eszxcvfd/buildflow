import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';
import {
  WorkOrderPriority,
  assertPlannedRange,
  generateWorkOrderCode,
  normalizePlannedHeadcount,
  normalizeRequestKey,
  normalizeWorkOrderCode,
  normalizeWorkOrderPriority,
  normalizeWorkOrderText,
  normalizeWorkOrderTitle,
  parsePlannedDateTime,
} from '../../domain/service/work-order.policy';

export interface CreateWorkOrderInput {
  projectId: string;
  areaId?: string | null;
  workTypeId: string;
  requiredTradeId?: string | null;
  code?: string | null;
  title: string;
  description?: string | null;
  instructions?: string | null;
  priority?: WorkOrderPriority | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedHeadcount?: number | null;
  requestKey?: string | null;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope — xem J1). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateWorkOrderOutput {
  entity: WorkOrderEntity;
  /** Tên loại công việc cho response summary (`workTypeName?`). */
  workTypeName: string | null;
  /**
   * True khi `requestKey` đã tồn tại: trả về Work Order HIỆN CÓ, không insert
   * mới, không audit mới (mirror `alreadyInState` semantics).
   */
  idempotentReplay: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function duplicateCode409(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: 'Mã công việc đã tồn tại',
    code: 'WORK_ORDER_CODE_DUPLICATE',
  });
}

/**
 * JOB-SRS-001 (issue #41) — tạo Work Order nháp.
 * - J1 scope-first (lesson P1-1 #37): `assertProjectWriteScope` TRƯỚC mọi
 *   existence check (work-type/area/trade/code/requestKey) — non-ADMIN luôn
 *   403 kể cả project không tồn tại (không leak 404); ADMIN giữ 404 qua
 *   scope exists-check. Normalize thuần (không I/O) chạy trước scope.
 * - J2 draft minimal validation: `title` 1-200 bắt buộc; `workTypeId` phải
 *   tồn tại VÀ ACTIVE; `areaId` optional — khi gửi phải cùng project VÀ
 *   ACTIVE; `requiredTradeId` optional — khi gửi phải là trade ACTIVE;
 *   thiếu schedule/area/trade vẫn DRAFT (không chặn).
 * - J3 idempotent `requestKey`: trùng → 200 row hiện có, không audit mới.
 * - J4 code: client-supplied theo pattern → 409 CI pre-check + race guard
 *   `ux_work_orders_code` trong tx (constraint-cụ-thể-trước; bare 23505
 *   rethrow — precedent work-types W2); absent → server sinh `WO-`+base36+rand.
 * - J5 audit `JOB_WORK_ORDER_CREATED` (`entityType` `WORK_ORDER`,
 *   tx-embedded, afterData public fields — không secret); audit fail → 500
 *   rollback. Không gán người thực hiện / không mở job board (defer #42/#44).
 */
@Injectable()
export class CreateWorkOrderUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: CreateWorkOrderInput): Promise<CreateWorkOrderOutput> {
    let title: string;
    try {
      title = normalizeWorkOrderTitle(input.title);
    } catch (e) {
      throw fieldError('title', e instanceof Error ? e.message : 'Tiêu đề không hợp lệ');
    }
    let code: string | null;
    try {
      code = normalizeWorkOrderCode(input.code);
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Mã công việc không hợp lệ');
    }
    let priority: WorkOrderPriority;
    try {
      priority = normalizeWorkOrderPriority(input.priority);
    } catch (e) {
      throw fieldError('priority', e instanceof Error ? e.message : 'Ưu tiên không hợp lệ');
    }
    let description: string | null;
    try {
      description = normalizeWorkOrderText(input.description, 'Mô tả công việc');
    } catch (e) {
      throw fieldError('description', e instanceof Error ? e.message : 'Mô tả không hợp lệ');
    }
    let instructions: string | null;
    try {
      instructions = normalizeWorkOrderText(input.instructions, 'Hướng dẫn thực hiện');
    } catch (e) {
      throw fieldError('instructions', e instanceof Error ? e.message : 'Hướng dẫn không hợp lệ');
    }
    let plannedHeadcount: number | null;
    try {
      plannedHeadcount = normalizePlannedHeadcount(input.plannedHeadcount);
    } catch (e) {
      throw fieldError('plannedHeadcount', e instanceof Error ? e.message : 'Số lượng dự kiến không hợp lệ');
    }
    let plannedStartAt: Date | null;
    try {
      plannedStartAt = parsePlannedDateTime(input.plannedStartAt);
    } catch (e) {
      throw fieldError('plannedStartAt', e instanceof Error ? e.message : 'Thời điểm bắt đầu không hợp lệ');
    }
    let plannedEndAt: Date | null;
    try {
      plannedEndAt = parsePlannedDateTime(input.plannedEndAt);
    } catch (e) {
      throw fieldError('plannedEndAt', e instanceof Error ? e.message : 'Thời điểm kết thúc không hợp lệ');
    }
    try {
      assertPlannedRange(plannedStartAt, plannedEndAt);
    } catch (e) {
      throw fieldError('plannedEndAt', e instanceof Error ? e.message : 'Khoảng thời gian không hợp lệ');
    }
    let requestKey: string | null;
    try {
      requestKey = normalizeRequestKey(input.requestKey);
    } catch (e) {
      throw fieldError('requestKey', e instanceof Error ? e.message : 'Request key không hợp lệ');
    }

    // J1 — scope TRƯỚC mọi existence check (anti existence-oracle).
    await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId: input.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const workType = await this.workOrderRepo.findActiveWorkTypeById(input.workTypeId);
    if (!workType || !workType.isActive) {
      throw fieldError('workTypeId', 'Loại công việc không tồn tại hoặc đã ngừng hoạt động');
    }

    if (input.areaId !== undefined && input.areaId !== null && String(input.areaId).trim() !== '') {
      const area = await this.workOrderRepo.findActiveAreaById(String(input.areaId));
      if (!area || area.projectId !== input.projectId || !area.isActive) {
        throw fieldError('areaId', 'Khu vực không tồn tại, đã ngừng hoạt động hoặc không thuộc dự án này');
      }
    }
    const areaId =
      input.areaId === undefined || input.areaId === null || String(input.areaId).trim() === ''
        ? null
        : String(input.areaId);

    let requiredTradeId: string | null = null;
    if (input.requiredTradeId !== undefined && input.requiredTradeId !== null && String(input.requiredTradeId).trim() !== '') {
      requiredTradeId = String(input.requiredTradeId).trim();
      const trade = await this.workOrderRepo.findActiveTradeById(requiredTradeId);
      if (!trade || !trade.isActive) {
        throw fieldError('requiredTradeId', 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động');
      }
    }

    // J3 — replay trước mọi write: row hiện có + không audit mới.
    if (requestKey !== null) {
      const existing = await this.workOrderRepo.findByRequestKey(requestKey);
      if (existing) {
        const workTypeName = await this.workOrderRepo.findWorkTypeNameById(existing.workTypeId);
        return { entity: existing, workTypeName, idempotentReplay: true };
      }
    }

    // J4 — code: client-supplied pre-check CI; absent → server sinh (retry
    // sinh lại khi chạm pre-check, tối đa 5 lần).
    if (code !== null) {
      const byCode = await this.workOrderRepo.findByCode(code);
      if (byCode) throw duplicateCode409();
    } else {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = generateWorkOrderCode();
        // eslint-disable-next-line no-await-in-loop
        const byCode = await this.workOrderRepo.findByCode(candidate);
        if (!byCode) {
          code = candidate;
          break;
        }
      }
      if (code === null) {
        throw new InternalServerErrorException('Không thể tạo mã công việc, vui lòng thử lại');
      }
    }

    const now = new Date();
    const id = randomUUID();
    let entity: WorkOrderEntity;
    try {
      entity = new WorkOrderEntity({
        id,
        code,
        projectId: input.projectId,
        areaId,
        workTypeId: input.workTypeId,
        requiredTradeId,
        title,
        description,
        instructions,
        priority,
        status: 'DRAFT',
        plannedStartAt,
        plannedEndAt,
        plannedHeadcount,
        createdBy: input.actorUserId,
        version: 1,
        requestKey,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      throw fieldError('title', e instanceof Error ? e.message : 'Dữ liệu không hợp lệ');
    }

    await this.tx.withTransaction(async (client: PoolClient) => {      try {
        if (this.workOrderRepo.createWithClient) {
          await this.workOrderRepo.createWithClient(client, entity);
        } else {
          await this.workOrderRepo.create(entity);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        // Constraint-order: tên cụ thể trước; bare 23505 KHÔNG swallow → rethrow (500).
        if (/ux_work_orders_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'JOB_WORK_ORDER_CREATED',
          entityType: 'WORK_ORDER',
          entityId: id,
          beforeData: null,
          afterData: entity.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    const workTypeName = await this.workOrderRepo.findWorkTypeNameById(input.workTypeId);
    return { entity, workTypeName, idempotentReplay: false };
  }
}
