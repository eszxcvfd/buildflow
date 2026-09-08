import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';

export interface GetWorkOrderInput {
  workOrderId: string;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface GetWorkOrderOutput {
  entity: WorkOrderEntity;
  /** Tên loại công việc cho response summary (`workTypeName?`). */
  workTypeName: string | null;
}

/**
 * JOB-SRS-001 (issue #41) — chi tiết Work Order (read scope).
 * - ADMIN bypass (audited qua scope service); project missing → 404.
 * - Mọi ACTIVE member của project chứa WO đều đọc được (kể cả WORKER —
 *   xem được nháp của project mình).
 * - Anti-leak: non-ADMIN luôn 403 generic (kể cả id không tồn tại — không
 *   phân biệt 404/403). Read-only: không tx, không audit nghiệp vụ.
 */
@Injectable()
export class GetWorkOrderUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: GetWorkOrderInput): Promise<GetWorkOrderOutput> {
    const actorRoles = input.actorRoles ?? [];
    if (!isAdminRole(actorRoles)) {
      const entity = await this.workOrderRepo.findById(input.workOrderId);
      if (!entity) {
        throw new ForbiddenException('Không có quyền truy cập dự án này');
      }
      await this.scope.assertProjectMemberScope({
        userId: input.actorUserId,
        actorRoles,
        projectId: entity.projectId,
        correlationId: input.correlationId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      const workTypeName = await this.workOrderRepo.findWorkTypeNameById(entity.workTypeId);
      return { entity, workTypeName };
    }

    const entity = await this.workOrderRepo.findById(input.workOrderId);
    if (!entity) throw new NotFoundException('Không tìm thấy công việc');
    await this.scope.assertProjectMemberScope({
      userId: input.actorUserId,
      actorRoles,
      projectId: entity.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const workTypeName = await this.workOrderRepo.findWorkTypeNameById(entity.workTypeId);
    return { entity, workTypeName };
  }
}
