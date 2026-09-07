export interface ProjectFormValues {
  code: string;
  name: string;
  address: string;
  plannedStartDate: string;
  plannedEndDate: string;
  managerId: string;
  description: string;
  timezone: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const CODE_RE = /^[A-Za-z0-9_-]+$/;

/** So sánh ngày YYYY-MM-DD theo chuỗi (cùng định dạng ISO date-only). */
function isEndBeforeStart(start: string, end: string): boolean {
  return end < start;
}

function validateCommon(
  values: Partial<ProjectFormValues>,
  opts: { checkCode: boolean; checkRequired: boolean },
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  if (opts.checkCode || values.code !== undefined) {
    const code = (values.code ?? '').trim();
    if (!code) {
      if (opts.checkRequired || (values.code !== undefined && code === '')) {
        fieldErrors.code = ['Mã dự án không được để trống'];
      }
    } else if (code.length < 2 || code.length > 50) {
      fieldErrors.code = ['Mã dự án phải từ 2 đến 50 ký tự'];
    } else if (!CODE_RE.test(code)) {
      fieldErrors.code = ['Mã dự án chỉ cho phép chữ, số, _ và -'];
    }
  }

  if (values.name !== undefined || opts.checkRequired) {
    const name = (values.name ?? '').trim();
    if (!name) fieldErrors.name = ['Tên dự án không được để trống'];
    else if (name.length > 200) fieldErrors.name = ['Tên dự án tối đa 200 ký tự'];
  }

  if (values.address !== undefined || opts.checkRequired) {
    const address = (values.address ?? '').trim();
    if (!address) fieldErrors.address = ['Địa chỉ dự án không được để trống'];
    else if (address.length > 500) fieldErrors.address = ['Địa chỉ dự án tối đa 500 ký tự'];
  }

  if (values.plannedStartDate !== undefined || opts.checkRequired) {
    const start = (values.plannedStartDate ?? '').trim();
    if (!start) fieldErrors.plannedStartDate = ['Ngày bắt đầu kế hoạch không được để trống'];
  }

  if (values.plannedEndDate !== undefined || opts.checkRequired) {
    const end = (values.plannedEndDate ?? '').trim();
    if (!end) fieldErrors.plannedEndDate = ['Ngày kết thúc kế hoạch không được để trống'];
  }

  // Client rule (mới ở web slice): ngày kết thúc >= ngày bắt đầu.
  const start = (values.plannedStartDate ?? '').trim();
  const end = (values.plannedEndDate ?? '').trim();
  if (start && end && !fieldErrors.plannedStartDate && !fieldErrors.plannedEndDate) {
    if (isEndBeforeStart(start, end)) {
      fieldErrors.plannedEndDate = ['Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi'];
    }
  }

  if (values.managerId !== undefined || opts.checkRequired) {
    const managerId = (values.managerId ?? '').trim();
    if (!managerId) fieldErrors.managerId = ['Quản lý dự án không được để trống'];
  }

  if (values.description !== undefined && values.description.trim().length > 2000) {
    fieldErrors.description = ['Mô tả dự án tối đa 2000 ký tự'];
  }

  if (values.timezone !== undefined && values.timezone.trim().length > 64) {
    fieldErrors.timezone = ['Múi giờ tối đa 64 ký tự'];
  }

  return fieldErrors;
}

export function validateProjectCreate(values: ProjectFormValues): ValidationResult {
  const fieldErrors = validateCommon(values, { checkCode: true, checkRequired: true });
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateProject(values: ProjectFormValues): ValidationResult {
  return validateProjectCreate(values);
}

/** Edit: code bất biến (không validate code — form disable + payload bỏ code). */
export function validateProjectUpdate(values: Partial<ProjectFormValues>): ValidationResult {
  const { code: _ignored, ...rest } = values;
  void _ignored;
  const fieldErrors = validateCommon(rest, { checkCode: false, checkRequired: false });
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
