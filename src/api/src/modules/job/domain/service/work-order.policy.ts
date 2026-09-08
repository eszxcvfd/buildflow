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

/**
 * Dữ liệu bổ sung theo loại công việc (`work_orders.custom_fields`,
 * migration 0011) — nơi lưu giá trị các `required_fields` tùy chỉnh của
 * work-type (thí dụ `dien_tich`, `anh_nghiem_thu` của `WT-OP-LAT`) mà WO
 * không có cột riêng.
 *
 * Decision (ghi rõ theo ENDPOINTS §17 J8): chấp nhận key BẤT KỲ (không giới
 * hạn theo `required_fields` của work-type hiện tại) — để WO không hỏng khi
 * work-type đổi config, và để JOB không phải đọc catalog PRJ ở path ghi;
 * publish-check đọc `required_fields` tại thời điểm check. Bù lại giới hạn
 * size/depth: object phẳng ≤ 50 key, key alnum/`_` 1-50 ký tự, giá trị chỉ
 * primitive `string | number | boolean` (không lồng object/array — depth 1),
 * string ≤ 2000 ký tự, JSON serialize ≤ 32KB.
 */
export type WorkOrderCustomFields = Record<string, string | number | boolean>;

export const CUSTOM_FIELDS_MAX_KEYS = 50;
export const CUSTOM_FIELDS_KEY_RE = /^[A-Za-z0-9_]{1,50}$/;
export const CUSTOM_FIELDS_STRING_MAX_LENGTH = 2000;
export const CUSTOM_FIELDS_JSON_MAX_BYTES = 32 * 1024;

function normalizeCustomFieldValue(key: string, value: unknown): string | number | boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Dữ liệu bổ sung "${key}" phải là số hữu hạn`);
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > CUSTOM_FIELDS_STRING_MAX_LENGTH) {
      throw new Error(`Dữ liệu bổ sung "${key}" tối đa ${CUSTOM_FIELDS_STRING_MAX_LENGTH} ký tự`);
    }
    return trimmed;
  }
  throw new Error(`Dữ liệu bổ sung "${key}" chỉ nhận chuỗi, số hoặc true/false`);
}

/** Validate object `customFields` thô (POST full / PATCH partial đều qua đây). */
export function normalizeCustomFieldsInput(value: unknown): WorkOrderCustomFields {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Dữ liệu bổ sung phải là object { key: giá trị }');
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > CUSTOM_FIELDS_MAX_KEYS) {
    throw new Error(`Dữ liệu bổ sung tối đa ${CUSTOM_FIELDS_MAX_KEYS} trường`);
  }
  const out: WorkOrderCustomFields = {};
  for (const [key, raw] of entries) {
    if (!CUSTOM_FIELDS_KEY_RE.test(key)) {
      throw new Error(`Khóa dữ liệu bổ sung "${key}" chỉ gồm chữ/số/gạch dưới, tối đa 50 ký tự`);
    }
    out[key] = normalizeCustomFieldValue(key, raw);
  }
  if (Buffer.byteLength(JSON.stringify(out), 'utf8') > CUSTOM_FIELDS_JSON_MAX_BYTES) {
    throw new Error('Dữ liệu bổ sung vượt quá 32KB');
  }
  return out;
}

/**
 * PATCH merge: partial object chồng lên giá trị hiện tại (key absent = giữ
 * nguyên; key gửi = ghi đè). Không có ngữ nghĩa xóa key riêng ở slice này.
 * Kết quả merge re-validate limits (tổng size sau merge vẫn ≤ 32KB).
 */
export function mergeCustomFields(
  base: WorkOrderCustomFields,
  patch: WorkOrderCustomFields,
): WorkOrderCustomFields {
  const merged: WorkOrderCustomFields = { ...base };
  for (const [key, raw] of Object.entries(patch)) {
    if (!CUSTOM_FIELDS_KEY_RE.test(key)) {
      throw new Error(`Khóa dữ liệu bổ sung "${key}" chỉ gồm chữ/số/gạch dưới, tối đa 50 ký tự`);
    }
    merged[key] = normalizeCustomFieldValue(key, raw);
  }
  if (Object.keys(merged).length > CUSTOM_FIELDS_MAX_KEYS) {
    throw new Error(`Dữ liệu bổ sung tối đa ${CUSTOM_FIELDS_MAX_KEYS} trường`);
  }
  if (Buffer.byteLength(JSON.stringify(merged), 'utf8') > CUSTOM_FIELDS_JSON_MAX_BYTES) {
    throw new Error('Dữ liệu bổ sung vượt quá 32KB');
  }
  return merged;
}
