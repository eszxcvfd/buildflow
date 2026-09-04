import { validateAdminUserCreate, validateAdminUserUpdate } from './admin-user.schema';

describe('validateAdminUserCreate (IAM-SRS-004)', () => {
  const valid = {
    email: 'a@b.com',
    password: 'Password123',
    fullName: 'Nguyen Van A',
    phone: '',
    employeeCode: '',
    userType: 'STAFF',
  };

  it('accepts a valid payload', () => {
    expect(validateAdminUserCreate(valid).valid).toBe(true);
  });

  it('rejects invalid email formats', () => {
    const r = validateAdminUserCreate({ ...valid, email: 'not-an-email' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.email).toBeTruthy();
  });

  it('rejects short passwords', () => {
    const r = validateAdminUserCreate({ ...valid, password: '1234567' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.password).toEqual(['Mật khẩu tối thiểu 8 ký tự']);
  });

  it('rejects empty fullName', () => {
    const r = validateAdminUserCreate({ ...valid, fullName: '  ' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.fullName).toBeTruthy();
  });

  it('rejects invalid phone when provided', () => {
    const r = validateAdminUserCreate({ ...valid, phone: 'abc123!@#' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.phone).toBeTruthy();
  });

  it('rejects unknown userType', () => {
    const r = validateAdminUserCreate({ ...valid, userType: 'ADMIN' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.userType).toBeTruthy();
  });
});

describe('validateAdminUserUpdate (IAM-SRS-004)', () => {
  const valid = {
    email: 'a@b.com',
    fullName: 'Nguyen Van A',
    phone: '0901234567',
    employeeCode: 'EMP-1',
    userType: 'WORKER',
  };

  it('accepts a valid update payload', () => {
    expect(validateAdminUserUpdate(valid).valid).toBe(true);
  });

  it('rejects duplicate-password-free email absence', () => {
    const r = validateAdminUserUpdate({ ...valid, email: '' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.email).toBeTruthy();
  });

  it('rejects invalid phone in update', () => {
    const r = validateAdminUserUpdate({ ...valid, phone: '+++' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.phone).toBeTruthy();
  });
});
