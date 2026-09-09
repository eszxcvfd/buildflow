import { WorkOrderStatus } from '../entity/work-order.entity';
import { parsePlannedDateTime } from './work-order.policy';

/**
 * JOB-SRS-004 (issue #44) — policy thuần domain cho mở/đóng Job Board
 * (mirror `work-order-update.policy.ts`: không import Nest/DB, không mutate,
 * không I/O — use case convert sang 400/409).
 *
 * Badge `jobBoard.state` do server derive (web không query thứ hai):
 * - `ASSIGNED` khi có assignment hiện tại (`hasActiveAssignment`) hoặc WO đã
 *   ở trạng thái ASSIGNED/IN_PROGRESS (worker đã nhận — claim thuộc #47).
 * - `EXPIRED` khi board đang mở nhưng `until` đã qua (computed at read time,
 *   không cron; recover = Close → Open).
 * - `SCHEDULED` khi board đang mở nhưng `from` còn trong tương lai (cửa sổ
 *   chưa tới — badge phụ, additive cho #45).
 * - `AVAILABLE` khi board đang mở và WO ở trạng thái OPEN.
 * - `CLOSED` cho phần còn lại (board đóng, DRAFT/READY, terminal
 *   CANCELLED/WORK_DONE/CLOSED — các trạng thái này KHÔNG map thành ASSIGNED).
 */

export type JobBoardState = 'ASSIGNED' | 'EXPIRED' | 'SCHEDULED' | 'AVAILABLE' | 'CLOSED';

/** Trạng thái WO cho phép mở board (guarded UPDATE `status IN` mirror). */
const OPENABLE_STATUSES: readonly WorkOrderStatus[] = ['DRAFT', 'READY', 'OPEN'];

/** Trạng thái đã có người nhận (derive ASSIGNED không cần query assignment). */
const ASSIGNED_STATUSES: readonly WorkOrderStatus[] = ['ASSIGNED', 'IN_PROGRESS'];

export class JobBoardWindowError extends Error {
  constructor(
    readonly field: 'jobBoardOpenFrom' | 'jobBoardOpenUntil',
    message: string,
  ) {
    super(message);
  }
}

export interface ValidateJobBoardWindowInput {
  jobBoardOpenFrom?: unknown;
  jobBoardOpenUntil?: unknown;
  /** Inject cho test (`now` server tại thời điểm ghi). */
  now?: Date;
}

export interface ValidatedJobBoardWindow {
  from: Date;
  until: Date | null;
}

/**
 * Validate cửa sổ nhận việc (thuần):
 * - `from` absent → default = `now` server; ISO sai → 400 `{jobBoardOpenFrom}`.
 * - `until` absent/null → null (không hạn); ISO sai → 400 `{jobBoardOpenUntil}`.
 * - ISO thiếu offset múi giờ (`Z`/`±hh:mm`) → 400 field đúng (F004: chuỗi
 *   naive `datetime-local` bị client/server diễn giải theo giờ local nên
 *   không được chấp nhận — client phải `toISOString()` trước khi gửi).
 * - `until <= from` → 400 `{jobBoardOpenUntil}` (strict `>`, chặt hơn CHECK
 *   DB `>=` — mirror `assertPlannedRange`).
 * - `until <= now` → 400 `{jobBoardOpenUntil}` (cửa sổ đã hết, reject).
 * Timezone: client gửi ISO-8601 có offset → parse thành instant
 * (`parsePlannedDateTime`), lưu `timestamptz`; mọi so sánh trên UTC instant.
 */
export function validateJobBoardWindow(input: ValidateJobBoardWindowInput): ValidatedJobBoardWindow {
  const now = input.now ?? new Date();
  assertIsoOffset(input.jobBoardOpenFrom, 'jobBoardOpenFrom');
  assertIsoOffset(input.jobBoardOpenUntil, 'jobBoardOpenUntil');
  let from: Date | null;
  let until: Date | null;
  try {
    from = parsePlannedDateTime(input.jobBoardOpenFrom ?? null);
  } catch {
    throw new JobBoardWindowError('jobBoardOpenFrom', 'Thời điểm bắt đầu nhận việc phải đúng định dạng ISO 8601');
  }
  try {
    until = parsePlannedDateTime(input.jobBoardOpenUntil ?? null);
  } catch {
    throw new JobBoardWindowError('jobBoardOpenUntil', 'Thời điểm kết thúc nhận việc phải đúng định dạng ISO 8601');
  }
  const resolvedFrom = from ?? now;
  if (until !== null) {
    if (until.getTime() <= resolvedFrom.getTime()) {
      throw new JobBoardWindowError(
        'jobBoardOpenUntil',
        'Thời điểm kết thúc nhận việc phải sau thời điểm bắt đầu',
      );
    }
    if (until.getTime() <= now.getTime()) {
      throw new JobBoardWindowError(
        'jobBoardOpenUntil',
        'Thời điểm kết thúc nhận việc phải trong tương lai, hãy chọn cửa sổ mới hoặc đóng rồi mở lại',
      );
    }
  }
  return { from: resolvedFrom, until };
}

/** Hậu tố offset múi giờ bắt buộc (`Z` hoặc `±hh:mm`/`±hhmm`). */
const ISO_OFFSET_SUFFIX_RE = /([Zz]|[+-]\d{2}:?\d{2})$/;

/**
 * F004/F019 — ISO không offset (thiếu `Z`/`±hh:mm`, thí dụ chuỗi naive từ
 * `datetime-local`) → `JobBoardWindowError` field đúng (use case convert
 * 400 `JOB_BOARD_WINDOW_INVALID`). `Date` instance (đã là instant) và
 * absent/null/rỗng (default-now/không hạn) được miễn. Non-string non-Date
 * (number/boolean/array/object) → `JobBoardWindowError` field đúng
 * (400 `JOB_BOARD_WINDOW_INVALID`, không bypass).
 */
function assertIsoOffset(
  value: unknown,
  field: 'jobBoardOpenFrom' | 'jobBoardOpenUntil',
): void {
  if (value === undefined || value === null) return;
  if (value instanceof Date) return;
  if (typeof value !== 'string') {
    throw new JobBoardWindowError(field, 'Thời điểm nhận việc phải đúng định dạng ISO 8601 kèm múi giờ (offset Z hoặc ±hh:mm)');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return;
  if (!ISO_OFFSET_SUFFIX_RE.test(trimmed)) {
    throw new JobBoardWindowError(
      field,
      'Thời điểm nhận việc phải đúng định dạng ISO 8601 kèm múi giờ (offset Z hoặc ±hh:mm)',
    );
  }
}
export interface DeriveJobBoardStateInput {
  status: WorkOrderStatus;
  jobBoardOpen: boolean;
  jobBoardOpenFrom: Date | null;
  jobBoardOpenUntil: Date | null;
  hasActiveAssignment: boolean;
  /** Inject cho test. */
  now?: Date;
}

/** Derive badge server-side — thứ tự ưu tiên cố định (deterministic). */
export function deriveJobBoardState(input: DeriveJobBoardStateInput): JobBoardState {
  if (input.hasActiveAssignment || (ASSIGNED_STATUSES as readonly string[]).includes(input.status)) {
    return 'ASSIGNED';
  }
  if (input.jobBoardOpen) {
    const nowMs = (input.now ?? new Date()).getTime();
    if (input.jobBoardOpenUntil !== null && nowMs > input.jobBoardOpenUntil.getTime()) {
      return 'EXPIRED';
    }
    if (input.jobBoardOpenFrom !== null && nowMs < input.jobBoardOpenFrom.getTime()) {
      return 'SCHEDULED';
    }
    if (input.status === 'OPEN') {
      return 'AVAILABLE';
    }
  }
  return 'CLOSED';
}

/** WO ở trạng thái này có được mở board không (pre-check + guard mirror). */
export function isOpenableStatus(status: WorkOrderStatus): boolean {
  return (OPENABLE_STATUSES as readonly string[]).includes(status);
}

/** Hai cửa sổ có trùng đúng instant không (idempotent replay).
 * Ruling F016 (round fix cuối): so sánh window FULL-MS ở MỌI đường
 * (pre-check + race re-read) — DB `timestamptz` giữ µs nên persisted =
 * sent; hai window khác nhau dù <1s → 409. KHÔNG truncate về giây. */
export function isSameJobBoardWindow(
  a: { from: Date | null; until: Date | null },
  b: { from: Date | null; until: Date | null },
): boolean {
  const sameFrom =
    (a.from === null && b.from === null) ||
    (a.from !== null && b.from !== null && a.from.getTime() === b.from.getTime());
  const sameUntil =
    (a.until === null && b.until === null) ||
    (a.until !== null && b.until !== null && a.until.getTime() === b.until.getTime());
  return sameFrom && sameUntil;
}

export type OpenFailureCode =
  | 'WORK_ORDER_CONFLICT'
  | 'JOB_BOARD_ALREADY_OPEN'
  | 'JOB_BOARD_HAS_ASSIGNEE'
  | 'WORK_ORDER_STATUS_NOT_OPENABLE';

export interface ClassifyOpenFailureInput {
  expectedVersion: number | null;
  currentVersion: number;
  jobBoardOpen: boolean;
  status: WorkOrderStatus;
  hasActiveAssignment: boolean;
}

/**
 * Classify nhánh guarded-UPDATE `rowCount = 0` (open) trên row tươi —
 * thứ tự deterministic: version → flag → assignment → status.
 */
export function classifyOpenFailure(input: ClassifyOpenFailureInput): OpenFailureCode {
  if (input.expectedVersion !== null && input.expectedVersion !== input.currentVersion) {
    return 'WORK_ORDER_CONFLICT';
  }
  if (input.jobBoardOpen) {
    return 'JOB_BOARD_ALREADY_OPEN';
  }
  if (input.hasActiveAssignment) {
    return 'JOB_BOARD_HAS_ASSIGNEE';
  }
  if (!isOpenableStatus(input.status)) {
    return 'WORK_ORDER_STATUS_NOT_OPENABLE';
  }
  return 'WORK_ORDER_CONFLICT';
}

export type CloseFailureCode = 'WORK_ORDER_CONFLICT' | 'ALREADY_CLOSED' | 'WORK_ORDER_STATUS_NOT_CLOSABLE';

export interface ClassifyCloseFailureInput {
  expectedVersion: number | null;
  currentVersion: number;
  jobBoardOpen: boolean;
  status: WorkOrderStatus;
}

/**
 * Classify nhánh guarded-UPDATE `rowCount = 0` (close) trên row tươi.
 * Guard close: `job_board_open = true AND status NOT IN ('CANCELLED')`.
 */
export function classifyCloseFailure(input: ClassifyCloseFailureInput): CloseFailureCode {
  if (input.expectedVersion !== null && input.expectedVersion !== input.currentVersion) {
    return 'WORK_ORDER_CONFLICT';
  }
  if (!input.jobBoardOpen) {
    return 'ALREADY_CLOSED';
  }
  if (input.status === 'CANCELLED') {
    return 'WORK_ORDER_STATUS_NOT_CLOSABLE';
  }
  return 'WORK_ORDER_CONFLICT';
}
