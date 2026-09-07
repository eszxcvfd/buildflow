import { ProjectEntity } from './project.entity';

const BASE = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'PRJ-001',
  name: 'Dự án A',
  description: null,
  address: '123 Đường Láng, Hà Nội',
  timezone: 'Asia/Ho_Chi_Minh',
  plannedStartDate: '2026-09-01',
  plannedEndDate: '2026-12-31',
  managerId: '22222222-2222-4222-8222-222222222222',
  status: 'DRAFT' as const,
  createdBy: '33333333-3333-4333-8333-333333333333',
  createdAt: new Date('2026-09-07T00:00:00.000Z'),
  updatedAt: new Date('2026-09-07T00:00:00.000Z'),
};

describe('ProjectEntity PRJ-SRS-001 (issue #32)', () => {
  it('happy: tạo entity hợp lệ, toPublic đủ trường', () => {
    const e = new ProjectEntity({ ...BASE });
    const pub = e.toPublic();
    expect(pub.code).toBe('PRJ-001');
    expect(pub.status).toBe('DRAFT');
    expect(pub.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(pub.plannedStartDate).toBe('2026-09-01');
  });

  it('invariant code: rỗng / quá ngắn / sai format → throw', () => {
    expect(() => new ProjectEntity({ ...BASE, code: '' })).toThrow();
    expect(() => new ProjectEntity({ ...BASE, code: 'A' })).toThrow(/2 đến 50/);
    expect(() => new ProjectEntity({ ...BASE, code: 'PRJ 001!' })).toThrow(/chữ, số/);
  });

  it('invariant required: name/address rỗng → throw', () => {
    expect(() => new ProjectEntity({ ...BASE, name: '  ' })).toThrow(/Tên dự án/);
    expect(() => new ProjectEntity({ ...BASE, address: '' })).toThrow(/Địa chỉ/);
  });

  it('invariant dates: end < start → throw; sai format → throw', () => {
    expect(
      () => new ProjectEntity({ ...BASE, plannedStartDate: '2026-12-31', plannedEndDate: '2026-01-01' }),
    ).toThrow(/từ ngày bắt đầu/);
    expect(() => new ProjectEntity({ ...BASE, plannedEndDate: '2026-02-30' })).toThrow();
  });

  it('updateDetails: đổi field trong whitelist + cập nhật updatedAt', () => {
    const e = new ProjectEntity({ ...BASE });
    e.updateDetails({ name: 'Dự án B', managerId: '44444444-4444-4444-8444-444444444444' }, new Date('2026-09-08T00:00:00.000Z'));
    expect(e.name).toBe('Dự án B');
    expect(e.managerId).toBe('44444444-4444-4444-8444-444444444444');
    expect(e.updatedAt.toISOString()).toBe('2026-09-08T00:00:00.000Z');
    // code bất biến: không có setter — vẫn giữ nguyên
    expect(e.code).toBe('PRJ-001');
  });

  it('updateDetails: dates vi phạm (end < start hiệu lực) → throw, state giữ nguyên', () => {
    const e = new ProjectEntity({ ...BASE });
    expect(() => e.updateDetails({ plannedEndDate: '2026-01-01' })).toThrow();
    expect(e.plannedEndDate).toBe('2026-12-31');
  });

  it('description optional ≤2000; timezone default khi rỗng', () => {
    const e = new ProjectEntity({ ...BASE, description: '  ', timezone: '' });
    expect(e.description).toBeNull();
    expect(e.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(() => new ProjectEntity({ ...BASE, description: 'x'.repeat(2001) })).toThrow(/2000/);
  });
});

describe('ProjectEntity.changeStatus PRJ-SRS-002 (issue #33, L1)', () => {
  it('chuyển đổi hợp lệ đổi status + updatedAt', () => {
    const e = new ProjectEntity({ ...BASE });
    e.changeStatus('ACTIVE', new Date('2026-09-08T00:00:00.000Z'));
    expect(e.status).toBe('ACTIVE');
    expect(e.updatedAt.toISOString()).toBe('2026-09-08T00:00:00.000Z');
  });

  it('invalid jump (DRAFT → PAUSED) → throw, state giữ nguyên', () => {
    const e = new ProjectEntity({ ...BASE });
    expect(() => e.changeStatus('PAUSED')).toThrow(/DRAFT.*PAUSED/);
    expect(e.status).toBe('DRAFT');
  });
});
