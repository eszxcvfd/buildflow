import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';
import {
  ChecklistSnapshotItem,
  RequiredSkillRef,
  WoTemplatePriority,
  normalizeChecklistSnapshot,
  normalizeRequiredSkills,
  normalizeWoTemplateCode,
  normalizeWoTemplateDescription,
  normalizeWoTemplateDuration,
  normalizeWoTemplateName,
  normalizeWoTemplateOptionalUuid,
  normalizeWoTemplatePriority,
  normalizeWoTemplateReason,
} from '../../domain/service/work-order-template.policy';

export interface UpdateWorkOrderTemplateInput {
  templateId: string;
  code?: string;
  name?: string;
  description?: string | null;
  /** Đổi loại công việc; null = gỡ liên kết. Không gửi = giữ nguyên. */
  workTypeId?: string | null;
  /** Đổi skill scope; null = gỡ. Không gửi = giữ nguyên. */
  requiredTradeId?: string | null;
  requiredSkills?: unknown;
  checklistSnapshot?: unknown;
  sourceChecklistTemplateId?: string | null;
  defaultDurationMinutes?: number | null;
  defaultPriority?: WoTemplatePriority;
  /**
   * Optimistic locking: client gửi version đã thấy; mismatch →
   * 409 `WORK_ORDER_TEMPLATE_CONFIG_CONFLICT` (hai người sửa đồng thời).
   * Không gửi = last-write-wins (không check).
   */
  expectedVersion?: number;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateWorkOrderTemplateOutput {
  entity: WorkOrderTemplateEntity;
  /** true khi field nghiệp vụ đổi → `version` đã +1. */
  versionChanged: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function duplicateCode409(): ConflictException {
  return new ConflictException({ statusCode: 409, message: 'Mã mẫu công việc đã tồn tại', code: 'WORK_ORDER_TEMPLATE_CODE_DUPLICATE' });
}

function emptyActiveTemplate400(): BadRequestException {
  const message =
    'Mẫu đang hoạt động phải có ít nhất một kỹ năng hoặc một checklist item; bổ sung requiredSkills hoặc checklistSnapshot (mẫu nháp cho phép để trống)';
  return new BadRequestException({
    statusCode: 400,
    message,
    code: 'WORK_ORDER_TEMPLATE_EMPTY',
    fieldErrors: { requiredSkills: [message], checklistSnapshot: [message] },
  });
}

function configConflict409(current: number): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: `Mẫu công việc đã bị thay đổi bởi người dùng khác (hiện tại version ${current}); vui lòng tải lại và thử lại`,
    code: 'WORK_ORDER_TEMPLATE_CONFIG_CONFLICT',
    fieldErrors: {
      expectedVersion: [`Version mẫu đã thay đổi (hiện tại: ${current})`],
    },
  });
}

/**
 * PRJ-SRS-008 (issue #39) — sửa mẫu tại chỗ (giữ `id`; Work Order đã tạo giữ
 * snapshot-copy, không hồi tố).
 * - Optimistic locking: `expectedVersion` mismatch → 409
 *   `WORK_ORDER_TEMPLATE_CONFIG_CONFLICT` + fieldErrors. Pre-check fail-fast +
 *   SQL guard `UPDATE ... WHERE id AND version` (rowcount 0 → 409 từ repo).
 * - Nội dung nghiệp vụ đổi (code/name/description/workType/trade/duration/
 *   priority/skills/checklist) → `version` +1; chỉ đổi provenance
 *   (`sourceChecklistTemplateId`) → không bump.
 * - PATCH không thay đổi hiệu lực → no-op, không audit (precedent #34/#35).
 * - Guard rỗng trên ACTIVE (review P2-1 issue #39): sau apply payload, nếu
 *   `status` ACTIVE mà cả `requiredSkills` + `checklistSnapshot` đều rỗng →
 *   400 `WORK_ORDER_TEMPLATE_EMPTY` (mirror publish-guard ACTIVATE, mirror
 *   `/active` chỉ phục vụ mẫu có nội dung). DRAFT cho phép để trống.
 * - Audit `PRJ_WO_TEMPLATE_UPDATED` (before/after, `reason` ở cột audit).
 */
@Injectable()
export class UpdateWorkOrderTemplateUseCase {
  constructor(
    @Inject(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY) private readonly repo: WorkOrderTemplateRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateWorkOrderTemplateInput): Promise<UpdateWorkOrderTemplateOutput> {
    const entity = await this.repo.findById(input.templateId);
    if (!entity) throw new NotFoundException('Không tìm thấy mẫu công việc');

    if (input.expectedVersion !== undefined && input.expectedVersion !== entity.version) {
      throw configConflict409(entity.version);
    }

    let code: string | undefined;
    if (input.code !== undefined) {
      try {
        code = normalizeWoTemplateCode(input.code);
      } catch (e) {
        throw fieldError('code', e instanceof Error ? e.message : 'Mã mẫu không hợp lệ');
      }
      if (code.toLowerCase() !== entity.code.toLowerCase()) {
        const byCode = await this.repo.findByCode(code);
        if (byCode && byCode.id !== input.templateId) throw duplicateCode409();
      }
    }
    let name: string | undefined;
    if (input.name !== undefined) {
      try {
        name = normalizeWoTemplateName(input.name);
      } catch (e) {
        throw fieldError('name', e instanceof Error ? e.message : 'Tên mẫu không hợp lệ');
      }
    }
    let description: string | null | undefined;
    if (input.description !== undefined) {
      try {
        description = normalizeWoTemplateDescription(input.description);
      } catch (e) {
        throw fieldError('description', e instanceof Error ? e.message : 'Mô tả không hợp lệ');
      }
    }
    let workTypeId: string | null | undefined;
    if (input.workTypeId !== undefined) {
      workTypeId = normalizeWoTemplateOptionalUuid(input.workTypeId, 'workTypeId');
      if (workTypeId !== null && !UUID_RE.test(workTypeId)) {
        throw fieldError('workTypeId', 'workTypeId phải là UUID hợp lệ');
      }
      if (workTypeId !== null) {
        const wt = await this.repo.findActiveWorkTypeById(workTypeId);
        if (!wt || !wt.isActive) {
          throw fieldError('workTypeId', 'Loại công việc không tồn tại hoặc đã ngừng hoạt động');
        }
      }
    }
    let requiredTradeId: string | null | undefined;
    if (input.requiredTradeId !== undefined) {
      requiredTradeId = normalizeWoTemplateOptionalUuid(input.requiredTradeId, 'requiredTradeId');
      if (requiredTradeId !== null && !UUID_RE.test(requiredTradeId)) {
        throw fieldError('requiredTradeId', 'requiredTradeId phải là UUID hợp lệ');
      }
      if (requiredTradeId !== null) {
        const trade = await this.repo.findActiveTradeById(requiredTradeId);
        if (!trade || !trade.isActive) {
          throw fieldError('requiredTradeId', 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động');
        }
      }
    }
    let requiredSkills: RequiredSkillRef[] | undefined;
    if (input.requiredSkills !== undefined) {
      try {
        requiredSkills = normalizeRequiredSkills(input.requiredSkills);
      } catch (e) {
        throw fieldError('requiredSkills', e instanceof Error ? e.message : 'Kỹ năng không hợp lệ');
      }
      for (const skill of requiredSkills) {
        const trade = await this.repo.findActiveTradeByCode(skill.code);
        if (!trade || !trade.isActive) {
          throw fieldError('requiredSkills', `Kỹ năng ${skill.code} không tồn tại hoặc đã ngừng hoạt động`);
        }
      }
    }
    let checklistSnapshot: ChecklistSnapshotItem[] | undefined;
    if (input.checklistSnapshot !== undefined) {
      try {
        checklistSnapshot = normalizeChecklistSnapshot(input.checklistSnapshot);
      } catch (e) {
        throw fieldError('checklistSnapshot', e instanceof Error ? e.message : 'Checklist không hợp lệ');
      }
    }
    let sourceChecklistTemplateId: string | null | undefined;
    if (input.sourceChecklistTemplateId !== undefined) {
      sourceChecklistTemplateId = normalizeWoTemplateOptionalUuid(
        input.sourceChecklistTemplateId,
        'sourceChecklistTemplateId',
      );
      if (sourceChecklistTemplateId !== null && !UUID_RE.test(sourceChecklistTemplateId)) {
        throw fieldError('sourceChecklistTemplateId', 'sourceChecklistTemplateId phải là UUID hợp lệ');
      }
      if (sourceChecklistTemplateId !== null) {
        const snapshot = await this.repo.findChecklistTemplateSnapshot(sourceChecklistTemplateId);
        if (!snapshot) {
          throw fieldError('sourceChecklistTemplateId', 'Mẫu checklist nguồn không tồn tại');
        }
      }
    }
    let defaultDurationMinutes: number | null | undefined;
    if (input.defaultDurationMinutes !== undefined) {
      try {
        defaultDurationMinutes = normalizeWoTemplateDuration(input.defaultDurationMinutes);
      } catch (e) {
        throw fieldError('defaultDurationMinutes', e instanceof Error ? e.message : 'Thời lượng không hợp lệ');
      }
    }
    let defaultPriority: WoTemplatePriority | undefined;
    if (input.defaultPriority !== undefined) {
      try {
        defaultPriority = normalizeWoTemplatePriority(input.defaultPriority);
      } catch (e) {
        throw fieldError('defaultPriority', e instanceof Error ? e.message : 'Ưu tiên không hợp lệ');
      }
    }
    let reason: string | null;
    try {
      reason = normalizeWoTemplateReason(input.reason);
    } catch (e) {
      throw fieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }

    const before = entity.toPublic();
    // Guard rỗng trên ACTIVE: trạng thái hiệu lực sau apply phải giữ ít nhất
    // một skill hoặc một checklist item (mirror publish-guard ACTIVATE) —
    // ngược lại `/active` sẽ phục vụ mẫu rỗng. Tính trên effective state
    // (payload đã normalize, field không gửi = giữ nguyên) và check trước
    // apply để entity không bị mutate khi throw. DRAFT cho phép để trống.
    if (entity.status === 'ACTIVE') {
      const effectiveSkills = requiredSkills ?? before.requiredSkills;
      const effectiveChecklist = checklistSnapshot ?? before.checklistSnapshot;
      if (effectiveSkills.length === 0 && effectiveChecklist.length === 0) {
        throw emptyActiveTemplate400();
      }
    }
    let versionChanged: boolean;
    try {
      versionChanged = entity.applyTemplateUpdate(
        {
          code,
          name,
          description,
          workTypeId,
          requiredTradeId,
          defaultDurationMinutes,
          defaultPriority,
          requiredSkills,
          checklistSnapshot,
          sourceChecklistTemplateId,
        },
        new Date(),
      );
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Dữ liệu không hợp lệ');
    }
    const provenanceChanged =
      sourceChecklistTemplateId !== undefined &&
      sourceChecklistTemplateId !== before.sourceChecklistTemplateId;
    if (!versionChanged && !provenanceChanged) {
      return { entity, versionChanged: false };
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        // Guard SQL chống lost update: pre-check ở trên fail-fast cho
        // sequential mismatch; opts này đóng race hai PATCH đồng thời cùng
        // version (rowcount 0 → 409 từ repo).
        const guard = { expectedVersion: input.expectedVersion };
        if (this.repo.saveWithClient) await this.repo.saveWithClient(client, entity, guard);
        else await this.repo.save(entity, guard);
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        if (/ux_work_order_templates_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_WO_TEMPLATE_UPDATED',
          entityType: 'WORK_ORDER_TEMPLATE',
          entityId: input.templateId,
          beforeData: before,
          afterData: entity.toPublic(),
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
          reason: reason ?? null,
        };
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity, versionChanged };
  }
}
