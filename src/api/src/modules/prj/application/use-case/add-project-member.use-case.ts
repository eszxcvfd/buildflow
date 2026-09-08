import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { normalizeProjectMemberRole, AddableProjectMemberRole } from '../../domain/service/project-member.policy';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';

export interface AddProjectMemberInput {
  projectId: string;
  userId: string;
  /** Role thô từ transport (`COORDINATOR`|`QC`|`WORKER`|`VIEWER`; `MANAGER` → 400). */
  projectRole: string;
  actorUserId: string;
  /** Roles server-derived từ JWT (write-scope: ADMIN bypass hoặc member MANAGER/COORDINATOR). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface AddProjectMemberOutput {
  member: ProjectMemberRow;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function coded409(code: string, message: string): ConflictException {
  return new ConflictException({ statusCode: 409, message, code });
}

/**
 * PRJ-SRS-005 (issue #36, M1/M3/M5/M6) — thêm thành viên vào dự án
 * (mirror `AddCrewMemberUseCase` #30).
 * - Project phải tồn tại (404). User phải tồn tại + `status='ACTIVE'`
 *   (cả hai → 400 fieldErrors `{userId}` — khác crews #30 dùng 404/409).
 * - `projectRole` chỉ `COORDINATOR`|`QC`|`WORKER`|`VIEWER`; `MANAGER` → 400
 *   fieldErrors `{projectRole}` ('Quản lý dự án chỉ đặt qua PATCH ... managerId').
 * - Trùng ACTIVE membership cùng project → 409 `MEMBER_DUPLICATE`
 *   (pre-check + race guard 23505/`ux_project_members_active`,
 *   constraint-order trước generic).
 * - Tx với `FOR UPDATE` trên project row (mirror status use-case #33).
 * - Closed project vẫn cho add (M5 — document, không check status).
 * - Audit `PRJ_PROJECT_MEMBER_ADDED` (`entityType` `PROJECT`, `entityId`=projectId,
 *   tx-embedded, before null / after member row + `projectCode`); audit fail → 500 rollback.
 */
@Injectable()
export class AddProjectMemberUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: AddProjectMemberInput): Promise<AddProjectMemberOutput> {
    // PRJ-SRS-006 (issue #37): write-scope TRƯỚC mọi 404/validation nghiệp vụ
    // (anti-leak: non-member luôn 403 bất kể project tồn tại hay không).
    const { isAdminBypass } = await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId: input.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    if (!input.userId || !UUID_RE.test(String(input.userId))) {
      throw fieldError('userId', 'Người dùng không hợp lệ');
    }
    const userId = String(input.userId);

    let projectRole: AddableProjectMemberRole;
    try {
      projectRole = normalizeProjectMemberRole(input.projectRole);
    } catch (e) {
      throw fieldError('projectRole', e instanceof Error ? e.message : 'Vai trò thành viên không hợp lệ');
    }

    const project = await this.projectRepo.findById(input.projectId);
    if (!project) throw new NotFoundException('Không tìm thấy dự án');

    const user = await this.userRepo.findById(userId);
    if (!user) throw fieldError('userId', 'Người dùng không tồn tại');
    if (user.status !== 'ACTIVE') throw fieldError('userId', 'Người dùng phải đang hoạt động');

    const projectCode = project.code;
    let member: ProjectMemberRow | null = null;

    await this.tx.withTransaction(async (client: PoolClient) => {
      // M6: lock project row trong tx ngay trước insert (mirror status use-case).
      const locked = await this.projectRepo.findForUpdateWithClient(client, input.projectId);
      if (!locked) throw new NotFoundException('Không tìm thấy dự án');

      // PRJ-SRS-006: re-check membership TRONG cùng tx (revoke commit giữa
      // outer check và mutation → 403 ở đây → rollback, không partial-write).
      const actorMembership = await this.projectRepo.findActiveMemberWithClient(
        client,
        input.projectId,
        input.actorUserId,
      );
      this.scope.assertWriteScopeTxCheck(isAdminBypass, actorMembership?.projectRole ?? null);

      const dup = await this.projectRepo.findActiveMemberWithClient(client, input.projectId, userId);
      if (dup) {
        throw coded409('MEMBER_DUPLICATE', 'Thành viên đã thuộc dự án');
      }

      try {
        member = await this.projectRepo.insertMemberWithClient(client, {
          projectId: input.projectId,
          userId,
          projectRole,
          addedBy: input.actorUserId,
        });
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const code = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        // Constraint-order: check cụ thể trước generic 23505 (mirror #30).
        if (/ux_project_members_active/i.test(constraint)) {
          throw coded409('MEMBER_DUPLICATE', 'Thành viên đã thuộc dự án');
        }
        if (code === '23505') {
          throw coded409('MEMBER_DUPLICATE', 'Thành viên đã thuộc dự án');
        }
        throw e;
      }

      try {
        const inserted: ProjectMemberRow = member as ProjectMemberRow;
        const payload: Record<string, unknown> = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_MEMBER_ADDED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: null,
          afterData: { ...inserted, projectCode },
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        // Fail closed — tx audit bắt buộc logWithClient (mirror #30 fix F6).
        if (!this.audit.logWithClient) {
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }
        await this.audit.logWithClient(client, payload as never);
      } catch {
        // Mọi lỗi từ audit block đều → 500 rollback (mirror #30 fix F3).
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    if (!member) throw new InternalServerErrorException('Không thể thêm thành viên dự án');
    return { member };
  }
}
