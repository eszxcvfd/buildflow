import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_WORK_TYPE_REPOSITORY, WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import {
  RequiredFieldConfig,
  WorkTypePriority,
  normalizeRequiredFields,
  normalizeWorkTypeCode,
  normalizeWorkTypeDescription,
  normalizeWorkTypeDuration,
  normalizeWorkTypeGroup,
  normalizeWorkTypeName,
  normalizeWorkTypePriority,
  normalizeWorkTypeReason,
  normalizeWorkTypeTradeId,
} from '../../domain/service/work-type.policy';

export interface UpdateWorkTypeInput {
  workTypeId: string;
  code?: string;
  name?: string;
  description?: string | null;
  group?: string | null;
  /** Đổi skill yêu cầu; null = gỡ yêu cầu skill. Không gửi = giữ nguyên. */
  requiredTradeId?: string | null;
  requiredFields?: unknown;
  defaultDurationMinutes?: number | null;
  defaultPriority?: WorkTypePriority;
  /**
   * Optimistic locking: client gửi version đã thấy; mismatch →
   * 409 `WORK_TYPE_CONFIG_CONFLICT` (hai admin cập nhật đồng thời).
   * Không gửi = last-write-wins (không check).
   */
  expectedConfigVersion?: number;
  reason?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateWorkTypeOutput {
  entity: WorkTypeEntity;
  /** true khi config-relevant field đổi → `config_version` đã +1. */
  versionChanged: boolean;
  /** Cảnh báo phạm vi áp dụng khi config đổi mà WO đang tham chiếu. */
  warning?: string;
}

export const WORK_TYPE_CONFIG_APPLY_WARNING =
  'Cấu hình đã thay đổi trong khi Work Order đang tham chiếu; các Work Order cũ giữ phiên bản trước';

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function duplicateCode409(): ConflictException {
  return new ConflictException({ statusCode: 409, message: 'Mã loại công việc đã tồn tại', code: 'WORK_TYPE_CODE_DUPLICATE' });
}

function configConflict409(current: number): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: `Cấu hình đã bị thay đổi bởi người dùng khác (hiện tại version ${current}); vui lòng tải lại và thử lại`,
    code: 'WORK_TYPE_CONFIG_CONFLICT',
    fieldErrors: {
      expectedConfigVersion: [`Version cấu hình đã thay đổi (hiện tại: ${current})`],
    },
  });
}

/**
 * PRJ-SRS-004 (issue #35) — cập nhật loại công việc tại chỗ (giữ `id` history).
 * - Optimistic locking: `expectedConfigVersion` mismatch → 409
 *   `WORK_TYPE_CONFIG_CONFLICT` + fieldErrors (không mất thay đổi).
 *   Pre-check fail-fast + SQL guard `UPDATE ... WHERE id AND config_version`
 *   (rowcount 0 → 409 từ repo) — hai PATCH đồng thời cùng version không lost update.
 * - Config đổi (code/name/group/trade/requiredFields) → `config_version` +1;
 *   nếu WO đang tham chiếu → kèm `warning` phạm vi áp dụng (WO cũ giữ bản trước).
 * - `required_trade_id` đổi sang trade không tồn tại/inactive → 400 fieldErrors.
 * - Trùng code (trừ self, CI) → 409 `WORK_TYPE_CODE_DUPLICATE`.
 * - PATCH không thay đổi hiệu lực → no-op, không audit (precedent areas #34).
 * - Audit `PRJ_WORK_TYPE_UPDATED` (before/after, `reason` ở cột audit).
 */
@Injectable()
export class UpdateWorkTypeUseCase {
  constructor(
    @Inject(PRJ_WORK_TYPE_REPOSITORY) private readonly workTypeRepo: WorkTypeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateWorkTypeInput): Promise<UpdateWorkTypeOutput> {
    const entity = await this.workTypeRepo.findById(input.workTypeId);
    if (!entity) throw new NotFoundException('Không tìm thấy loại công việc');

    if (input.expectedConfigVersion !== undefined && input.expectedConfigVersion !== entity.configVersion) {
      throw configConflict409(entity.configVersion);
    }

    let code: string | undefined;
    if (input.code !== undefined) {
      try {
        code = normalizeWorkTypeCode(input.code);
      } catch (e) {
        throw fieldError('code', e instanceof Error ? e.message : 'Mã loại công việc không hợp lệ');
      }
      if (code.toLowerCase() !== entity.code.toLowerCase()) {
        const byCode = await this.workTypeRepo.findByCode(code);
        if (byCode && byCode.id !== input.workTypeId) throw duplicateCode409();
      }
    }
    let name: string | undefined;
    if (input.name !== undefined) {
      try {
        name = normalizeWorkTypeName(input.name);
      } catch (e) {
        throw fieldError('name', e instanceof Error ? e.message : 'Tên loại công việc không hợp lệ');
      }
    }
    let description: string | null | undefined;
    if (input.description !== undefined) {
      try {
        description = normalizeWorkTypeDescription(input.description);
      } catch (e) {
        throw fieldError('description', e instanceof Error ? e.message : 'Mô tả không hợp lệ');
      }
    }
    let group: string | null | undefined;
    if (input.group !== undefined) {
      try {
        group = normalizeWorkTypeGroup(input.group);
      } catch (e) {
        throw fieldError('group', e instanceof Error ? e.message : 'Nhóm công việc không hợp lệ');
      }
    }
    let requiredTradeId: string | null | undefined;
    if (input.requiredTradeId !== undefined) {
      requiredTradeId = normalizeWorkTypeTradeId(input.requiredTradeId);
      if (requiredTradeId !== null) {
        const trade = await this.workTypeRepo.findActiveTradeById(requiredTradeId);
        if (!trade || !trade.isActive) {
          throw fieldError('requiredTradeId', 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động');
        }
      }
    }
    let requiredFields: RequiredFieldConfig[] | undefined;
    if (input.requiredFields !== undefined) {
      try {
        requiredFields = normalizeRequiredFields(input.requiredFields);
      } catch (e) {
        throw fieldError('requiredFields', e instanceof Error ? e.message : 'Dữ liệu bắt buộc không hợp lệ');
      }
    }
    let defaultDurationMinutes: number | null | undefined;
    if (input.defaultDurationMinutes !== undefined) {
      try {
        defaultDurationMinutes = normalizeWorkTypeDuration(input.defaultDurationMinutes);
      } catch (e) {
        throw fieldError('defaultDurationMinutes', e instanceof Error ? e.message : 'Thời lượng không hợp lệ');
      }
    }
    let defaultPriority: WorkTypePriority | undefined;
    if (input.defaultPriority !== undefined) {
      try {
        defaultPriority = normalizeWorkTypePriority(input.defaultPriority);
      } catch (e) {
        throw fieldError('defaultPriority', e instanceof Error ? e.message : 'Ưu tiên không hợp lệ');
      }
    }
    let reason: string | null;
    try {
      reason = normalizeWorkTypeReason(input.reason);
    } catch (e) {
      throw fieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }

    const before = entity.toPublic();
    let versionChanged: boolean;
    try {
      versionChanged = entity.applyConfigUpdate(
        {
          code,
          name,
          description,
          group,
          requiredTradeId,
          requiredFields,
          defaultDurationMinutes,
          defaultPriority,
        },
        new Date(),
      );
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Dữ liệu không hợp lệ');
    }
    const displayChanged =
      (description !== undefined && description !== before.description) ||
      (defaultDurationMinutes !== undefined && defaultDurationMinutes !== before.defaultDurationMinutes) ||
      (defaultPriority !== undefined && defaultPriority !== before.defaultPriority);
    if (!versionChanged && !displayChanged) {
      return { entity, versionChanged: false };
    }

    let warning: string | undefined;
    if (versionChanged) {
      const usage = await this.workTypeRepo.countActiveWorkOrders(input.workTypeId);
      if (usage > 0) warning = WORK_TYPE_CONFIG_APPLY_WARNING;
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        // Guard SQL chống lost update: pre-check ở trên fail-fast cho
        // sequential mismatch; opts này đóng race hai PATCH đồng thời cùng
        // version (rowcount 0 → 409 WORK_TYPE_CONFIG_CONFLICT từ repo).
        const guard = { expectedConfigVersion: input.expectedConfigVersion };
        if (this.workTypeRepo.saveWithClient) await this.workTypeRepo.saveWithClient(client, entity, guard);
        else await this.workTypeRepo.save(entity, guard);
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        if (/ux_work_types_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }

      try {
        const afterData = entity.toPublic() as Record<string, unknown>;
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_WORK_TYPE_UPDATED',
          entityType: 'WORK_TYPE',
          entityId: input.workTypeId,
          beforeData: before,
          afterData,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
          reason: reason ?? null,
        };
        if (warning) afterData['_warning'] = warning;
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity, versionChanged, warning };
  }
}
