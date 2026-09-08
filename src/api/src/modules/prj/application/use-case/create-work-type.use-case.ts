import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  normalizeWorkTypeTradeId,
} from '../../domain/service/work-type.policy';

export interface CreateWorkTypeInput {
  code: string;
  name: string;
  description?: string | null;
  group?: string | null;
  requiredTradeId?: string | null;
  requiredFields?: unknown;
  defaultDurationMinutes?: number | null;
  defaultPriority?: WorkTypePriority | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateWorkTypeOutput {
  entity: WorkTypeEntity;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function duplicateCode409(): ConflictException {
  return new ConflictException({ statusCode: 409, message: 'Mã loại công việc đã tồn tại', code: 'WORK_TYPE_CODE_DUPLICATE' });
}

/**
 * PRJ-SRS-004 (issue #35) — tạo loại công việc.
 * - `required_trade_id` phải tồn tại VÀ đang active (trade inactive →
 *   400 fieldErrors `{requiredTradeId}`); null = không yêu cầu skill.
 * - Trùng code (case-insensitive) → 409 `WORK_TYPE_CODE_DUPLICATE`
 *   (pre-check `findByCode` + race guard `ux_work_types_code` trong tx,
 *   constraint-cụ-thể-trước; bare 23505 rethrow — precedent areas #34).
 * - Audit `PRJ_WORK_TYPE_CREATED` (`entityType` `WORK_TYPE`, tx-embedded).
 */
@Injectable()
export class CreateWorkTypeUseCase {
  constructor(
    @Inject(PRJ_WORK_TYPE_REPOSITORY) private readonly workTypeRepo: WorkTypeRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateWorkTypeInput): Promise<CreateWorkTypeOutput> {
    let code: string;
    try {
      code = normalizeWorkTypeCode(input.code);
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Mã loại công việc không hợp lệ');
    }
    let name: string;
    try {
      name = normalizeWorkTypeName(input.name);
    } catch (e) {
      throw fieldError('name', e instanceof Error ? e.message : 'Tên loại công việc không hợp lệ');
    }
    let description: string | null;
    try {
      description = normalizeWorkTypeDescription(input.description);
    } catch (e) {
      throw fieldError('description', e instanceof Error ? e.message : 'Mô tả không hợp lệ');
    }
    let group: string | null;
    try {
      group = normalizeWorkTypeGroup(input.group);
    } catch (e) {
      throw fieldError('group', e instanceof Error ? e.message : 'Nhóm công việc không hợp lệ');
    }
    let requiredFields: RequiredFieldConfig[];
    try {
      requiredFields = normalizeRequiredFields(input.requiredFields);
    } catch (e) {
      throw fieldError('requiredFields', e instanceof Error ? e.message : 'Dữ liệu bắt buộc không hợp lệ');
    }
    let defaultDurationMinutes: number | null;
    try {
      defaultDurationMinutes = normalizeWorkTypeDuration(input.defaultDurationMinutes);
    } catch (e) {
      throw fieldError('defaultDurationMinutes', e instanceof Error ? e.message : 'Thời lượng không hợp lệ');
    }
    let defaultPriority: WorkTypePriority;
    try {
      defaultPriority = normalizeWorkTypePriority(input.defaultPriority);
    } catch (e) {
      throw fieldError('defaultPriority', e instanceof Error ? e.message : 'Ưu tiên không hợp lệ');
    }
    const requiredTradeId = normalizeWorkTypeTradeId(input.requiredTradeId);

    if (requiredTradeId !== null) {
      const trade = await this.workTypeRepo.findActiveTradeById(requiredTradeId);
      if (!trade || !trade.isActive) {
        throw fieldError('requiredTradeId', 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động');
      }
    }

    const byCode = await this.workTypeRepo.findByCode(code);
    if (byCode) throw duplicateCode409();

    const now = new Date();
    const id = randomUUID();
    let entity: WorkTypeEntity;
    try {
      entity = new WorkTypeEntity({
        id,
        code,
        name,
        description,
        group,
        requiredTradeId,
        requiredFields,
        configVersion: 1,
        defaultDurationMinutes,
        defaultPriority,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Dữ liệu không hợp lệ');
    }

    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.workTypeRepo.createWithClient) {
          await this.workTypeRepo.createWithClient(client, entity);
        } else {
          await this.workTypeRepo.create(entity);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        if (/ux_work_types_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'PRJ_WORK_TYPE_CREATED',
          entityType: 'WORK_TYPE',
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

    return { entity };
  }
}
