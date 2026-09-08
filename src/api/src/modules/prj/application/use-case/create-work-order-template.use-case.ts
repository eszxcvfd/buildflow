import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { PRJ_WORK_ORDER_TEMPLATE_REPOSITORY, TemplateWorkTypeRef, WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';
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
} from '../../domain/service/work-order-template.policy';

export interface CreateWorkOrderTemplateInput {
  code: string;
  name: string;
  description?: string | null;
  workTypeId?: string | null;
  requiredTradeId?: string | null;
  requiredSkills?: unknown;
  checklistSnapshot?: unknown;
  sourceChecklistTemplateId?: string | null;
  defaultDurationMinutes?: number | null;
  defaultPriority?: WoTemplatePriority | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateWorkOrderTemplateOutput {
  entity: WorkOrderTemplateEntity;
  /** Enrichment `workType` cho create response (null-map khi `work_type_id` NULL). */
  workTypeRefs: Map<string, TemplateWorkTypeRef>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function duplicateCode409(): ConflictException {
  return new ConflictException({ statusCode: 409, message: 'Mã mẫu công việc đã tồn tại', code: 'WORK_ORDER_TEMPLATE_CODE_DUPLICATE' });
}

/**
 * PRJ-SRS-008 (issue #39) — tạo mẫu công việc (khởi tạo `DRAFT`, `version` 1).
 * - `work_type_id` khi gửi phải tồn tại VÀ ACTIVE (inactive → 400 fieldErrors).
 * - `required_trade_id` khi gửi phải tồn tại VÀ ACTIVE (null = không giới hạn).
 * - `required_skills[].code` là trade code: từng code phải tồn tại VÀ ACTIVE.
 * - `checklist_snapshot` entries đúng shape app-layer (policy).
 * - `source_checklist_template_id` khi gửi phải tồn tại; khi caller omit
 *   `checklistSnapshot` thì snapshot-copy items của source vào snapshot
 *   (provenance, không live link). Snapshot gửi tường minh luôn thắng.
 * - Trùng code (case-insensitive) → 409 `WORK_ORDER_TEMPLATE_CODE_DUPLICATE`
 *   (pre-check `findByCode` + race guard `ux_work_order_templates_code`).
 * - Audit `PRJ_WO_TEMPLATE_CREATED` (`entityType` `WORK_ORDER_TEMPLATE`, tx-embedded).
 */
@Injectable()
export class CreateWorkOrderTemplateUseCase {
  constructor(
    @Inject(PRJ_WORK_ORDER_TEMPLATE_REPOSITORY) private readonly repo: WorkOrderTemplateRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateWorkOrderTemplateInput): Promise<CreateWorkOrderTemplateOutput> {
    let code: string;
    try {
      code = normalizeWoTemplateCode(input.code);
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Mã mẫu không hợp lệ');
    }
    let name: string;
    try {
      name = normalizeWoTemplateName(input.name);
    } catch (e) {
      throw fieldError('name', e instanceof Error ? e.message : 'Tên mẫu không hợp lệ');
    }
    let description: string | null;
    try {
      description = normalizeWoTemplateDescription(input.description);
    } catch (e) {
      throw fieldError('description', e instanceof Error ? e.message : 'Mô tả không hợp lệ');
    }
    let defaultDurationMinutes: number | null;
    try {
      defaultDurationMinutes = normalizeWoTemplateDuration(input.defaultDurationMinutes);
    } catch (e) {
      throw fieldError('defaultDurationMinutes', e instanceof Error ? e.message : 'Thời lượng không hợp lệ');
    }
    let defaultPriority: WoTemplatePriority;
    try {
      defaultPriority = normalizeWoTemplatePriority(input.defaultPriority);
    } catch (e) {
      throw fieldError('defaultPriority', e instanceof Error ? e.message : 'Ưu tiên không hợp lệ');
    }
    let requiredSkills: RequiredSkillRef[];
    try {
      requiredSkills = normalizeRequiredSkills(input.requiredSkills);
    } catch (e) {
      throw fieldError('requiredSkills', e instanceof Error ? e.message : 'Kỹ năng không hợp lệ');
    }
    let checklistSnapshot: ChecklistSnapshotItem[];
    try {
      checklistSnapshot = normalizeChecklistSnapshot(input.checklistSnapshot);
    } catch (e) {
      throw fieldError('checklistSnapshot', e instanceof Error ? e.message : 'Checklist không hợp lệ');
    }

    const workTypeId = normalizeWoTemplateOptionalUuid(input.workTypeId, 'workTypeId');
    const requiredTradeId = normalizeWoTemplateOptionalUuid(input.requiredTradeId, 'requiredTradeId');
    const sourceChecklistTemplateId = normalizeWoTemplateOptionalUuid(
      input.sourceChecklistTemplateId,
      'sourceChecklistTemplateId',
    );
    for (const [field, value] of [
      ['workTypeId', workTypeId],
      ['requiredTradeId', requiredTradeId],
      ['sourceChecklistTemplateId', sourceChecklistTemplateId],
    ] as const) {
      if (value !== null && !UUID_RE.test(value)) {
        throw fieldError(field, `${field} phải là UUID hợp lệ`);
      }
    }

    if (workTypeId !== null) {
      const wt = await this.repo.findActiveWorkTypeById(workTypeId);
      if (!wt || !wt.isActive) {
        throw fieldError('workTypeId', 'Loại công việc không tồn tại hoặc đã ngừng hoạt động');
      }
    }
    if (requiredTradeId !== null) {
      const trade = await this.repo.findActiveTradeById(requiredTradeId);
      if (!trade || !trade.isActive) {
        throw fieldError('requiredTradeId', 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động');
      }
    }
    for (const skill of requiredSkills) {
      const trade = await this.repo.findActiveTradeByCode(skill.code);
      if (!trade || !trade.isActive) {
        throw fieldError('requiredSkills', `Kỹ năng ${skill.code} không tồn tại hoặc đã ngừng hoạt động`);
      }
    }

    if (sourceChecklistTemplateId !== null) {
      const snapshot = await this.repo.findChecklistTemplateSnapshot(sourceChecklistTemplateId);
      if (!snapshot) {
        throw fieldError('sourceChecklistTemplateId', 'Mẫu checklist nguồn không tồn tại');
      }
      if (input.checklistSnapshot === undefined || input.checklistSnapshot === null) {
        checklistSnapshot = snapshot.items;
      }
    }

    const byCode = await this.repo.findByCode(code);
    if (byCode) throw duplicateCode409();

    const now = new Date();
    const id = randomUUID();
    let entity: WorkOrderTemplateEntity;
    try {
      entity = new WorkOrderTemplateEntity({
        id,
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
        status: 'DRAFT',
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Dữ liệu không hợp lệ');
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.repo.createWithClient) {
          await this.repo.createWithClient(client, entity);
        } else {
          await this.repo.create(entity);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        if (/ux_work_order_templates_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'PRJ_WO_TEMPLATE_CREATED',
          entityType: 'WORK_ORDER_TEMPLATE',
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

    const workTypeRefs = await this.repo.findWorkTypeRefs(entity.workTypeId ? [entity.workTypeId] : []);
    return { entity, workTypeRefs };
  }
}
