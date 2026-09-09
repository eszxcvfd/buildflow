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
import {
  JOB_PUBLISH_CHECK_READ_PORT,
  WorkOrderPublishCheckReadPort,
} from '../../domain/repository/work-order-publish-check.read-port';
import { AUDIT_PORT, AuditPort } from '../../../iam/application/port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { isAdminRole } from '../../../iam/domain/service/project-scope.policy';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';
import {
  JobBoardWindowError,
  classifyOpenFailure,
  isOpenableStatus,
  isSameJobBoardWindow,
  validateJobBoardWindow,
} from '../../domain/service/work-order-job-board.policy';
import { evaluatePublishReadiness } from '../../domain/service/work-order-publish-check.policy';

export interface OpenJobBoardInput {
  workOrderId: string;
  jobBoardOpenFrom?: unknown;
  jobBoardOpenUntil?: unknown;
  expectedVersion?: number | null;
  reason?: string | null;
  actorUserId: string;
  /** Roles server-derived từ JWT (ADMIN bypass scope + nhánh ngoại lệ). */
  actorRoles?: string[];
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface OpenJobBoardOutput {
  entity: WorkOrderEntity;
  workTypeName: string | null;
  hasActiveAssignment: boolean;
  /** True khi replay cùng window (không audit mới; pre-check không mở tx,
   * race-path commit tx rỗng — AC7). */
  alreadyOpen: boolean;
}

function window400(e: JobBoardWindowError): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message: e.message,
    code: 'JOB_BOARD_WINDOW_INVALID',
    fieldErrors: { [e.field]: [e.message] },
  });
}

function fieldError(field: string, message: string, code: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, code, fieldErrors: { [field]: [message] } });
}

function alreadyOpen409(): ConflictException {
  const message = 'Job Board đang mở với cửa sổ khác; đóng Job Board trước khi mở lại';
  return new ConflictException({ statusCode: 409, message, code: 'JOB_BOARD_ALREADY_OPEN' });
}

function hasAssignee409(): ConflictException {
  const message = 'Công việc đã có người nhận, không thể mở Job Board';
  return new ConflictException({ statusCode: 409, message, code: 'JOB_BOARD_HAS_ASSIGNEE' });
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
 * Ruling F003: request open KHÔNG gửi `jobBoardOpenFrom` (server default
 * now) là replay intent — không thể phân biệt "muốn mở với now" với
 * "gửi lại", nên khi board đang mở luôn replay `alreadyOpen`.
 */
function isFromAbsent(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  return false;
}

/**
 * JOB-SRS-004 (issue #44) — mở Job Board.
 * Thứ tự gate deterministic (§1.2, khớp ENDPOINTS §19): normalize
 * window/reason/version thuần (không I/O, trước scope) → load + scope
 * (anti-leak) → pre-check board (replay/window-khác; không from → replay
 * intent F003) → pre-check assignment → pre-check status → readiness
 * re-check tại thời điểm ghi (DRAFT/READY full catalog; OPEN re-open lọc
 * `INVALID_STATUS_FOR_PUBLISH`) → guarded UPDATE (flag+status+version+NOT
 * EXISTS trong WHERE) → audit `JOB_BOARD_OPENED` tx-embedded +
 * state_history chỉ khi status đổi.
 */
@Injectable()
export class OpenWorkOrderJobBoardUseCase {
  constructor(
    @Inject(JOB_WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepositoryPort,
    @Inject(JOB_PUBLISH_CHECK_READ_PORT) private readonly publishCheckRead: WorkOrderPublishCheckReadPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
    private readonly scope: ProjectScopeService,
  ) {}

  async execute(input: OpenJobBoardInput): Promise<OpenJobBoardOutput> {
    const isAdmin = isAdminRole(input.actorRoles ?? []);

    // 1. Normalize thuần (không I/O).
    let window: { from: Date; until: Date | null };
    try {
      window = validateJobBoardWindow({
        jobBoardOpenFrom: input.jobBoardOpenFrom,
        jobBoardOpenUntil: input.jobBoardOpenUntil,
      });
    } catch (e) {
      if (e instanceof JobBoardWindowError) throw window400(e);
      throw e;
    }
    const reason = this.normalizeReason(input.reason);
    const expectedVersion = this.normalizeExpectedVersion(input.expectedVersion);

    // 2. Load + scope (anti-leak mirror update: non-ADMIN 403 kể cả missing).
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

    // 3. Pre-check board (đi trước readiness để replay/409 không bị chặn nhầm).
    // Ruling F003/F023/F024: request không gửi `jobBoardOpenFrom` (server
    // default now) + board đang mở → replay intent → `200 alreadyOpen` kèm
    // window hiện tại (KHÔNG 409; `until` khác trong request bị bỏ qua —
    // until-only update KHÔNG hỗ trợ). Đường explicit so window FULL-MS
    // (`isSameJobBoardWindow` — ruling F016; DB timestamptz giữ µs). Pre-check
    // replay thắng kể cả version stale (idempotency-wins F024).
    if (current.jobBoardOpen) {
      if (
        isFromAbsent(input.jobBoardOpenFrom) ||
        isSameJobBoardWindow(
          { from: current.jobBoardOpenFrom, until: current.jobBoardOpenUntil },
          window,
        )
      ) {
        const workTypeName = await this.workOrderRepo.findWorkTypeNameById(current.workTypeId);
        const assigned = await this.hasAssignment(current.id);
        return { entity: current, workTypeName, hasActiveAssignment: assigned, alreadyOpen: true };
      }
      throw alreadyOpen409();
    }

    // 4. Pre-check assignment.
    if (await this.hasAssignment(current.id)) {
      throw hasAssignee409();
    }

    // 5. Pre-check status.
    if (!isOpenableStatus(current.status)) {
      throw fieldError(
        'status',
        `Trạng thái ${current.status} không thể mở Job Board; chỉ Work Order DRAFT, READY hoặc OPEN (mở lại) được mở`,
        'WORK_ORDER_STATUS_NOT_OPENABLE',
      );
    }

    // 6. Optimistic lock pre-check fail-fast.
    if (expectedVersion !== null && current.version !== expectedVersion) {
      throw versionConflict409(current.version);
    }

    // 7. Readiness re-check tại thời điểm ghi (J6). Re-open (OPEN) lọc
    // `INVALID_STATUS_FOR_PUBLISH`; các điều kiện dự án/lịch/skill/field vẫn
    // bắt buộc. `ALREADY_ON_JOB_BOARD` luôn lọc: pre-check board đã xử lý
    // xong case không race (replay/409 ở bước 3), còn cửa sổ race (board bị
    // request song song mở giữa pre-check và re-check — AC4 real-DB) thì
    // guarded UPDATE + classify mới là trọng tài nguyên tử (loser → replay
    // `alreadyOpen`, không 400 nhầm). `INVALID_STATUS_FOR_PUBLISH` lọc khi
    // status hiện tại HOẶC snapshot tươi là OPEN (re-open cho phép OPEN).
    const snapshot = await this.publishCheckRead.fetchSnapshot(input.workOrderId);
    if (snapshot) {
      const { unmet } = evaluatePublishReadiness(snapshot);
      const openNow = current.status === 'OPEN' || snapshot.workOrder.status === 'OPEN';
      const effective = unmet.filter(
        (u) => u.code !== 'ALREADY_ON_JOB_BOARD' && (openNow ? u.code !== 'INVALID_STATUS_FOR_PUBLISH' : true),
      );
      if (effective.length > 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Công việc chưa đủ điều kiện công bố lên Job Board',
          code: 'WORK_ORDER_NOT_PUBLISHABLE',
          unmet: effective,
        });
      }
    }

    // 8. Guarded UPDATE + audit/state_history trong tx.
    const now = new Date();
    const updated = WorkOrderEntity.fromPersistence({
      ...current.getProps(),
      jobBoardOpen: true,
      jobBoardOpenFrom: window.from,
      jobBoardOpenUntil: window.until,
      status: 'OPEN',
      version: current.version + 1,
      updatedAt: now,
    });
    const statusChanged = current.status !== 'OPEN';

    let replayed: WorkOrderEntity | null = null;
    try {
      await this.tx.withTransaction(async (client: PoolClient) => {
        if (!this.workOrderRepo.updateJobBoardWithClient) {
          throw new InternalServerErrorException('Không thể mở Job Board');
        }
        const affected = await this.workOrderRepo.updateJobBoardWithClient(client, {
          workOrderId: input.workOrderId,
          jobBoardOpen: true,
          jobBoardOpenFrom: window.from,
          jobBoardOpenUntil: window.until,
          toStatus: 'OPEN',
          expectedVersion,
        });
        if (affected === 0) {
          // Ruling F024 (idempotency-wins) + F015/F022: race-path ưu tiên
          // replay khi row tươi `jobBoardOpen=true` và window match (hoặc
          // request không gửi `from` = replay intent) TRƯỚC khi check version
          // conflict. Guarded UPDATE vẫn là trọng tài nguyên tử cho
          // assignment/status (classify sau replay-check).
          const fresh = await this.workOrderRepo.findById(input.workOrderId);
          if (
            fresh?.jobBoardOpen === true &&
            (isFromAbsent(input.jobBoardOpenFrom) ||
              isSameJobBoardWindow(
                { from: fresh.jobBoardOpenFrom, until: fresh.jobBoardOpenUntil },
                window,
              ))
          ) {
            replayed = fresh;
            return;
          }
          const assigned = await this.hasAssignment(input.workOrderId);
          const code = classifyOpenFailure({
            expectedVersion,
            currentVersion: fresh?.version ?? expectedVersion ?? 0,
            jobBoardOpen: fresh?.jobBoardOpen ?? false,
            status: fresh?.status ?? 'CANCELLED',
            hasActiveAssignment: assigned,
          });
          throw this.toRaceError(code, fresh?.status ?? 'CANCELLED', fresh?.version ?? 0);
        }

        const beforeData = {
          status: current.status,
          jobBoardOpen: current.jobBoardOpen,
          jobBoardOpenFrom: serializeValue(current.jobBoardOpenFrom),
          jobBoardOpenUntil: serializeValue(current.jobBoardOpenUntil),
          version: current.version,
        };
        const afterData = {
          status: 'OPEN',
          jobBoardOpen: true,
          jobBoardOpenFrom: serializeValue(window.from),
          jobBoardOpenUntil: serializeValue(window.until),
          version: current.version + 1,
        };
        try {
          if (!this.audit.logWithClient) {
            throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
          }
          await this.audit.logWithClient(client, {
            actorUserId: input.actorUserId,
            action: 'JOB_BOARD_OPENED',
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
              toStatus: 'OPEN',
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

    const workTypeName = await this.workOrderRepo.findWorkTypeNameById(updated.workTypeId);
    if (replayed !== null) {
      const fresh: WorkOrderEntity = replayed;
      const replayWorkTypeName = await this.workOrderRepo.findWorkTypeNameById(fresh.workTypeId);
      const replayAssigned = await this.hasAssignment(fresh.id);
      return { entity: fresh, workTypeName: replayWorkTypeName, hasActiveAssignment: replayAssigned, alreadyOpen: true };
    }
    return { entity: updated, workTypeName, hasActiveAssignment: false, alreadyOpen: false };
  }

  /**
   * F001 — fail-closed: port method thiếu là lỗi wiring máy chủ → 500
   * (mirror guard `createWithClient`/`updateWithClient`), KHÔNG fail-open
   * `false` (mở board lọt khi đang có người nhận).
   */
  private async hasAssignment(workOrderId: string): Promise<boolean> {
    if (!this.workOrderRepo.hasActiveAssignmentByWorkOrderIds) {
      throw new InternalServerErrorException('Không thể kiểm tra phân công công việc');
    }
    const found = await this.workOrderRepo.hasActiveAssignmentByWorkOrderIds([workOrderId]);
    return found.has(workOrderId);
  }

  /** Classify nhánh guarded-UPDATE `rowCount = 0` (đồng bộ message với pre-check). */
  private toRaceError(
    code: 'WORK_ORDER_CONFLICT' | 'JOB_BOARD_ALREADY_OPEN' | 'JOB_BOARD_HAS_ASSIGNEE' | 'WORK_ORDER_STATUS_NOT_OPENABLE',
    status: string,
    version: number,
  ): ConflictException | BadRequestException {
    switch (code) {
      case 'WORK_ORDER_CONFLICT':
        return versionConflict409(version);
      case 'JOB_BOARD_ALREADY_OPEN':
        return alreadyOpen409();
      case 'JOB_BOARD_HAS_ASSIGNEE':
        return hasAssignee409();
      default:
        return fieldError(
          'status',
          `Trạng thái ${status} không thể mở Job Board; chỉ Work Order DRAFT, READY hoặc OPEN (mở lại) được mở`,
          'WORK_ORDER_STATUS_NOT_OPENABLE',
        );
    }
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
