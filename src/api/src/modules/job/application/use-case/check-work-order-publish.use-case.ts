import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  JOB_PUBLISH_CHECK_READ_PORT,
  WorkOrderPublishCheckReadPort,
} from '../../domain/repository/work-order-publish-check.read-port';
import {
  PublishCheckUnmet,
  evaluatePublishReadiness,
} from '../../domain/service/work-order-publish-check.policy';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';

export interface CheckWorkOrderPublishInput {
  workOrderId: string;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CheckWorkOrderPublishOutput {
  workOrderId: string;
  status: string;
  ready: boolean;
  unmet: PublishCheckUnmet[];
  checkedAt: Date;
}

/**
 * JOB-SRS-002 (issue #42) — kiểm tra điều kiện công bố (advisory, read-only).
 * - Scope như `GET :id` (mirror `GetWorkOrderUseCase`): non-ADMIN snapshot
 *   missing → 403 generic (không leak); ADMIN missing → 404; member bất kỳ
 *   role nào của project chứa WO đều check được.
 * - KHÔNG mutate, KHÔNG audit nghiệp vụ (check-only — GET không audit trong
 *   repo; xem ENDPOINTS.md §17 J6). Scope service vẫn audit ADMIN bypass /
 *   denied theo behavior chung của nó (giống `GET :id`).
 */
@Injectable()
export class CheckWorkOrderPublishUseCase {
  constructor(
    @Inject(JOB_PUBLISH_CHECK_READ_PORT) private readonly read: WorkOrderPublishCheckReadPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: CheckWorkOrderPublishInput): Promise<CheckWorkOrderPublishOutput> {
    const actorRoles = input.actorRoles ?? [];
    const snapshot = await this.read.fetchSnapshot(input.workOrderId);
    if (!snapshot) {
      if (isAdminRole(actorRoles)) {
        throw new NotFoundException('Không tìm thấy công việc');
      }
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    }
    await this.scope.assertProjectMemberScope({
      userId: input.actorUserId,
      actorRoles,
      projectId: snapshot.workOrder.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
    const { ready, unmet } = evaluatePublishReadiness(snapshot);
    return {
      workOrderId: snapshot.workOrder.id,
      status: snapshot.workOrder.status,
      ready,
      unmet,
      checkedAt: new Date(),
    };
  }
}
