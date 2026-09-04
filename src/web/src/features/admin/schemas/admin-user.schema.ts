export interface AdminUserFormValues {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  employeeCode: string;
  userType: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\-\s().]{5,18}[0-9]$/;

export function validateAdminUserCreate(values: AdminUserFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const email = values.email.trim().toLowerCase();
  if (!email) fieldErrors.email = ['Email không được để trống'];
  else if (!EMAIL_RE.test(email)) fieldErrors.email = ['Email không hợp lệ'];
  else if (email.length > 255) fieldErrors.email = ['Email tối đa 255 ký tự'];

  if (!values.password) fieldErrors.password = ['Mật khẩu không được để trống'];
  else if (values.password.length < 8) fieldErrors.password = ['Mật khẩu tối thiểu 8 ký tự'];
  else if (values.password.length > 128) fieldErrors.password = ['Mật khẩu tối đa 128 ký tự'];

  const fullName = values.fullName.trim();
  if (!fullName) fieldErrors.fullName = ['Họ tên không được để trống'];
  else if (fullName.length > 150) fieldErrors.fullName = ['Họ tên tối đa 150 ký tự'];

  if (values.phone.trim()) {
    if (values.phone.trim().length > 20) fieldErrors.phone = ['Số điện thoại tối đa 20 ký tự'];
    else if (!PHONE_RE.test(values.phone.trim())) fieldErrors.phone = ['Số điện thoại không hợp lệ'];
  }

  if (values.employeeCode.trim() && values.employeeCode.trim().length > 50) {
    fieldErrors.employeeCode = ['Mã nhân viên tối đa 50 ký tự'];
  }

  if (!values.userType) fieldErrors.userType = ['Loại tài khoản không được để trống'];
  else if (!['STAFF', 'WORKER'].includes(values.userType)) fieldErrors.userType = ['Loại tài khoản phải là STAFF hoặc WORKER'];

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateAdminUserUpdate(values: Omit<AdminUserFormValues, 'password'>): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const email = values.email.trim().toLowerCase();
  if (!email) fieldErrors.email = ['Email không được để trống'];
  else if (!EMAIL_RE.test(email)) fieldErrors.email = ['Email không hợp lệ'];
  else if (email.length > 255) fieldErrors.email = ['Email tối đa 255 ký tự'];

  const fullName = values.fullName.trim();
  if (!fullName) fieldErrors.fullName = ['Họ tên không được để trống'];
  else if (fullName.length > 150) fieldErrors.fullName = ['Họ tên tối đa 150 ký tự'];

  if (values.phone.trim()) {
    if (values.phone.trim().length > 20) fieldErrors.phone = ['Số điện thoại tối đa 20 ký tự'];
    else if (!PHONE_RE.test(values.phone.trim())) fieldErrors.phone = ['Số điện thoại không hợp lệ'];
  }

  if (values.employeeCode.trim() && values.employeeCode.trim().length > 50) {
    fieldErrors.employeeCode = ['Mã nhân viên tối đa 50 ký tự'];
  }

  if (!values.userType) fieldErrors.userType = ['Loại tài khoản không được để trống'];
  else if (!['STAFF', 'WORKER'].includes(values.userType)) fieldErrors.userType = ['Loại tài khoản phải là STAFF hoặc WORKER'];

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
