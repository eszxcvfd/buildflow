/**
 * JOB-SRS-006 (issue #46) — filter state ở module-level store (plain get/set).
 * Lý do: Expo Router remount JobBoardScreen khi push `/job-board/[id]` rồi
 * back → React state mất; store giữ filter khi quay lại list (AC1/AC3).
 * Scope = phiên app (KHÔNG AsyncStorage — filter cũ không sống qua đổi
 * contract; mất khi restart app — ghi MOBILE.md).
 */
export interface JobBoardFilter {
  projectId?: string;
  areaIds: string[];
  workTypeIds: string[];
  dateFrom?: string;
  dateTo?: string;
  skillMine: boolean;
}

export const EMPTY_JOB_BOARD_FILTER: JobBoardFilter = {
  projectId: undefined,
  areaIds: [],
  workTypeIds: [],
  dateFrom: undefined,
  dateTo: undefined,
  skillMine: false,
};

let current: JobBoardFilter = { ...EMPTY_JOB_BOARD_FILTER, areaIds: [], workTypeIds: [] };

/**
 * F003 (#46) — token mà store đang phục vụ. Module-level (sống qua remount
 * như chính `current`): đổi tài khoản (token khác) mà không clear sẽ leak
 * filter của user cũ sang user mới.
 */
let boundToken: string | null = null;

export function getJobBoardFilter(): JobBoardFilter {
  return {
    ...current,
    areaIds: [...current.areaIds],
    workTypeIds: [...current.workTypeIds],
  };
}

export function setJobBoardFilter(next: JobBoardFilter): void {
  current = {
    ...next,
    areaIds: [...(next.areaIds ?? [])],
    workTypeIds: [...(next.workTypeIds ?? [])],
  };
}

export function clearJobBoardFilter(): void {
  current = { ...EMPTY_JOB_BOARD_FILTER, areaIds: [], workTypeIds: [] };
}

export function hasActiveJobBoardFilter(f: JobBoardFilter): boolean {
  return Boolean(
    f.projectId || f.areaIds.length > 0 || f.workTypeIds.length > 0 || f.dateFrom || f.dateTo || f.skillMine,
  );
}

/**
 * F003 (#46) — seam duy nhất đáng tin cho đổi tài khoản: screen gọi trong
 * effect `[token]`. Lần đầu bind (sau restart/logout → remount mới) giữ filter
 * hiện có và trả `false`; token khác → clear store + trả `true` để caller reset
 * nốt UI state (items/total/error/chips) TRƯỚC khi loadPage (F009/F010).
 * Cùng-token remount (back từ detail) → `false`, filter được giữ (F9).
 */
export function bindJobBoardFilterToken(token: string): boolean {
  if (boundToken === null) {
    boundToken = token;
    return false;
  }
  if (boundToken === token) return false;
  boundToken = token;
  clearJobBoardFilter();
  return true;
}

/** Reset binding (chỉ dùng trong test — module state sống qua các test). */
export function resetJobBoardFilterBindingForTests(): void {
  boundToken = null;
}

/**
 * Client validation mirror server (BD10): ISO bắt buộc offset; `''` = absent;
 * cả hai present mà from > to (instant) → lỗi cả 2 field, chặn gửi.
 */
const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

export function validateJobBoardFilterDates(
  dateFrom?: string,
  dateTo?: string,
): { dateFrom?: string[]; dateTo?: string[] } {
  const errors: { dateFrom?: string[]; dateTo?: string[] } = {};
  const check = (v: string | undefined, field: 'dateFrom' | 'dateTo'): number | null => {
    if (!v) return null;
    if (!OFFSET_RE.test(v)) {
      errors[field] = ['Ngày giờ phải kèm múi giờ (thí dụ +07:00 hoặc Z)'];
      return null;
    }
    const t = Date.parse(v);
    if (Number.isNaN(t)) {
      errors[field] = ['Ngày giờ không hợp lệ (ISO-8601)'];
      return null;
    }
    return t;
  };
  const fromT = check(dateFrom, 'dateFrom');
  const toT = check(dateTo, 'dateTo');
  if (fromT !== null && toT !== null && fromT > toT) {
    const msg = 'Từ ngày phải không sau Đến ngày';
    errors.dateFrom = [msg];
    errors.dateTo = [msg];
  }
  return errors;
}
