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
import { normalizeProjectAreaCode, normalizeProjectAreaName } from '../../domain/service/project-area.policy';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { assertProjectAreaScope } from './project-area-scope';

export interface CreateProjectAreaInput {
  projectId: string;
  code?: string | null;
  name: string;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope — xem A4). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateProjectAreaOutput {
  area: ProjectAreaRow;
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
 * PRJ-SRS-003 (issue #34, A1/A3/A4/A6) — tạo khu vực trong dự án.
 * - Project phải tồn tại (404). Scope A4: ADMIN bypass, còn lại phải là
 *   ACTIVE member (403) — kể cả PROJECT_MANAGER.
 * - Trùng tên active cùng project → 409 `AREA_DUPLICATE` (pre-check
 *   case-insensitive + race guard 23505/`ux_project_areas_active_name_ci`
 *   (0006, DB-enforced case-insensitive),
 *   constraint-cụ-thể-trước; **bare 23505 rethrow** — không swallow).
 * - Trùng mã (mọi trạng thái — index không partial) → 409 `AREA_CODE_DUPLICATE`.
 * - Closed project vẫn cho tạo (A5 — precedent M5, không check status).
 * - Audit `PRJ_PROJECT_AREA_ADDED` (`entityType` `PROJECT`, `entityId`=projectId,
 *   tx-embedded `logWithClient`, before null / after area row + `projectCode`);
 *   audit fail → 500 rollback (catch-all).
 * - PRJ-SRS-006 (issue #37): scope A4 qua `ProjectScopeService`
 *   (API chung — xem `project-area-scope.ts`); ADMIN bypass trên write này
 *   được audit; re-check membership trong cùng tx sau lock.
 */
@Injectable()
export class CreateProjectAreaUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(PRJ_PROJECT_AREA_REPOSITORY) private readonly areaRepo: ProjectAreaRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: CreateProjectAreaInput): Promise<CreateProjectAreaOutput> {
    let name: string;
    try {
      name = normalizeProjectAreaName(input.name);
    } catch (e) {
      throw fieldError('name', e instanceof Error ? e.message : 'Tên khu vực không hợp lệ');
    }

    let code: string | null;
    try {
      code = normalizeProjectAreaCode(input.code);
    } catch (e) {
      throw fieldError('code', e instanceof Error ? e.message : 'Mã khu vực không hợp lệ');
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');
    const { isAdminBypass } = await assertProjectAreaScope(this.scope, {
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      actorRoles: input.actorRoles,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    const projectCode = project.code;
    let area: ProjectAreaRow | null = null;

    await this.tx.withTransaction(async (client: PoolClient) => {
      const locked = await this.projectRepo.findForUpdateWithClient(client, input.projectId);
      if (!locked) throw new NotFoundException('Không tìm thấy dự án');

      // PRJ-SRS-006: re-check membership TRONG cùng tx sau lock.
      const actorMembership = await this.projectRepo.findActiveMemberWithClient(
        client,
        input.projectId,
        input.actorUserId,
      );
      this.scope.assertMemberScopeTxCheck(isAdminBypass, actorMembership?.projectRole ?? null);

      const dupName = await this.areaRepo.findActiveAreaByNameWithClient(client, input.projectId, name);
      if (dupName) throw duplicateName409();
      if (code !== null) {
        const dupCode = await this.areaRepo.findAreaByCodeWithClient(client, input.projectId, code);
        if (dupCode) throw duplicateCode409();
      }

      try {
        area = await this.areaRepo.insertAreaWithClient(client, {
          projectId: input.projectId,
          code,
          name,
        });
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const constraint = String(err['constraint'] ?? '');
        // Constraint-order: tên cụ thể trước; bare 23505 KHÔNG swallow → rethrow (500).
        if (/ux_project_areas_active_name_ci/i.test(constraint)) throw duplicateName409();
        if (/ux_project_areas_project_code/i.test(constraint)) throw duplicateCode409();
        throw e;
      }

      try {
        const inserted: ProjectAreaRow = area as ProjectAreaRow;
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_AREA_ADDED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: null,
          afterData: { ...inserted, projectCode },
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
    });

    if (!area) throw new InternalServerErrorException('Không thể tạo khu vực dự án');
    return { area };
  }
}
