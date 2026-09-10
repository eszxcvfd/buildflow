import { UUID_RE } from './work-order.policy';

/**
 * JOB-SRS-006 (issue #46) — policy thuần domain parse filter Job Board
 * (mirror `work-order-job-board.policy.ts`: không import Nest/DB, không
 * mutate, không I/O — controller convert sang 400).
 *
 * 6 param optional, absent/`''` = không filter (mirror `parsePlannedDateTime`
 * coi `''` là null): `projectId` đơn, `areaId`/`workTypeId` lặp được,
 * `dateFrom`/`dateTo` ISO bắt buộc offset, `skill` enum duy nhất `mine`.
 */

// Hậu tố offset múi giờ bắt buộc (`Z` hoặc `±hh:mm`/`±hhmm`) — DUPLICATE có
// chủ đích từ `work-order-job-board.policy.ts:98` (`ISO_OFFSET_SUFFIX_RE`,
// module-private, mirror chặt #44): naive ISO bị client/server diễn giải theo
// giờ local nên không được chấp nhận.
const ISO_OFFSET_SUFFIX_RE = /([Zz]|[+-]\d{2}:?\d{2})$/;

/** Mã lỗi cho 400 date-range filter (mirror #44 `JOB_BOARD_WINDOW_INVALID`). */
export const JOB_BOARD_DATE_RANGE_INVALID = 'JOB_BOARD_DATE_RANGE_INVALID';

/** Lỗi parse filter — controller convert thành 400 `fieldErrors` multi-field. */
export class JobBoardFilterError extends Error {
  constructor(
    readonly fields: string[],
    message: string,
    /** Mã lỗi máy (chỉ date errors mang `JOB_BOARD_DATE_RANGE_INVALID`). */
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface RawJobBoardFilterQuery {
  projectId?: unknown;
  areaId?: unknown;
  workTypeId?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  skill?: unknown;
}

export interface ParsedJobBoardFilters {
  projectId?: string;
  areaIds?: string[];
  workTypeIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  /** `true` khi `skill=mine` — use case resolve tradeIds của actor server-side. */
  skillMine: boolean;
}

function isAbsent(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  return false;
}

function parseSingleUuid(value: unknown, field: string, label: string): string | undefined {
  if (isAbsent(value)) return undefined;
  if (value instanceof Date || typeof value !== 'string' || !UUID_RE.test(value.trim())) {
    throw new JobBoardFilterError([field], `${label} không hợp lệ`);
  }
  return value.trim();
}

/** Param lặp được (`areaId=a&areaId=b`): string đơn → 1 phần tử; `''` bị bỏ. */
function parseUuidList(value: unknown, field: string, label: string): string[] | undefined {
  if (isAbsent(value)) return undefined;
  const rawList = Array.isArray(value) ? value : [value];
  const ids = rawList
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim());
  if (ids.length === 0) return undefined;
  for (const id of ids) {
    if (!UUID_RE.test(id)) {
      throw new JobBoardFilterError([field], `${label} không hợp lệ`);
    }
  }
  return [...new Set(ids)];
}

function parseIsoDate(value: unknown, field: 'dateFrom' | 'dateTo', label: string): Date | undefined {
  if (isAbsent(value)) return undefined;
  // `Date` instance (đã là instant) được miễn check offset — mirror #44.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new JobBoardFilterError([field], `${label} phải đúng định dạng ISO 8601`, JOB_BOARD_DATE_RANGE_INVALID);
    }
    return value;
  }
  if (typeof value !== 'string') {
    throw new JobBoardFilterError(
      [field],
      `${label} phải đúng định dạng ISO 8601 kèm múi giờ (offset Z hoặc ±hh:mm)`,
      JOB_BOARD_DATE_RANGE_INVALID,
    );
  }
  const trimmed = value.trim();
  if (!ISO_OFFSET_SUFFIX_RE.test(trimmed)) {
    throw new JobBoardFilterError(
      [field],
      `${label} phải đúng định dạng ISO 8601 kèm múi giờ (offset Z hoặc ±hh:mm)`,
      JOB_BOARD_DATE_RANGE_INVALID,
    );
  }
  const time = Date.parse(trimmed);
  if (Number.isNaN(time)) {
    throw new JobBoardFilterError([field], `${label} phải đúng định dạng ISO 8601`, JOB_BOARD_DATE_RANGE_INVALID);
  }
  return new Date(time);
}

/**
 * Parse 6 filter param (thuần, deterministic): sai format uuid/date/skill →
 * `JobBoardFilterError` 1 field; `dateFrom > dateTo` (so instant UTC) →
 * `JobBoardFilterError` CẢ hai field.
 */
export function parseJobBoardFilters(raw: RawJobBoardFilterQuery): ParsedJobBoardFilters {
  const projectId = parseSingleUuid(raw.projectId, 'projectId', 'Mã dự án không hợp lệ');
  const areaIds = parseUuidList(raw.areaId, 'areaId', 'Mã khu vực không hợp lệ');
  const workTypeIds = parseUuidList(raw.workTypeId, 'workTypeId', 'Mã loại công việc không hợp lệ');
  const dateFrom = parseIsoDate(raw.dateFrom, 'dateFrom', 'Ngày bắt đầu không hợp lệ');
  const dateTo = parseIsoDate(raw.dateTo, 'dateTo', 'Ngày kết thúc không hợp lệ');
  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new JobBoardFilterError(
      ['dateFrom', 'dateTo'],
      'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc',
      JOB_BOARD_DATE_RANGE_INVALID,
    );
  }
  let skillMine = false;
  if (!isAbsent(raw.skill)) {
    if (typeof raw.skill !== 'string' || raw.skill.trim() !== 'mine') {
      throw new JobBoardFilterError(['skill'], 'Kỹ năng không hợp lệ (chỉ hỗ trợ skill=mine)');
    }
    skillMine = true;
  }
  return { projectId, areaIds, workTypeIds, dateFrom, dateTo, skillMine };
}
