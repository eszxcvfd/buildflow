import { validateProjectCreate, validateProjectUpdate } from './project.schema';

function validCreate() {
  return {
    code: 'PRJ-001',
    name: 'Khu dan cu Binh Minh',
    address: 'So 1, duong A',
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    managerId: '11111111-1111-4111-8111-111111111111',
    description: '',
    timezone: 'Asia/Ho_Chi_Minh',
  };
}

describe('project.schema PRJ-SRS-001 (issue #32)', () => {
  it('create hợp lệ', () => {
    expect(validateProjectCreate(validCreate()).valid).toBe(true);
  });

  it('code 2-50 ^[A-Za-z0-9_-]+$ (create only)', () => {
    expect(validateProjectCreate({ ...validCreate(), code: '' }).fieldErrors.code).toBeTruthy();
    expect(validateProjectCreate({ ...validCreate(), code: 'A' }).fieldErrors.code).toBeTruthy();
    expect(validateProjectCreate({ ...validCreate(), code: 'PRJ 001!' }).fieldErrors.code).toBeTruthy();
    expect(validateProjectCreate({ ...validCreate(), code: 'PRJ-001_x' }).valid).toBe(true);
  });

  it('name/address/dates/managerId bắt buộc khi tạo', () => {
    const r = validateProjectCreate({
      ...validCreate(), name: ' ', address: '', plannedStartDate: '', plannedEndDate: '', managerId: '',
    });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.name).toBeTruthy();
    expect(r.fieldErrors.address).toBeTruthy();
    expect(r.fieldErrors.plannedStartDate).toBeTruthy();
    expect(r.fieldErrors.plannedEndDate).toBeTruthy();
    expect(r.fieldErrors.managerId).toBeTruthy();
  });

  it('end < start → lỗi plannedEndDate (client rule mới)', () => {
    const r = validateProjectCreate({ ...validCreate(), plannedStartDate: '2026-06-01', plannedEndDate: '2026-05-31' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.plannedEndDate).toEqual(['Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi']);
    expect(validateProjectCreate({ ...validCreate(), plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-01' }).valid).toBe(true);
  });

  it('name 1 ký tự hợp lệ (đồng nhất server 1-200)', () => {
    expect(validateProjectCreate({ ...validCreate(), name: 'A' }).valid).toBe(true);
    expect(validateProjectCreate({ ...validCreate(), name: 'x'.repeat(201) }).fieldErrors.name).toBeTruthy();
  });

  it('description tối đa 2000 ký tự', () => {
    expect(validateProjectCreate({ ...validCreate(), description: 'x'.repeat(2001) }).fieldErrors.description).toBeTruthy();
    expect(validateProjectCreate({ ...validCreate(), description: 'x'.repeat(2000) }).valid).toBe(true);
  });

  it('update: partial, không check code, chỉ validate field có mặt', () => {
    expect(validateProjectUpdate({}).valid).toBe(true);
    expect(validateProjectUpdate({ code: 'DU-LIEU-CU' }).valid).toBe(true);
    const r = validateProjectUpdate({ name: ' ', plannedStartDate: '2026-06-01', plannedEndDate: '2026-05-01' });
    expect(r.fieldErrors.name).toBeTruthy();
    expect(r.fieldErrors.plannedEndDate).toBeTruthy();
  });
});
