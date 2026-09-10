/**
 * JOB-SRS-007 (issue #47) — policy thuần cho Job Board detail
 * (`GET /api/v1/job-board/:id`, BD-3): rule resolve checklist + classify
 * config error. Không import Nest/DB, không mutate, không I/O — use case
 * convert sang 400/409/500.
 *
 * - **Checklist rule (BD-3):** chỉ template `status='ACTIVE'` VÀ
 *   (`work_type_id` = work type của WO HOẶC `work_type_id IS NULL` generic),
 *   **mọi purpose** (`PRE_START`/`INSPECTION`/`WORK_DONE` — "checklist liên
 *   quan" nghĩa đầy đủ, worker cần biết cả nghiệm thu trước khi nhận).
 *   Nhiều ACTIVE version cùng `code` (unique `(code,version)`, F7) → giữ
 *   `version` cao nhất. DRAFT/INACTIVE = chưa publish, không phải lỗi.
 * - **KHÔNG phải config error:** resolve về 0 template → empty state hợp lệ
 *   (work type hợp lệ có thể không có checklist). Area/trade inactive → vẫn
 *   hiện tên (refs query không lọc `is_active`, parity F3).
 * - **Config error thực sự (defensive):** `workTypeId` của WO không resolve
 *   được work type (`findWorkTypeDetailById` → null) → use case 409
 *   `JOB_BOARD_CONFIG_INVALID`, withheld toàn bộ detail (AC-6). FK
 *   `work_type_id NOT NULL` (F5) khiến nhánh này gần bất khả ở DB.
 */

export type ChecklistPurpose = 'PRE_START' | 'INSPECTION' | 'WORK_DONE';

/** Dòng checklist tối thiểu để resolve (adapter map từ DB row). */
export interface ChecklistTemplateCandidate {
  id: string;
  code: string;
  /** `null` = checklist generic (áp dụng mọi loại công việc). */
  workTypeId: string | null;
  purpose: ChecklistPurpose;
  version: number;
  status: string;
}

/**
 * Lọc checklist cho detail WO: chỉ ACTIVE + (đúng work type HOẶC generic
 * NULL), mọi purpose; mỗi `code` giữ version cao nhất; sắp ổn định theo
 * `code` (deterministic cho response + test).
 */
export function selectChecklistsForWorkType(
  candidates: ChecklistTemplateCandidate[],
  workTypeId: string,
): ChecklistTemplateCandidate[] {
  const bestByCode = new Map<string, ChecklistTemplateCandidate>();
  for (const c of candidates) {
    if (c.status !== 'ACTIVE') continue;
    if (c.workTypeId !== null && c.workTypeId !== workTypeId) continue;
    const prev = bestByCode.get(c.code);
    if (!prev || c.version > prev.version) {
      bestByCode.set(c.code, c);
    }
  }
  return [...bestByCode.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/**
 * Nhánh defensive/wiring: work type ref không resolve được → config error
 * (409 `JOB_BOARD_CONFIG_INVALID`, withheld toàn bộ detail). Trả `true` khi
 * là config error.
 */
export function isJobBoardConfigError(workTypeDetail: unknown): boolean {
  return workTypeDetail === null || workTypeDetail === undefined;
}
