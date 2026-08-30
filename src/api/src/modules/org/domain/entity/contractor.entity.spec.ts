import { ContractorEntity } from './contractor.entity';

function makeContractor(overrides: Partial<Record<string, unknown>> = {}): ContractorEntity {
  return new ContractorEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CTR-001',
    name: 'Cong ty XD Alpha',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'alpha@example.com',
    status: 'ACTIVE',
    scope: 'Thi cong phan tho, cot thep',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...(overrides as object),
  } as never);
}

describe('ContractorEntity ORG-SRS-002', () => {
  it('tạo contractor hợp lệ và eligible khi ACTIVE', () => {
    const c = makeContractor();
    expect(c.isActive()).toBe(true);
    expect(c.isEligibleForAssignment()).toBe(true);
    expect(c.toPublic().eligible).toBe(true);
  });

  it('INACTIVE contractor không eligible cho assignment mới', () => {
    const c = makeContractor({ status: 'INACTIVE' });
    expect(c.isInactive()).toBe(true);
    expect(c.isEligibleForAssignment()).toBe(false);
  });

  it('lịch sử cũ vẫn giữ khi inactive (không hard delete)', () => {
    const c = makeContractor();
    expect(c.id).toBe('11111111-1111-4111-8111-111111111111');
    c.changeStatus('INACTIVE');
    expect(c.isInactive()).toBe(true);
    // entity still exists, id/code/name preserved
    expect(c.code).toBe('CTR-001');
    expect(c.name).toBe('Cong ty XD Alpha');
  });

  it('validate code: trống hoặc quá ngắn bị reject', () => {
    expect(() => makeContractor({ code: '' })).toThrow('không được để trống');
    expect(() => makeContractor({ code: 'A' })).toThrow('2 đến 50');
    expect(() => makeContractor({ code: 'CTR 001' })).toThrow('chỉ cho phép');
  });

  it('validate name: trống hoặc quá dài', () => {
    expect(() => makeContractor({ name: '' })).toThrow('Tên nhà thầu');
    expect(() => makeContractor({ name: 'A' })).toThrow('tối thiểu 2');
  });

  it('validate phone không hợp lệ', () => {
    expect(() => makeContractor({ phone: 'abc' })).toThrow('Số điện thoại');
  });

  it('validate email không hợp lệ', () => {
    expect(() => makeContractor({ email: 'not-an-email' })).toThrow('Email');
  });

  it('changeStatus trùng trạng thái bị reject', () => {
    const c = makeContractor();
    expect(() => c.changeStatus('ACTIVE')).toThrow('đã ở trạng thái ACTIVE');
  });

  it('updateDetails giữ updatedAt mới và validate', () => {
    const c = makeContractor();
    const before = c.updatedAt;
    c.updateDetails({ name: 'Cong ty Beta', scope: 'Hoan thien' }, new Date('2026-02-01T00:00:00Z'));
    expect(c.name).toBe('Cong ty Beta');
    expect(c.scope).toBe('Hoan thien');
    expect(c.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it('scope tối đa 1000 ký tự', () => {
    expect(() => makeContractor({ scope: 'a'.repeat(1001) })).toThrow('1000');
  });
});
