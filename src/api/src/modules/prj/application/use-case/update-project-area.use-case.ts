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
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
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
  /** Số WO mở đang tham chiếu (chỉ tính khi retire — forward-ref JOB). */
  usage?: { workOrders: number };
  /** Cảnh báo phạm vi áp dụng khi retire khu vực đang bị WO mở tham chiếu. */
  warning?: string;
}

export const AREA_IN_USE_WARNING =
  'Khu vực đang được tham chiếu bởi Work Order đang hiệu lực';

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
 * - PRJ-SRS-007 (issue #38) — vòng đời dữ liệu nền (mirror work-types #35):
 *   retire (active→inactive) đếm WO mở qua `countOpenWorkOrders` (forward-ref
 *   JOB, hôm nay = 0); `usage > 0` → kèm `warning` phạm vi áp dụng + `_warning`
 *   trong audit afterData (KHÔNG chặn transition). Count thất bại → lỗi lan ra
 *   (500), không transition thiếu cảnh báo. Mọi transition `isActive` (cả hai
 *   chiều) ghi thêm audit `PRJ_AREA_STATUS_CHANGED` tx-embedded fail-closed
 *   (actor/before/after/reason — `reason` reuse từ PATCH DTO, đã có sẵn).
 */
@Injectable()
export class UpdateProjectAreaUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(PRJ_PROJECT_AREA_REPOSITORY) private readonly areaRepo: ProjectAreaRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
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

    // PRJ-SRS-006 review P1-1: scope TRƯỚC mọi existence 404 (anti
    // existence-oracle: non-admin luôn 403 kể cả project/area không tồn tại —
    // non-member không bao giờ tới được area lookup; ADMIN được
    // `assertProjectMemberScope` check exists() trước → missing vẫn 404, sau đó
    // admin exists-checks bên dưới vẫn giữ).
    const { isAdminBypass } = await assertProjectAreaScope(this.scope, {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const existing = await this.areaRepo.findAreaById(input.areaId);
    if (!existing || existing.projectId !== input.projectId) {
      throw new NotFoundException('Không tìm thấy khu vực trong dự án');
    }

    const projectCode = project.code;

    // PRJ-SRS-007 (#38): retire (active→inactive) đếm WO mở TRƯỚC tx để gắn
    // cảnh báo phạm vi áp dụng (mirror work-types DEACTIVATE — count fail →
    // 500, không transition thiếu cảnh báo). Pure rename/reactivate không đếm.
    // Lưu ý: pre-check ngoài tx, trong tx vẫn giữ FOR UPDATE + re-check scope.
    let usage: { workOrders: number } | undefined;
    let usageWarning = false;
    if (input.isActive === false && existing.isActive) {
      const openWorkOrders = await this.areaRepo.countOpenWorkOrders(input.areaId);
      usage = { workOrders: openWorkOrders };
      usageWarning = openWorkOrders > 0;
    }

    let result: UpdateProjectAreaOutput | null = null;

    await this.tx.withTransaction(async (client: PoolClient) => {
      const current = await this.areaRepo.findAreaForUpdateWithClient(client, input.areaId);
      if (!current || current.projectId !== input.projectId) {
        throw new NotFoundException('Không tìm thấy khu vực trong dự án');
      }

      // PRJ-SRS-006: re-check membership TRONG cùng tx sau lock (revoke
      // mid-flight → 403 → rollback, không partial-write).
      const actorMembership = await this.projectRepo.findActiveMemberWithClient(
        client,
        input.projectId,
        input.actorUserId,
      );
      this.scope.assertMemberScopeTxCheck(isAdminBypass, actorMembership?.projectRole ?? null);

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
      const statusTransition = nextActive !== current.isActive;

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

      const afterData = { ...updated, projectCode, ...(reason ? { reason } : {}) } as Record<string, unknown>;
      if (usageWarning) afterData['_warning'] = AREA_IN_USE_WARNING;

      try {
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_AREA_UPDATED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: before,
          afterData,
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

      // PRJ-SRS-007 (#38): transition isActive (cả hai chiều) ghi thêm audit
      // `PRJ_AREA_STATUS_CHANGED` tx-embedded fail-closed (mirror
      // `PRJ_WORK_TYPE_STATUS_CHANGED` — actor/before/after/reason; `_warning`
      // khi retire đang bị WO mở tham chiếu). alreadyInactive giữ nguyên
      // (không audit — nhánh no-op ở trên).
      if (statusTransition) {
        try {
          const statusPayload: Record<string, unknown> = {
            actorUserId: input.actorUserId,
            action: 'PRJ_AREA_STATUS_CHANGED',
            entityType: 'PROJECT',
            entityId: input.projectId,
            beforeData: before,
            afterData,
            reason,
            result: 'SUCCESS' as const,
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            correlationId: input.correlationId ?? null,
          };
          if (!this.audit.logWithClient) {
            throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
          }
          await this.audit.logWithClient(client, statusPayload as never);
        } catch {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
      }

      result = {
        area: updated,
        alreadyInactive: false,
        ...(usage ? { usage } : {}),
        ...(usageWarning ? { warning: AREA_IN_USE_WARNING } : {}),
      };
    });

    if (!result) throw new InternalServerErrorException('Không thể cập nhật khu vực dự án');
    return result;
  }
}
