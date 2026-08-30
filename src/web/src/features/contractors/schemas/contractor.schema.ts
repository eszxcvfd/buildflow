export interface ContractorFormValues {
  code: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  scope: string;
  status: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const CODE_RE = /^[A-Za-z0-9_-]+$/;

export function validateContractorCreate(values: ContractorFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const code = values.code.trim();
  if (!code) fieldErrors.code = ['Mã nhà thầu không được để trống'];
  else if (code.length < 2 || code.length > 50) fieldErrors.code = ['Mã nhà thầu phải từ 2 đến 50 ký tự'];
  else if (!CODE_RE.test(code)) fieldErrors.code = ['Mã nhà thầu chỉ cho phép chữ, số, _ và -'];

  const name = values.name.trim();
  if (!name) fieldErrors.name = ['Tên nhà thầu không được để trống'];
  else if (name.length < 2) fieldErrors.name = ['Tên nhà thầu tối thiểu 2 ký tự'];
  else if (name.length > 200) fieldErrors.name = ['Tên nhà thầu tối đa 200 ký tự'];

  const contactName = values.contactName.trim();
  if (!contactName) fieldErrors.contactName = ['Thông tin liên hệ không được để trống'];
  else if (contactName.length > 150) fieldErrors.contactName = ['Tên liên hệ tối đa 150 ký tự'];

  const scope = values.scope.trim();
  if (!scope) fieldErrors.scope = ['Phạm vi công việc không được để trống'];
  else if (scope.length > 1000) fieldErrors.scope = ['Phạm vi công việc tối đa 1000 ký tự'];

  if (values.phone && values.phone.trim().length > 20) fieldErrors.phone = ['Số điện thoại tối đa 20 ký tự'];
  else if (values.phone && values.phone.trim()) {
    const digitsOnly = values.phone.trim().replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(digitsOnly)) fieldErrors.phone = ['Số điện thoại không hợp lệ'];
  }

  if (values.email && values.email.trim()) {
    const email = values.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = ['Email không hợp lệ'];
    else if (email.length > 255) fieldErrors.email = ['Email tối đa 255 ký tự'];
  }

  if (values.status && !['ACTIVE', 'INACTIVE'].includes(values.status)) fieldErrors.status = ['Trạng thái không hợp lệ'];

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateContractorUpdate(values: Partial<ContractorFormValues>): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  if (values.code !== undefined) {
    const v = values.code.trim();
    if (!v) fieldErrors.code = ['Mã nhà thầu không được để trống'];
    else if (v.length < 2 || v.length > 50) fieldErrors.code = ['Mã nhà thầu phải từ 2 đến 50 ký tự'];
    else if (!CODE_RE.test(v)) fieldErrors.code = ['Mã nhà thầu chỉ cho phép chữ, số, _ và -'];
  }
  if (values.name !== undefined) {
    const v = values.name.trim();
    if (!v) fieldErrors.name = ['Tên nhà thầu không được để trống'];
    else if (v.length < 2 || v.length > 200) fieldErrors.name = ['Tên nhà thầu phải từ 2 đến 200 ký tự'];
  }
  if (values.contactName !== undefined) {
    const v = values.contactName.trim();
    if (!v) fieldErrors.contactName = ['Thông tin liên hệ không được để trống'];
    else if (v.length > 150) fieldErrors.contactName = ['Tên liên hệ tối đa 150 ký tự'];
  }
  if (values.scope !== undefined) {
    const v = values.scope.trim();
    if (!v) fieldErrors.scope = ['Phạm vi công việc không được để trống'];
    else if (v.length > 1000) fieldErrors.scope = ['Phạm vi công việc tối đa 1000 ký tự'];
  }
  if (values.phone !== undefined && values.phone.trim().length > 20) fieldErrors.phone = ['Số điện thoại tối đa 20 ký tự'];
  if (values.email !== undefined && values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) fieldErrors.email = ['Email không hợp lệ'];

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
