import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  PRJ_PROJECT_REPOSITORY,
  ProjectRepositoryPort,
  PRJ_PROJECT_AREA_REPOSITORY,
  ProjectAreaRepositoryPort,
  ProjectAreaRow,
} from '../../domain/repository/project-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import {
  normalizeProjectAreaCode,
  normalizeProjectAreaName,
  normalizeProjectAreaReason,
} from '../../domain/service/project-area.policy';
import { assertProjectAreaScope } from './project-area-scope';

export interface UpdateProjectAreaInput {
  projectId: string;
  areaId: string;
  /** Rename tại chỗ (giữ `area_id` history). Không gửi = giữ nguyên. */
  name?: string;
  /** Đổi mã tại chỗ; null = gỡ mã. Không gửi = giữ nguyên. */
  code?: string | null;
  /** Toggle active (false = soft-retire, đường xóa duy nhất). Không gửi = giữ nguyên. */
  isActive?: boolean;
  /** Lý do nghiệp vụ optional 1-500 → cột `audit_logs.reason` (+ `afterData` khi có). */
  reason?: string | null;
  actorUserId: string;
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateProjectAreaOutput {
  area: ProjectAreaRow;
  /** true khi deactivate khu vực đã inactive: không mutation, không audit. */
  alreadyInactive: boolean;
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function coded409(code: string, message: string): ConflictException {
  return new ConflictException({ statusCode: 409, message, code });
}

function duplicateName409(): ConflictException {
  return coded409('AREA_DUPLICATE', 'Tên khu vực đã tồn tại trong dự án');
}

function duplicateCode409(): ConflictException {
  return coded409('AREA_CODE_DUPLICATE', 'Mã khu vực đã tồn tại trong dự án');
}

/**
 * PRJ-SRS-003 (issue #34, A1-A3/A6) — cập nhật khu vực (rename tại chỗ /
 * đổi mã / toggle active).
 * - Area phải thuộc đúng project (sai project → 404 chung, không leak).
 * - Scope A4 + closed-project A5 như create (không check status).
 * - Deactivate khu vực đã inactive → 200 `{alreadyInactive: true}`, không
 *   mutation, không audit (idempotent — precedent alreadyRemoved #30/#36).
 * - Rename đổi tên tại chỗ qua entity + save (không đụng `area_id` history);
 *   audit `PRJ_PROJECT_AREA_UPDATED` before/after full row + `projectCode`
 *   (`reason` ở cột audit và trong `afterData` khi gửi).
 * - Trùng tên active (trừ self) → 409 `AREA_DUPLICATE`; trùng mã (trừ self)
 *   → 409 `AREA_CODE_DUPLICATE`; constraint-cụ-thể-trước, bare 23505 rethrow.
 */
@Injectable()
export class UpdateProjectAreaUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(PRJ_PROJECT_AREA_REPOSITORY) private readonly areaRepo: ProjectAreaRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateProjectAreaInput): Promise<UpdateProjectAreaOutput> {
    let name: string | undefined;
    if (input.name !== undefined) {
      try {
        name = normalizeProjectAreaName(input.name);
      } catch (e) {
        throw fieldError('name', e instanceof Error ? e.message : 'Tên khu vực không hợp lệ');
      }
    }

    let code: string | null | undefined;
    if (input.code !== undefined) {
      try {
        code = normalizeProjectAreaCode(input.code);
      } catch (e) {
        throw fieldError('code', e instanceof Error ? e.message : 'Mã khu vực không hợp lệ');
      }
    }

    let reason: string | null = null;
    try {
      reason = normalizeProjectAreaReason(input.reason);
    } catch (e) {
      throw fieldError('reason', e instanceof Error ? e.message : 'Lý do không hợp lệ');
    }

    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') {
      throw fieldError('isActive', 'Trạng thái hoạt động không hợp lệ');
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const existing = await this.areaRepo.findAreaById(input.areaId);
    if (!existing || existing.projectId !== input.projectId) {
      throw new NotFoundException('Không tìm thấy khu vực trong dự án');
    }

    await assertProjectAreaScope(this.areaRepo, {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
    });

    const projectCode = project.code;
    let result: UpdateProjectAreaOutput | null = null;

    await this.tx.withTransaction(async (client: PoolClient) => {
      const current = await this.areaRepo.findAreaForUpdateWithClient(client, input.areaId);
      if (!current || current.projectId !== input.projectId) {
        throw new NotFoundException('Không tìm thấy khu vực trong dự án');
      }

      const nextName = name !== undefined ? name : current.name;
      const nextCode = code !== undefined ? code : current.code;
      const nextActive = input.isActive !== undefined ? input.isActive : current.isActive;
      const changed =
        nextName !== current.name || nextCode !== current.code || nextActive !== current.isActive;

      // Idempotent double-deactivate: tắt khu vực đã inactive (và không có
      // thay đổi hiệu lực nào khác) → no-op, không audit.
      if (!changed && input.isActive === false && !current.isActive) {
        result = { area: current, alreadyInactive: true };
        return;
      }
      if (!changed) {
        result = { area: current, alreadyInactive: false };
        return;
      }

      if (nextName.toLowerCase() !== current.name.toLowerCase()) {
        const dupName = await this.areaRepo.findActiveAreaByNameWithClient(
          client,
          input.projectId,
          nextName,
        );
        if (dupName && dupName.id !== current.id) throw duplicateName409();
      }
      if (nextCode !== null && nextCode !== current.code) {
        const dupCode = await this.areaRepo.findAreaByCodeWithClient(client, input.projectId, nextCode);
        if (dupCode && dupCode.id !== current.id) throw duplicateCode409();
      }

      const before = { ...current, projectCode };

      let updated: ProjectAreaRow | null;
      try {
        updated = await this.areaRepo.saveAreaWithClient(client, {
          id: current.id,
          code: nextCode,
          name: nextName,
          isActive: nextActive,
        });
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        if (/ux_project_areas_active_name_ci/i.test(constraint)) throw duplicateName409();
        if (/ux_project_areas_project_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }
      if (!updated) throw new NotFoundException('Không tìm thấy khu vực trong dự án');

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_AREA_UPDATED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: before,
          afterData: { ...updated, projectCode, ...(reason ? { reason } : {}) },
          reason,
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }

      result = { area: updated, alreadyInactive: false };
    });

    if (!result) throw new InternalServerErrorException('Không thể cập nhật khu vực dự án');
    return result;
  }
}
