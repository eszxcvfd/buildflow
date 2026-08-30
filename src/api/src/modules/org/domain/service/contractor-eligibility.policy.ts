import { ContractorEntity } from '../entity/contractor.entity';

/**
 * ORG-SRS-002 policy: Inactive contractor cannot be selected for new assignments.
 * History assignments still viewable (not hard deleted).
 */
export function isContractorEligible(contractor: ContractorEntity): boolean {
  return contractor.isEligibleForAssignment();
}

export function validateContractorScope(scope?: string | null): void {
  if (scope === null || scope === undefined || scope === '') return;
  const trimmed = scope.trim();
  if (trimmed.length > 1000) throw new Error('Phạm vi công việc tối đa 1000 ký tự');
}

export function assertContractorAssignable(contractor: ContractorEntity): void {
  if (!isContractorEligible(contractor)) {
    throw new Error('Nhà thầu ngừng hoạt động không được chọn cho phân công mới');
  }
}
