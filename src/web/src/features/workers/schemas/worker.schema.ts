export interface WorkerFormValues {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  employeeCode: string;
  tradeId: string;
  skillLevel: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateWorkerCreate(values: WorkerFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const email = values.email.trim();
  if (!email) fieldErrors.email = ['Email không được để trống'];
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = ['Email không hợp lệ'];
  else if (email.length > 255) fieldErrors.email = ['Email tối đa 255 ký tự'];

  if (!values.password || values.password.length < 8) fieldErrors.password = ['Mật khẩu tối thiểu 8 ký tự'];
  else if (values.password.length > 128) fieldErrors.password = ['Mật khẩu tối đa 128 ký tự'];

  const fullName = values.fullName.trim();
  if (!fullName) fieldErrors.fullName = ['Họ tên không được để trống'];
  else if (fullName.length > 150) fieldErrors.fullName = ['Họ tên tối đa 150 ký tự'];

  if (values.phone && values.phone.trim().length > 20) fieldErrors.phone = ['Số điện thoại tối đa 20 ký tự'];

  if (values.employeeCode && values.employeeCode.trim().length > 50) fieldErrors.employeeCode = ['Mã nhân viên tối đa 50 ký tự'];

  if (values.tradeId) {
    if (!UUID_V4_RE.test(values.tradeId.trim())) fieldErrors.tradeId = ['Trade ID không hợp lệ'];
    const lvl = Number(values.skillLevel);
    if (!values.skillLevel || !Number.isInteger(lvl) || lvl < 1 || lvl > 5) fieldErrors.skillLevel = ['Skill level phải là số nguyên 1-5'];
  } else if (values.skillLevel) {
    fieldErrors.tradeId = ['Cần chọn Trade khi nhập skill'];
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateWorkerUpdate(values: Partial<WorkerFormValues>): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  if (values.fullName !== undefined) {
    const v = values.fullName.trim();
    if (!v) fieldErrors.fullName = ['Họ tên không được để trống'];
    else if (v.length > 150) fieldErrors.fullName = ['Họ tên tối đa 150 ký tự'];
  }
  if (values.phone !== undefined && values.phone.trim().length > 20) fieldErrors.phone = ['Số điện thoại tối đa 20 ký tự'];
  if (values.employeeCode !== undefined && values.employeeCode.trim().length > 50) fieldErrors.employeeCode = ['Mã nhân viên tối đa 50 ký tự'];
  if (values.tradeId !== undefined && values.tradeId) {
    if (!UUID_V4_RE.test(values.tradeId.trim())) fieldErrors.tradeId = ['Trade ID không hợp lệ'];
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
