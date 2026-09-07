import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PRJ_PROJECT_REPOSITORY, ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectEntity } from '../../domain/entity/project.entity';
import {
  assertPlannedDates,
  normalizeProjectAddress,
  normalizeProjectDescription,
  normalizeProjectName,
  normalizeProjectTimezone,
} from '../../domain/service/project.policy';

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  description?: string | null;
  address?: string;
  timezone?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  managerId?: string;
  /** P3: `code` bất biến — có mặt trong body → 400 fieldErrors (explicit). */
  code?: string;
  /** P3: `status` thuộc lifecycle #33 — có mặt trong body → 400 fieldErrors. */
  status?: string;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateProjectOutput {
  entity: ProjectEntity;
  managerName: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * Map entity/policy invariant message về field tương ứng (cùng shape
 * fieldErrors như các validation khác). Đầu vào đã validate trước khi gọi
 * `updateDetails` nên nhánh này defensive-unreachable trong thực tế.
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
  return 'name';
}

/**
 * PRJ-SRS-001 (issue #32) — cập nhật dự án (last-write-wins, không
 * optimistic-locking ở slice này; xem ENDPOINTS.md §10 P6).
 * - `code`/`status` trong input → 400 fieldErrors (explicit, không silent-ignore).
 * - Update trong tx: `SELECT FOR UPDATE` row hiện tại, apply, save, audit
 *   `PRJ_PROJECT_UPDATED` với full before row vs after. Audit thất bại → 500 rollback.
 * - P9 asymmetry: đổi `managerId` KHÔNG đụng `project_members` (defer #36 PRJ-SRS-005).
 */
@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PRJ_PROJECT_REPOSITORY) private readonly projectRepo: ProjectRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: UpdateProjectInput): Promise<UpdateProjectOutput> {
    if (input.code !== undefined) {
      throw fieldError('code', 'Mã dự án không thể thay đổi');
    }
    if (input.status !== undefined) {
      throw fieldError('status', 'Trạng thái dự án chỉ đổi qua luồng lifecycle riêng');
    }

    const existing = await this.projectRepo.findById(input.projectId);
    if (!existing) throw new NotFoundException('Không tìm thấy dự án');

    if (input.name !== undefined) {
      try {
        normalizeProjectName(input.name);
      } catch (e) {
        throw fieldError('name', e instanceof Error ? e.message : 'Tên dự án không hợp lệ');
      }
    }
    if (input.description !== undefined) {
      try {
        normalizeProjectDescription(input.description);
      } catch (e) {
        throw fieldError('description', e instanceof Error ? e.message : 'Mô tả dự án không hợp lệ');
      }
    }
    if (input.address !== undefined) {
      try {
        normalizeProjectAddress(input.address);
      } catch (e) {
        throw fieldError('address', e instanceof Error ? e.message : 'Địa chỉ dự án không hợp lệ');
      }
    }
    if (input.timezone !== undefined) {
      try {
        normalizeProjectTimezone(input.timezone);
      } catch (e) {
        throw fieldError('timezone', e instanceof Error ? e.message : 'Múi giờ không hợp lệ');
      }
    }

    if (input.plannedStartDate !== undefined || input.plannedEndDate !== undefined) {
      const nextStart = input.plannedStartDate !== undefined ? input.plannedStartDate : existing.plannedStartDate;
      const nextEnd = input.plannedEndDate !== undefined ? input.plannedEndDate : existing.plannedEndDate;
      try {
        assertPlannedDates(nextStart, nextEnd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ngày kế hoạch không hợp lệ';
        throw fieldError(/kết thúc/i.test(msg) ? 'plannedEndDate' : 'plannedStartDate', msg);
      }
    }

    if (input.managerId !== undefined) {
      if (!UUID_RE.test(String(input.managerId))) {
        throw fieldError('managerId', 'Quản lý dự án không hợp lệ');
      }
      const manager = await this.userRepo.findById(String(input.managerId));
      if (!manager) throw fieldError('managerId', 'Quản lý dự án không tồn tại');
      if (manager.status !== 'ACTIVE') throw fieldError('managerId', 'Quản lý dự án phải đang hoạt động');
    }

    let result: UpdateProjectOutput | null = null;
    await this.tx.withTransaction(async (client: PoolClient) => {
      const current = await this.projectRepo.findForUpdateWithClient(client, input.projectId);
      if (!current) throw new NotFoundException('Không tìm thấy dự án');
      const before = { ...current.entity.toPublic(), managerName: current.managerName };

      try {
        current.entity.updateDetails(
          {
            name: input.name,
            description: input.description,
            address: input.address,
            timezone: input.timezone,
            plannedStartDate:
              input.plannedStartDate !== undefined ? String(input.plannedStartDate).trim() : undefined,
            plannedEndDate: input.plannedEndDate !== undefined ? String(input.plannedEndDate).trim() : undefined,
            managerId: input.managerId !== undefined ? String(input.managerId) : undefined,
          },
          new Date(),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
        throw fieldError(entityFieldFor(msg), msg);
      }

      await this.projectRepo.saveWithClient(client, current.entity);

      const managerName =
        input.managerId !== undefined && input.managerId !== before.managerId
          ? await this.projectRepo.findManagerNameWithClient(client, current.entity.managerId)
          : current.managerName;
      const after = { ...current.entity.toPublic(), managerName };

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'PRJ_PROJECT_UPDATED',
          entityType: 'PROJECT',
          entityId: input.projectId,
          beforeData: before,
          afterData: after,
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

      result = { entity: current.entity, managerName };
    });

    if (!result) throw new InternalServerErrorException('Không thể cập nhật dự án');
    return result;
  }
}
