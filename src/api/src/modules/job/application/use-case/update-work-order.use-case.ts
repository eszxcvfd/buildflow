import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import {
  UPDATABLE_WORK_ORDER_FIELDS,
  UpdatableWorkOrderField,
  WORKFLOW_IMPACTING_FIELDS,
  evaluateUpdateRequest,
} from '../../domain/service/work-order-update.policy';
import {
  WorkOrderPriority,
  WorkOrderCustomFields,
  assertPlannedRange,
  mergeCustomFields,
  normalizeCustomFieldsInput,
  normalizeWorkOrderPriority,
  normalizeWorkOrderText,
  parsePlannedDateTime,
  UUID_RE,
} from '../../domain/service/work-order.policy';

export interface UpdateWorkOrderInput {
  workOrderId: string;
  description?: string | null;
  instructions?: string | null;
  priority?: WorkOrderPriority | null;
  dueAt?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  requiredTradeId?: string | null;
  workTypeId?: string | null;
  /**
   * Partial object dữ liệu bổ sung — merge lên `customFields` hiện tại
   * (key absent = giữ nguyên; validate limits sau merge).
   */
  customFields?: unknown;
  expectedVersion?: number | null;
  reason?: string | null;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope + nhánh ngoại lệ). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateWorkOrderOutput {
  entity: WorkOrderEntity;
  workTypeName: string | null;
  /** True khi đi nhánh ngoại lệ (terminal + ADMIN + reason). */
  exceptionEdit: boolean;
  /** True khi không có thay đổi thực tế (không tx, không audit). */
  noOp: boolean;
}

function fieldError(field: string, message: string, code = 'WORK_ORDER_FIELD_LOCKED'): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, code, fieldErrors: { [field]: [message] } });
}

function fieldErrors400(errors: Record<string, string[]>): BadRequestException {
  const first = Object.values(errors)[0]?.[0] ?? 'Dữ liệu cập nhật không hợp lệ';
  const onlyReason = Object.keys(errors).length === 1 && errors['reason'] !== undefined;
  return new BadRequestException({
    statusCode: 400,
    message: first,
    code: onlyReason ? 'WORK_ORDER_REASON_REQUIRED' : 'WORK_ORDER_FIELD_LOCKED',
    fieldErrors: errors,
  });
}

function versionConflict409(currentVersion: number): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: `Công việc đã bị thay đổi bởi người dùng khác (hiện tại version ${currentVersion}); vui lòng tải lại và thử lại`,
    code: 'WORK_ORDER_CONFLICT',
  });
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * JOB-SRS-003 (issue #43) — cập nhật Work Order theo state policy.
 * - Scope write như POST nhưng resolve `projectId` từ WO (anti-leak mirror
 *   GET: non-ADMIN luôn 403 kể cả id không tồn tại; ADMIN giữ 404).
 * - Optimistic lock: `expectedVersion` pre-check fail-fast + SQL guard
 *   `AND version` trong tx (mirror templates) → 409 `WORK_ORDER_CONFLICT`.
 * - Field khóa theo trạng thái → 400 `WORK_ORDER_FIELD_LOCKED` per-field;
 *   đổi lịch/skill ở ASSIGNED/IN_PROGRESS bắt buộc `reason`; terminal
 *   (WORK_DONE/CLOSED/CANCELLED) chỉ ADMIN + reason ≥10 ký tự (ngoại lệ,
 *   audit `WORK_ORDER_EXCEPTION_EDIT`), ngược lại 400.
 * - Audit `JOB_WORK_ORDER_UPDATED` (before/after per-field changed, tx-embedded);
 *   đổi lịch/skill/work-type → 1 notification row cho creator trong cùng tx
 *   (dedup_key hash woId+fields+version); notification/audit fail → 500 rollback.
 * - Không đổi `status` qua endpoint này; không gán assignee (defer #47 —
 *   notify creator).
 * - J8 dữ liệu bổ sung + skill khớp khi đổi loại: `customFields` partial merge
 *   lên giá trị hiện tại (re-validate limits sau merge; object rỗng = no-op);
 *   đổi `workTypeId` mà không gửi `requiredTradeId` → auto-fill ngành loại mới
 *   yêu cầu; gửi trade khác ngành yêu cầu (kể cả gỡ `null` khi loại yêu cầu
 *   ngành cụ thể) → 400 `fieldErrors.requiredTradeId`.
 */
@Injectable()
export class UpdateWorkOrderUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: UpdateWorkOrderInput): Promise<UpdateWorkOrderOutput> {
    const isAdmin = isAdminRole(input.actorRoles ?? []);

    // 1. Normalize thuần (không I/O) — chỉ các key được gửi (undefined = không đụng).
    const requested = this.normalize(input);

    // 2. Load + scope (anti-leak: non-ADMIN 403 kể cả missing).
    const current = await this.workOrderRepo.findById(input.workOrderId);
    if (!current) {
      if (!isAdmin) throw new ForbiddenException('Không có quyền truy cập dự án này');
      throw new NotFoundException('Không tìm thấy công việc');
    }
    await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId: current.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const fields = Object.keys(requested.values) as UpdatableWorkOrderField[];
    if (requested.customFieldsPatch !== undefined) fields.push('customFields');
    if (fields.length === 0) {
      const workTypeName = await this.workOrderRepo.findWorkTypeNameById(current.workTypeId);
      return { entity: current, workTypeName, exceptionEdit: false, noOp: true };
    }

    // 3. State policy (khóa/reason/ngoại lệ).
    const evaluation = evaluateUpdateRequest(current.status, fields, {
      isAdmin,
      reason: requested.reason,
    });
    if (Object.keys(evaluation.fieldErrors).length > 0) {
      throw fieldErrors400(evaluation.fieldErrors);
    }

    // 4. Refs validate như create + J8 trade re-validate/auto-fill khi đổi
    // workTypeId (cùng rule create, kèm reason rules hiện có của state policy).
    let workTypeId = current.workTypeId;
    const workTypeChanged = requested.values.workTypeId !== undefined;
    // Ngành mà work-type (mới / hiện tại) yêu cầu — chỉ load khi cần (đổi loại
    // hoặc gửi trade tường minh) để tránh query thừa ở PATCH thuần mô tả.
    let effectiveRequiredTradeId: string | null | undefined;
    if (workTypeChanged) {
      const ref = await this.workOrderRepo.findActiveWorkTypeById(requested.values.workTypeId as string);
      if (!ref || !ref.isActive) {
        throw fieldError('workTypeId', 'Loại công việc không tồn tại hoặc đã ngừng hoạt động');
      }
      workTypeId = requested.values.workTypeId as string;
      effectiveRequiredTradeId = ref.requiredTradeId ?? null;
    }
    const tradeSent = requested.values.requiredTradeId !== undefined;
    const sentTradeRaw = tradeSent ? (requested.values.requiredTradeId as string | null) : undefined;
    if (effectiveRequiredTradeId === undefined && tradeSent) {
      const ref = await this.workOrderRepo.findActiveWorkTypeById(current.workTypeId);
      effectiveRequiredTradeId = ref?.requiredTradeId ?? null;
    }
    const mismatchTradeError = async (requiredId: string): Promise<BadRequestException> => {
      const requiredTrade = await this.workOrderRepo.findActiveTradeById(requiredId);
      const label = requiredTrade?.code ?? requiredTrade?.name ?? 'khác';
      return fieldError('requiredTradeId', `Loại công việc yêu cầu ngành ${label}`);
    };
    let requiredTradeId = current.requiredTradeId;
    if (tradeSent) {
      if (sentTradeRaw !== null && sentTradeRaw !== undefined) {
        if (effectiveRequiredTradeId !== null && sentTradeRaw !== effectiveRequiredTradeId) {
          throw await mismatchTradeError(effectiveRequiredTradeId as string);
        }
        const ref = await this.workOrderRepo.findActiveTradeById(sentTradeRaw);
        if (!ref || !ref.isActive) {
          throw fieldError('requiredTradeId', 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động');
        }
        requiredTradeId = sentTradeRaw;
      } else {
        // Gỡ skill (`null`): chặn khi work-type yêu cầu ngành cụ thể.
        if (effectiveRequiredTradeId !== null && effectiveRequiredTradeId !== undefined) {
          throw await mismatchTradeError(effectiveRequiredTradeId);
        }
        requiredTradeId = null;
      }
    } else if (workTypeChanged && effectiveRequiredTradeId !== null && effectiveRequiredTradeId !== undefined) {
      // Đổi loại mà không gửi trade → auto-fill ngành loại mới yêu cầu (khi
      // đang khác); loại mới không yêu cầu → giữ trade hiện tại.
      if (current.requiredTradeId !== effectiveRequiredTradeId) {
        requiredTradeId = effectiveRequiredTradeId;
      }
    }

    // 5. Giá trị mới + diff thực tế (gửi trùng giá trị hiện tại = no-op).
    const nextDescription = (requested.values.description ?? current.description) as string | null;    const nextInstructions = (requested.values.instructions ?? current.instructions) as string | null;
    const nextPriority = (requested.values.priority ?? current.priority) as WorkOrderPriority;
    const nextDueAt = requested.values.dueAt !== undefined ? requested.values.dueAt : current.dueAt;
    const nextStart =
      requested.values.plannedStartAt !== undefined ? requested.values.plannedStartAt : current.plannedStartAt;
    const nextEnd =
      requested.values.plannedEndAt !== undefined ? requested.values.plannedEndAt : current.plannedEndAt;

    try {
      assertPlannedRange(nextStart as Date | null, nextEnd as Date | null);
    } catch (e) {
      throw fieldError('plannedEndAt', e instanceof Error ? e.message : 'Khoảng thời gian không hợp lệ');
    }

    // J8 — merge partial `customFields` lên giá trị hiện tại + re-validate
    // limits sau merge (vượt 50 key / 32KB → 400 fieldErrors `customFields`).
    let nextCustomFields = current.customFields;
    if (requested.customFieldsPatch !== undefined) {
      try {
        nextCustomFields = mergeCustomFields(current.customFields, requested.customFieldsPatch);
      } catch (e) {
        throw fieldError('customFields', e instanceof Error ? e.message : 'Dữ liệu bổ sung không hợp lệ');
      }
    }

    const changed = this.diff(current, {
      description: nextDescription,
      instructions: nextInstructions,
      priority: nextPriority,
      dueAt: nextDueAt as Date | null,
      plannedStartAt: nextStart as Date | null,
      plannedEndAt: nextEnd as Date | null,
      requiredTradeId,
      workTypeId,
      customFields: nextCustomFields,
    });
    if (changed.length === 0) {
      const workTypeName = await this.workOrderRepo.findWorkTypeNameById(current.workTypeId);
      return { entity: current, workTypeName, exceptionEdit: false, noOp: true };
    }

    // 6. Optimistic lock pre-check fail-fast.
    if (requested.expectedVersion !== null && current.version !== requested.expectedVersion) {
      throw versionConflict409(current.version);
    }

    const now = new Date();
    const updated = WorkOrderEntity.fromPersistence({
      ...current.getProps(),
      description: nextDescription,
      instructions: nextInstructions,
      priority: nextPriority,
      dueAt: nextDueAt as Date | null,
      plannedStartAt: nextStart as Date | null,
      plannedEndAt: nextEnd as Date | null,
      requiredTradeId,
      workTypeId,
      customFields: nextCustomFields,
      version: current.version + 1,
      updatedAt: now,
    });

    const beforeData: Record<string, unknown> = {};
    const afterData: Record<string, unknown> = {};
    for (const field of changed) {
      beforeData[field] = serializeValue(this.readField(current, field));
      afterData[field] = serializeValue(this.readField(updated, field));
    }
    const impacted = changed.filter((f) =>
      (WORKFLOW_IMPACTING_FIELDS as readonly string[]).includes(f),
    );
    const action = evaluation.exceptionEdit ? 'WORK_ORDER_EXCEPTION_EDIT' : 'JOB_WORK_ORDER_UPDATED';
    const reasonText = requested.reason?.trim() ? requested.reason.trim() : null;

    try {
      await this.tx.withTransaction(async (client: PoolClient) => {
        if (!this.workOrderRepo.updateWithClient) {
          throw new InternalServerErrorException('Không thể cập nhật công việc');
        }
        const affected = await this.workOrderRepo.updateWithClient(
          client,
          updated,
          requested.expectedVersion ?? undefined,
        );
        if (affected === 0 && requested.expectedVersion !== null) {
          const fresh = await this.workOrderRepo.findById(input.workOrderId);
          throw versionConflict409(fresh?.version ?? current.version + 1);
        }

        try {
          if (!this.audit.logWithClient) {
            throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
          }
          await this.audit.logWithClient(client, {
            actorUserId: input.actorUserId,
            action,
            entityType: 'WORK_ORDER',
            entityId: updated.id,
            beforeData,
            afterData,
            reason: reasonText,
            result: 'SUCCESS',
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            correlationId: input.correlationId ?? null,
          });
        } catch (e) {
          if (e instanceof ConflictException) throw e;
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }

        // Notification đổi lịch/skill/work-type cho creator (assignee defer #47),
        // TRONG tx — fail → rollback (500) như audit. Chỉ row, không email/push.
        if (impacted.length > 0) {
          try {
            const dedupKey = createHash('sha256')
              .update(`${updated.id}|${[...impacted].sort().join(',')}|${updated.version}`)
              .digest('hex')
              .slice(0, 64);
            const summary = impacted
              .map((f) => `${f}: ${String(beforeData[f] ?? 'trống')} → ${String(afterData[f] ?? 'trống')}`)
              .join('; ')
              .slice(0, 800);
            await client.query(
              `INSERT INTO public.notifications
                 (id, recipient_user_id, notification_type, title, content, entity_type, entity_id, dedup_key)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
              [
                updated.createdBy,
                'WORK_ORDER_UPDATED',
                `Công việc ${updated.code} đổi ${impacted.join(', ')} (version ${updated.version})`.slice(0, 200),
                `Công việc ${updated.code} đã thay đổi: ${summary}`.slice(0, 1000),
                'WORK_ORDER',
                updated.id,
                `woupd-${dedupKey}`,
              ],
            );
          } catch (e) {
            if (e instanceof ConflictException) throw e;
            throw new InternalServerErrorException('Không thể tạo thông báo cập nhật công việc');
          }
        }
      });
    } catch (e) {
      if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
      if (e instanceof InternalServerErrorException) throw e;
      throw e;
    }

    const workTypeName = await this.workOrderRepo.findWorkTypeNameById(workTypeId);
    return { entity: updated, workTypeName, exceptionEdit: evaluation.exceptionEdit, noOp: false };
  }

  private normalize(input: UpdateWorkOrderInput): {
    values: Partial<Record<UpdatableWorkOrderField, string | WorkOrderPriority | Date | WorkOrderCustomFields | null>>;
    customFieldsPatch: WorkOrderCustomFields | undefined;
    reason: string | null;
    expectedVersion: number | null;
  } {
    const values: Partial<Record<UpdatableWorkOrderField, string | WorkOrderPriority | Date | WorkOrderCustomFields | null>> = {};
    const mark = (field: UpdatableWorkOrderField, raw: unknown, parse: (v: unknown) => unknown): void => {
      if (raw === undefined) return;
      try {
        values[field] = parse(raw) as never;
      } catch (e) {
        throw fieldError(field, e instanceof Error ? e.message : 'Dữ liệu không hợp lệ');
      }
    };
    mark('description', input.description, (v) => normalizeWorkOrderText(v, 'Mô tả công việc'));
    mark('instructions', input.instructions, (v) => normalizeWorkOrderText(v, 'Hướng dẫn thực hiện'));
    mark('priority', input.priority, (v) => {
      if (v === null) throw new Error('Ưu tiên công việc không hợp lệ (LOW/NORMAL/HIGH/URGENT)');
      return normalizeWorkOrderPriority(v);
    });
    mark('dueAt', input.dueAt, (v) => parsePlannedDateTime(v));
    mark('plannedStartAt', input.plannedStartAt, (v) => parsePlannedDateTime(v));
    mark('plannedEndAt', input.plannedEndAt, (v) => parsePlannedDateTime(v));
    mark('requiredTradeId', input.requiredTradeId, (v) => {
      if (v === null) return null;
      const trimmed = String(v).trim();
      if (trimmed.length === 0) return null;
      if (!UUID_RE.test(trimmed)) throw new Error('Ngành nghề yêu cầu không hợp lệ');
      return trimmed;
    });
    mark('workTypeId', input.workTypeId, (v) => {
      const trimmed = String(v ?? '').trim();
      if (!UUID_RE.test(trimmed)) throw new Error('Loại công việc không hợp lệ');
      return trimmed;
    });

    // J8 — `customFields` là partial object (validate shape ở đây, merge +
    // re-validate limits ở execute). Object rỗng = không đụng (tránh bump
    // version giả).
    let customFieldsPatch: WorkOrderCustomFields | undefined;
    if (input.customFields !== undefined && input.customFields !== null) {
      try {
        const parsed = normalizeCustomFieldsInput(input.customFields);
        if (Object.keys(parsed).length > 0) customFieldsPatch = parsed;
      } catch (e) {
        throw fieldError('customFields', e instanceof Error ? e.message : 'Dữ liệu bổ sung không hợp lệ');
      }
    }

    let reason: string | null = null;
    if (input.reason !== undefined && input.reason !== null) {
      const trimmed = String(input.reason).trim();
      if (trimmed.length > 0) {
        if (trimmed.length > 1000) throw fieldError('reason', 'Lý do tối đa 1000 ký tự');
        reason = trimmed;
      }
    }

    let expectedVersion: number | null = null;
    if (input.expectedVersion !== undefined && input.expectedVersion !== null) {
      const num = typeof input.expectedVersion === 'number' ? input.expectedVersion : Number(input.expectedVersion);
      if (!Number.isInteger(num) || num < 1) {
        throw fieldError('expectedVersion', 'Phiên bản kỳ vọng phải là số nguyên lớn hơn 0');
      }
      expectedVersion = num;
    }
    return { values, customFieldsPatch, reason, expectedVersion };
  }

  private readField(entity: WorkOrderEntity, field: UpdatableWorkOrderField): unknown {
    switch (field) {
      case 'description': return entity.description;
      case 'instructions': return entity.instructions;
      case 'priority': return entity.priority;
      case 'dueAt': return entity.dueAt;
      case 'plannedStartAt': return entity.plannedStartAt;
      case 'plannedEndAt': return entity.plannedEndAt;
      case 'requiredTradeId': return entity.requiredTradeId;
      case 'workTypeId': return entity.workTypeId;
      case 'customFields': return entity.customFields;
      default: return null;
    }
  }

  private diff(
    current: WorkOrderEntity,
    next: Record<UpdatableWorkOrderField, string | WorkOrderPriority | Date | WorkOrderCustomFields | null>,
  ): UpdatableWorkOrderField[] {
    const changed: UpdatableWorkOrderField[] = [];
    for (const field of UPDATABLE_WORK_ORDER_FIELDS) {
      const oldValue = this.readField(current, field);
      const newValue = next[field];
      let same: boolean;
      if (field === 'customFields') {
        same = JSON.stringify(oldValue ?? {}) === JSON.stringify(newValue ?? {});
      } else {
        same =
          oldValue instanceof Date || newValue instanceof Date
            ? oldValue instanceof Date &&
              newValue instanceof Date &&
              oldValue.getTime() === newValue.getTime()
            : oldValue === newValue;
      }
      if (!same) changed.push(field);
    }
    return changed;
  }
}

export type { WorkOrderStatus };
