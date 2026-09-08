/**
 * JOB-SRS-001 (issue #41) — validation helpers thuần domain cho Work Order
 * nháp (mirror work-type.policy style: không Nest/DB, ném Error, use case
 * convert sang 400 fieldErrors / 409).
 */

export const WORK_ORDER_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{2,49}$/;
export const WORK_ORDER_TITLE_MAX_LENGTH = 200;
export const WORK_ORDER_TEXT_MAX_LENGTH = 5000;
export const WORK_ORDER_HEADCOUNT_MIN = 1;
export const WORK_ORDER_HEADCOUNT_MAX = 99;

export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const WORK_ORDER_PRIORITIES: WorkOrderPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tiêu đề: bắt buộc, 1-200 ký tự sau trim. */
export function normalizeWorkOrderTitle(title: unknown): string {
  const trimmed = String(title ?? '').trim();
  if (trimmed.length === 0) throw new Error('Tiêu đề công việc không được để trống');
  if (trimmed.length > WORK_ORDER_TITLE_MAX_LENGTH) {
    throw new Error(`Tiêu đề công việc tối đa ${WORK_ORDER_TITLE_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/**
 * Mã Work Order client-supplied: optional (absent → server tự sinh
 * `generateWorkOrderCode`); khi gửi phải khớp
 * `^[A-Za-z0-9][A-Za-z0-9-]{2,49}$` (3-50 ký tự, mở đầu chữ/số).
 */
export function normalizeWorkOrderCode(code?: string | null): string | null {
  if (code === undefined || code === null) return null;
  const trimmed = String(code).trim();
  if (trimmed.length === 0) return null;
  if (!WORK_ORDER_CODE_RE.test(trimmed)) {
    throw new Error('Mã công việc phải 3-50 ký tự, mở đầu bằng chữ/số, chỉ gồm chữ/số/dấu -');
  }
  return trimmed;
}

const CODE_RANDOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Sinh mã server-side khi client không gửi `code`: `WO-` + base36 timestamp
 * + 4 ký tự ngẫu nhiên (khớp pattern client-supplied nên pre-check trùng
 * code dùng chung một path). `nowMs`/`randomChar` inject được cho test.
 */
export function generateWorkOrderCode(
  nowMs: number = Date.now(),
  randomChar: () => string = () =>
    CODE_RANDOM_ALPHABET[Math.floor(Math.random() * CODE_RANDOM_ALPHABET.length)],
): string {
  const time = Math.max(0, Math.floor(nowMs)).toString(36).toUpperCase();
  let suffix = '';
  for (let i = 0; i < 4; i += 1) suffix += randomChar();
  return `WO-${time}${suffix}`;
}

/** Ưu tiên: optional, default `NORMAL`; sai enum → Error. */
export function normalizeWorkOrderPriority(value: unknown): WorkOrderPriority {
  if (value === undefined || value === null) return 'NORMAL';
  if (!WORK_ORDER_PRIORITIES.includes(value as WorkOrderPriority)) {
    throw new Error('Ưu tiên công việc không hợp lệ (LOW/NORMAL/HIGH/URGENT)');
  }
  return value as WorkOrderPriority;
}

/** `description`/`instructions`: optional; rỗng → null; tối đa 5000 ký tự. */
export function normalizeWorkOrderText(value: unknown, fieldLabel: string): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WORK_ORDER_TEXT_MAX_LENGTH) {
    throw new Error(`${fieldLabel} tối đa ${WORK_ORDER_TEXT_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** Số lượng dự kiến: optional (null = chưa dự kiến); khi gửi phải int 1-99. */
export function normalizePlannedHeadcount(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < WORK_ORDER_HEADCOUNT_MIN || num > WORK_ORDER_HEADCOUNT_MAX) {
    throw new Error(
      `Số lượng dự kiến phải là số nguyên từ ${WORK_ORDER_HEADCOUNT_MIN} đến ${WORK_ORDER_HEADCOUNT_MAX}`,
    );
  }
  return num;
}

/** Một mốc ISO 8601 optional; rỗng → null; sai format → Error. */
export function parsePlannedDateTime(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  const time = Date.parse(trimmed);
  if (Number.isNaN(time)) throw new Error('Thời điểm kế hoạch phải đúng định dạng ISO 8601');
  return new Date(time);
}

/**
 * Khi gửi cả hai mốc: `planned_start_at < planned_end_at` (chặt hơn CHECK
 * DB `>=` — slice này yêu cầu khoảng thời gian thật sự, else 400
 * fieldErrors `{plannedEndAt}`). Một mốc lẻ luôn hợp lệ (nháp thiếu
 * schedule vẫn DRAFT — SRS JOB-SRS-001).
 */
export function assertPlannedRange(start: Date | null, end: Date | null): void {
  if (start && end && end.getTime() <= start.getTime()) {
    throw new Error('Thời điểm kết thúc kế hoạch phải sau thời điểm bắt đầu');
  }
}

/** Idempotency key: optional (absent → null); khi gửi phải là UUID. */
export function normalizeRequestKey(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  if (!UUID_RE.test(trimmed)) {
    throw new Error('Request key phải là UUID hợp lệ');
  }
  return trimmed;
}
