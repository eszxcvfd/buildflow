import { WorkTypeEntity, WorkTypeProps } from './work-type.entity';

function baseProps(overrides?: Partial<WorkTypeProps>): WorkTypeProps {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CONCRETE',
    name: 'Đổ bê tông',
    description: null,
    group: null,
    requiredTradeId: null,
    requiredFields: [],
    configVersion: 1,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('WorkTypeEntity (PRJ-SRS-004)', () => {
  it('tạo entity hợp lệ, status ACTIVE dùng được cho WO mới', () => {
    const e = new WorkTypeEntity(baseProps());
    expect(e.status).toBe('ACTIVE');
    expect(e.isUsableForNewWorkOrder()).toBe(true);
    expect(e.toPublic().configVersion).toBe(1);
  });

  it('reject id/code/name/configVersion sai', () => {
    expect(() => new WorkTypeEntity(baseProps({ id: 'nope' }))).toThrow('ID loại công việc không hợp lệ');
    expect(() => new WorkTypeEntity(baseProps({ code: 'x' }))).toThrow();
    expect(() => new WorkTypeEntity(baseProps({ name: '  ' }))).toThrow();
    expect(() => new WorkTypeEntity(baseProps({ configVersion: 0 }))).toThrow();
  });

  it('applyConfigUpdate đổi code/name/group/trade/requiredFields → version +1', () => {
    const e = new WorkTypeEntity(baseProps());
    const changed = e.applyConfigUpdate({ name: 'Tên mới' });
    expect(changed).toBe(true);
    expect(e.configVersion).toBe(2);
  });

  it('applyConfigUpdate chỉ đổi description/duration/priority → không bump version', () => {
    const e = new WorkTypeEntity(baseProps());
    const changed = e.applyConfigUpdate({ description: 'mô tả', defaultDurationMinutes: 60 });
    expect(changed).toBe(false);
    expect(e.configVersion).toBe(1);
    expect(e.description).toBe('mô tả');
  });

  it('changeStatus ACTIVE↔INACTIVE; same-status throw (use case map idempotent)', () => {
    const e = new WorkTypeEntity(baseProps());
    e.changeStatus('INACTIVE');
    expect(e.status).toBe('INACTIVE');
    expect(e.isUsableForNewWorkOrder()).toBe(false);
    expect(() => e.changeStatus('INACTIVE')).toThrow('đã ở trạng thái INACTIVE');
  });
});
