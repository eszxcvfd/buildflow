import {
  Inject,
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { JOB_WORK_ORDER_REPOSITORY, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import { classifyCloseFailure } from '../../domain/service/work-order-job-board.policy';

export interface CloseJobBoardInput {
  workOrderId: string;
  expectedVersion?: number | null;
  reason?: string | null;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CloseJobBoardOutput {
  entity: WorkOrderEntity;
  workTypeName: string | null;
  hasActiveAssignment: boolean;
  /** True khi board đã đóng (không audit mới; pre-check không mở tx,
   * race-path commit tx rỗng — mirror open `alreadyOpen`). */
  alreadyClosed: boolean;
}

function fieldError(field: string, message: string, code: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, code, fieldErrors: { [field]: [message] } });
}

function versionConflict409(currentVersion: number): ConflictException {
  return new ConflictException({
    statusCode: 409,
    message: `Công việc đã bị thay đổi bởi người dùng khác (hiện tại version ${currentVersion}); vui lòng tải lại và thử lại`,
    code: 'WORK_ORDER_CONFLICT',
  });
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * JOB-SRS-004 (issue #44) — đóng Job Board.
 * - Board đã đóng → `200 alreadyClosed` (không tx, không audit).
 * - Guarded UPDATE: `job_board_open=false`, `OPEN→READY` (giữ lịch sử
 *   from/until, không xóa), `version+1`; KHÔNG đụng bảng `assignments`
 *   (AC3 — việc đã phân công không bị hủy).
 * - Audit `JOB_BOARD_CLOSED` tx-embedded (fail → 500 rollback) +
 *   state_history chỉ khi status đổi (OPEN→READY).
 */
@Injectable()
export class CloseWorkOrderJobBoardUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: CloseJobBoardInput): Promise<CloseJobBoardOutput> {
    const isAdmin = isAdminRole(input.actorRoles ?? []);
    const reason = this.normalizeReason(input.reason);
    const expectedVersion = this.normalizeExpectedVersion(input.expectedVersion);

    // 1. Load + scope (anti-leak mirror update).
    const current = await this.workOrderRepo.findById(input.workOrderId);
    if (!current) {
      if (!isAdmin) throw new ForbiddenException('Không có quyền truy cập dự án này');
      throw new NotFoundException('Không tìm thấy công việc');
    }
    await this.scope.assertProjectWriteScope({
      userId: input.actorUserId,
      actorRoles: input.actorRoles ?? [],
      projectId: current.projectId,
      correlationId: input.correlationId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });

    // 2. Idempotent replay — board đã đóng (không tx, không audit).
    if (!current.jobBoardOpen) {
      const workTypeName = await this.workOrderRepo.findWorkTypeNameById(current.workTypeId);
      const assigned = await this.hasAssignment(current.id);
      return { entity: current, workTypeName, hasActiveAssignment: assigned, alreadyClosed: true };
    }

    // 3. Optimistic lock pre-check fail-fast.
    if (expectedVersion !== null && current.version !== expectedVersion) {
      throw versionConflict409(current.version);
    }

    const toStatus: WorkOrderStatus = current.status === 'OPEN' ? 'READY' : current.status;
    const statusChanged = toStatus !== current.status;
    const now = new Date();
    const updated = WorkOrderEntity.fromPersistence({
      ...current.getProps(),
      jobBoardOpen: false,
      status: toStatus,
      version: current.version + 1,
      updatedAt: now,
    });

    let replayed: WorkOrderEntity | null = null;
    try {
      await this.tx.withTransaction(async (client: PoolClient) => {
        if (!this.workOrderRepo.updateJobBoardWithClient) {
          throw new InternalServerErrorException('Không thể đóng Job Board');
        }
        const affected = await this.workOrderRepo.updateJobBoardWithClient(client, {
          workOrderId: input.workOrderId,
          jobBoardOpen: false,
          jobBoardOpenFrom: current.jobBoardOpenFrom,
          jobBoardOpenUntil: current.jobBoardOpenUntil,
          toStatus,
          expectedVersion,
        });
        if (affected === 0) {
          // Race đóng đồng thời: row tươi đã đóng → replay (commit tx rỗng,
          // không audit mới — mirror open `alreadyOpen`).
          const fresh = await this.workOrderRepo.findById(input.workOrderId);
          const code = classifyCloseFailure({
            expectedVersion,
            currentVersion: fresh?.version ?? expectedVersion ?? 0,
            jobBoardOpen: fresh?.jobBoardOpen ?? false,
            status: fresh?.status ?? 'CANCELLED',
          });
          if (code === 'ALREADY_CLOSED' && fresh) {
            replayed = fresh;
            return;
          }
          throw await this.toRaceError(code, fresh?.status ?? 'CANCELLED', fresh?.version ?? 0);
        }

        const beforeData = {
          status: current.status,
          jobBoardOpen: current.jobBoardOpen,
          jobBoardOpenFrom: serializeValue(current.jobBoardOpenFrom),
          jobBoardOpenUntil: serializeValue(current.jobBoardOpenUntil),
          version: current.version,
        };
        const afterData = {
          status: toStatus,
          jobBoardOpen: false,
          jobBoardOpenFrom: serializeValue(current.jobBoardOpenFrom),
          jobBoardOpenUntil: serializeValue(current.jobBoardOpenUntil),
          version: current.version + 1,
        };
        try {
          if (!this.audit.logWithClient) {
            throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
          }
          await this.audit.logWithClient(client, {
            actorUserId: input.actorUserId,
            action: 'JOB_BOARD_CLOSED',
            entityType: 'WORK_ORDER',
            entityId: updated.id,
            beforeData,
            afterData,
            reason,
            result: 'SUCCESS',
            ipAddress: input.ipAddress ?? null,
            userAgent: input.userAgent ?? null,
            correlationId: input.correlationId ?? null,
          });
        } catch (e) {
          if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
          throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
        }

        if (statusChanged) {
          try {
            if (!this.workOrderRepo.insertStateHistoryWithClient) {
              throw new InternalServerErrorException('Không thể lưu lịch sử trạng thái');
            }
            await this.workOrderRepo.insertStateHistoryWithClient(client, {
              workOrderId: updated.id,
              fromStatus: current.status,
              toStatus,
              changedBy: input.actorUserId,
              reason,
              correlationId: input.correlationId ?? null,
            });
          } catch (e) {
            if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
            throw new InternalServerErrorException('Không thể lưu lịch sử trạng thái');
          }
        }
      });
    } catch (e) {
      if (
        e instanceof ConflictException ||
        e instanceof BadRequestException ||
        e instanceof InternalServerErrorException
      ) {
        throw e;
      }
      throw e;
    }

    if (replayed !== null) {
      const fresh: WorkOrderEntity = replayed;
      const replayWorkTypeName = await this.workOrderRepo.findWorkTypeNameById(fresh.workTypeId);
      const replayAssigned = await this.hasAssignment(fresh.id);
      return { entity: fresh, workTypeName: replayWorkTypeName, hasActiveAssignment: replayAssigned, alreadyClosed: true };
    }

    const workTypeName = await this.workOrderRepo.findWorkTypeNameById(updated.workTypeId);
    const assigned = await this.hasAssignment(updated.id);
    return { entity: updated, workTypeName, hasActiveAssignment: assigned, alreadyClosed: false };
  }

  /**
   * F001 — fail-closed: port method thiếu là lỗi wiring máy chủ → 500
   * (mirror guard `updateJobBoardWithClient`), KHÔNG fail-open `false`
   * (badge `ASSIGNED` rớt thành `CLOSED` khi đang có người nhận).
   */
  private async hasAssignment(workOrderId: string): Promise<boolean> {
    if (!this.workOrderRepo.hasActiveAssignmentByWorkOrderIds) {
      throw new InternalServerErrorException('Không thể kiểm tra phân công công việc');
    }
    const found = await this.workOrderRepo.hasActiveAssignmentByWorkOrderIds([workOrderId]);
    return found.has(workOrderId);
  }

  private async toRaceError(
    code: 'WORK_ORDER_CONFLICT' | 'ALREADY_CLOSED' | 'WORK_ORDER_STATUS_NOT_CLOSABLE',
    status: WorkOrderStatus,
    version: number,
  ): Promise<ConflictException | BadRequestException> {
    if (code === 'WORK_ORDER_STATUS_NOT_CLOSABLE') {
      return fieldError(
        'status',
        `Trạng thái ${status} không thể đóng Job Board`,
        'WORK_ORDER_STATUS_NOT_CLOSABLE',
      );
    }
    return versionConflict409(version);
  }

  private normalizeReason(reason: unknown): string | null {
    if (reason === undefined || reason === null) return null;
    if (typeof reason !== 'string') {
      throw fieldError('reason', 'Lý do phải là chuỗi ký tự', 'JOB_BOARD_REASON_TOO_LONG');
    }
    const trimmed = reason.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 500) {
      throw fieldError('reason', 'Lý do tối đa 500 ký tự', 'JOB_BOARD_REASON_TOO_LONG');
    }
    return trimmed;
  }

  private normalizeExpectedVersion(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw fieldError('expectedVersion', 'Phiên bản kỳ vọng phải là số nguyên lớn hơn 0', 'JOB_BOARD_VERSION_INVALID');
    }
    return value;
  }
}
