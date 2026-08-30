import { ContractorEntity } from '../entity/contractor.entity';
import { isContractorEligible, assertContractorAssignable } from './contractor-eligibility.policy';

function makeContractor(status: 'ACTIVE' | 'INACTIVE'): ContractorEntity {
  return new ContractorEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CTR-001',
    name: 'Alpha',
    contactName: 'Nguyen Van A',
    phone: null,
    email: null,
    status,
    scope: 'Thi cong phan tho',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ContractorEligibility ORG-SRS-002', () => {
  it('ACTIVE contractor eligible', () => {
    expect(isContractorEligible(makeContractor('ACTIVE'))).toBe(true);
    expect(() => assertContractorAssignable(makeContractor('ACTIVE'))).not.toThrow();
  });

  it('INACTIVE contractor không được chọn cho assignment mới', () => {
    expect(isContractorEligible(makeContractor('INACTIVE'))).toBe(false);
    expect(() => assertContractorAssignable(makeContractor('INACTIVE'))).toThrow('không được chọn cho phân công mới');
  });

  it('history sau status change vẫn truy được', () => {
    const c = makeContractor('ACTIVE');
    c.changeStatus('INACTIVE');
    expect(c.isInactive()).toBe(true);
    expect(c.id).toBe('11111111-1111-4111-8111-111111111111');
  });
});
