/**
 * ORG-SRS-001 policy helpers (trade validation).
 * NOTE: the legacy `isWorkerEligible` wrapper was removed (ORG-SRS-008, issue #31)
 * — it had no non-spec importers. Lifecycle state lives on `WorkerEntity`
 * (`isEligibleForAssignment` / `toPublicProfile().eligible`, see worker.entity.ts);
 * the §9 fail-closed eligibility verdict is computed by the eligibility use case.
 */

export function validateTradeAssignment(tradeIds: string[], skillLevels?: number[]): void {
  if (!tradeIds || tradeIds.length === 0) return; // trades optional on create, but if provided must be valid
  const seen = new Set<string>();
  for (const id of tradeIds) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error(`Trade ID không hợp lệ: ${id}`);
    }
    if (seen.has(id.toLowerCase())) {
      throw new Error(`Trade ID trùng lặp: ${id}`);
    }
    seen.add(id.toLowerCase());
  }
  if (skillLevels) {
    for (const lvl of skillLevels) {
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 5) {
        throw new Error('Skill level phải là số nguyên 1-5');
      }
    }
  }
}

export function validateWorkerUniqueIdentity(employeeCode?: string | null): void {
  if (employeeCode === null || employeeCode === undefined || employeeCode === '') return;
  const trimmed = employeeCode.trim();
  if (trimmed.length === 0) throw new Error('Mã nhân viên không được để trống');
  if (trimmed.length > 50) throw new Error('Mã nhân viên tối đa 50 ký tự');
}
