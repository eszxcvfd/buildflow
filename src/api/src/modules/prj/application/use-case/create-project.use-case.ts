import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectEntity } from '../../domain/entity/project.entity';
import {
  assertPlannedDates,
  normalizeProjectAddress,
  normalizeProjectCode,
  normalizeProjectDescription,
  normalizeProjectName,
  normalizeProjectTimezone,
} from '../../domain/service/project.policy';

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string | null;
  address: string;
  timezone?: string | null;
  plannedStartDate: string;
  plannedEndDate: string;
  managerId: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateProjectOutput {
  entity: ProjectEntity;
  managerName: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * Map entity/policy invariant message về field tương ứng (cùng shape
 * fieldErrors như các validation khác). Đầu vào đã validate trước khi dựng
 * entity nên nhánh này defensive-unreachable trong thực tế.
 */
function entityFieldFor(msg: string): string {
  if (/Mã dự án/.test(msg)) return 'code';
  if (/Tên dự án/.test(msg)) return 'name';
  if (/Địa chỉ/.test(msg)) return 'address';
  if (/Mô tả/.test(msg)) return 'description';
  if (/Múi giờ/.test(msg)) return 'timezone';
  if (/kết thúc/i.test(msg)) return 'plannedEndDate';
  if (/Ngày bắt đầu|Ngày kế hoạch/.test(msg)) return 'plannedStartDate';
  if (/Quản lý/.test(msg)) return 'managerId';
  if (/Người tạo/.test(msg)) return 'actorUserId';
  if (/Trạng thái/.test(msg)) return 'status';
  if (/ID dự án/.test(msg)) return 'projectId';
  return 'name';
}

function duplicate409(): ConflictException {
  return new ConflictException({ statusCode: 409, message: 'Mã dự án đã tồn tại', code: 'PROJECT_CODE_DUPLICATE' });
}

/**
 * PRJ-SRS-001 (issue #32) — tạo dự án.
 * - `status` luôn `DRAFT` (client không set được; DTO whitelist).
 * - `managerId` phải là user tồn tại + `status='ACTIVE'`, ngược lại 400 fieldErrors.
 * - Trùng `code` (pre-check case-insensitive + race guard 23505/`ux_projects_code`
 *   theo thứ tự constraint-cụ-thể-trước) → 409 `PROJECT_CODE_DUPLICATE`.
 * - Audit `PRJ_PROJECT_CREATED` tx-embedded; audit thất bại → 500 rollback.
 * - P9: manager auto-added làm ACTIVE member (`project_role='MANAGER'`) trong
 *   CÙNG tx (manager hiển nhiên là thành viên dự án; unlock iam project-scope
 *   visibility cho manager). Đối xứng UPDATE: đổi `managerId` cũng auto-insert
 *   membership MANAGER trong cùng tx (P11/M4, issue #36 PRJ-SRS-005).
 */
@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateProjectInput): Promise<CreateProjectOutput> {
    let code: string;
    try {
      code = normalizeProjectCode(input.code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mã dự án không hợp lệ';
      throw fieldError('code', msg);
    }

    let name: string;
    try {
      name = normalizeProjectName(input.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tên dự án không hợp lệ';
      throw fieldError('name', msg);
    }

    let address: string;
    try {
      address = normalizeProjectAddress(input.address);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Địa chỉ dự án không hợp lệ';
      throw fieldError('address', msg);
    }

    let description: string | null;
    try {
      description = normalizeProjectDescription(input.description);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mô tả dự án không hợp lệ';
      throw fieldError('description', msg);
    }

    let timezone: string;
    try {
      timezone = normalizeProjectTimezone(input.timezone);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Múi giờ không hợp lệ';
      throw fieldError('timezone', msg);
    }

    try {
      assertPlannedDates(input.plannedStartDate, input.plannedEndDate);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ngày kế hoạch không hợp lệ';
      throw fieldError(/kết thúc/i.test(msg) ? 'plannedEndDate' : 'plannedStartDate', msg);
    }

    // Validation thuần (sync, không I/O) chạy TRƯỚC mọi DB read (P4: 400
    // fieldErrors BEFORE DB). Pre-check trùng mã case-insensitive sau đó
    // (chặt hơn DB btree case-sensitive).
    const byCode = await this.projectRepo.findByCode(code);
    if (byCode) throw duplicate409();

    if (!input.managerId || !UUID_RE.test(String(input.managerId))) {
      throw fieldError('managerId', 'Quản lý dự án không hợp lệ');
    }
    const manager = await this.userRepo.findById(String(input.managerId));
    if (!manager) throw fieldError('managerId', 'Quản lý dự án không tồn tại');
    if (manager.status !== 'ACTIVE') throw fieldError('managerId', 'Quản lý dự án phải đang hoạt động');

    const now = new Date();
    const id = randomUUID();

    let entity: ProjectEntity;
    try {
      entity = new ProjectEntity({
        id,
        code,
        name,
        description,
        address,
        timezone,
        plannedStartDate: String(input.plannedStartDate).trim(),
        plannedEndDate: String(input.plannedEndDate).trim(),
        managerId: String(input.managerId),
        status: 'DRAFT',
        createdBy: input.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw fieldError(entityFieldFor(msg), msg);
    }

    let managerName: string | null = null;
    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        await this.projectRepo.createWithClient(client, entity);
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        const err = e as Record<string, unknown>;
        const dbCode = String(err['code'] ?? '');
        const constraint = String(err['constraint'] ?? '');
        // Constraint cụ thể trước, generic 23505 sau (rule #29/#30):
        // mọi 23505 ở đây đều là race trùng mã (id là randomUUID).
        if (/ux_projects_code/i.test(constraint)) throw duplicate409();
        if (dbCode === '23505') throw duplicate409();
        throw e;
      }

      managerName = await this.projectRepo.findManagerNameWithClient(client, entity.managerId);

      // P9: manager hiển nhiên là thành viên dự án — insert cùng tx (project_id
      // mới nên 23505 ux_project_members_active không thể xảy ra).
      await this.projectRepo.insertManagerMembershipWithClient(client, {
        projectId: id,
        userId: entity.managerId,
        addedBy: input.actorUserId,
      });

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_CREATED',
          entityType: 'PROJECT',
          entityId: id,
          afterData: { ...entity.toPublic(), managerName },
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (this.audit.logWithClient) await this.audit.logWithClient(client, payload);
        else await this.audit.log(payload);
      } catch (e) {
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity, managerName };
  }
}
