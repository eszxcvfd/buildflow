import { CrewEntity } from './crew.entity';

const BASE = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'CREW-001',
  name: 'Đội thi công Alpha',
  createdBy: '22222222-2222-4222-8222-222222222222',
  createdAt: new Date('2026-08-26T00:00:00.000Z'),
  updatedAt: new Date('2026-08-27T00:00:00.000Z'),
};

describe('CrewEntity ORG-SRS-006 (issue #29)', () => {
  it('tạo đội hợp lệ, mặc định eligible khi ACTIVE', () => {
    const e = new CrewEntity({ ...BASE, status: 'ACTIVE', leaderUserId: '33333333-3333-4333-8333-333333333333' });
    expect(e.isActive()).toBe(true);
    expect(e.isEligibleForAssignment()).toBe(true);
    const pub = e.toPublic();
    expect(pub.eligible).toBe(true);
    expect(pub.leaderUserId).toBe('33333333-3333-4333-8333-333333333333');
  });

  it('code validation: trống/ngắn/dài/sai ký tự', () => {
    expect(() => new CrewEntity({ ...BASE, code: '', status: 'ACTIVE' })).toThrow('Mã đội không được để trống');
    expect(() => new CrewEntity({ ...BASE, code: 'A', status: 'ACTIVE' })).toThrow('Mã đội phải từ 2 đến 50 ký tự');
    expect(() => new CrewEntity({ ...BASE, code: 'CREW 001', status: 'ACTIVE' })).toThrow('Mã đội chỉ cho phép chữ, số, _ và -');
  });

  it('name validation: trống/quá dài (DB varchar 120)', () => {
    expect(() => new CrewEntity({ ...BASE, name: '  ', status: 'ACTIVE' })).toThrow('Tên đội không được để trống');
    expect(() => new CrewEntity({ ...BASE, name: 'x'.repeat(121), status: 'ACTIVE' })).toThrow('Tên đội tối đa 120 ký tự');
  });

  it('description optional ≤500; contractorId sai format reject', () => {
    expect(() => new CrewEntity({ ...BASE, status: 'ACTIVE', description: 'x'.repeat(501) })).toThrow('Mô tả đội tối đa 500 ký tự');
    expect(() => new CrewEntity({ ...BASE, status: 'ACTIVE', contractorId: 'not-a-uuid' })).toThrow('Nhà thầu không hợp lệ');
    const e = new CrewEntity({ ...BASE, status: 'ACTIVE' });
    expect(e.description).toBeNull();
    expect(e.contractorId).toBeNull();
  });

  it('status sai reject; changeStatus đổi ACTIVE/INACTIVE, same-status throw', () => {
    expect(() => new CrewEntity({ ...BASE, status: 'LOCKED' as never })).toThrow('Trạng thái đội không hợp lệ');
    const e = new CrewEntity({ ...BASE, status: 'ACTIVE' });
    e.changeStatus('INACTIVE');
    expect(e.isInactive()).toBe(true);
    expect(e.isEligibleForAssignment()).toBe(false);
    expect(() => e.changeStatus('INACTIVE')).toThrow('Đội đã ở trạng thái INACTIVE');
  });

  it('updateDetails: rename + description + contractorId; setLeaderUserId đổi lead', () => {
    const e = new CrewEntity({ ...BASE, status: 'ACTIVE', leaderUserId: '33333333-3333-4333-8333-333333333333' });
    e.updateDetails({ name: 'Đội Beta' });
    expect(e.name).toBe('Đội Beta');
    expect(() => e.updateDetails({ name: '' })).toThrow();
    e.setLeaderUserId('44444444-4444-4444-8444-444444444444');
    expect(e.leaderUserId).toBe('44444444-4444-4444-8444-444444444444');
    expect(() => e.setLeaderUserId('bad')).toThrow('Trưởng nhóm không hợp lệ');
  });
});
