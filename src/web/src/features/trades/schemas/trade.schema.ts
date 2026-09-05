export interface TradeFormValues {
  code: string;
  name: string;
  description: string;
  status: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const CODE_RE = /^[A-Za-z0-9_-]+$/;

export function validateTradeCreate(values: TradeFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const code = values.code.trim();
  if (!code) fieldErrors.code = ['Mã ngành nghề không được để trống'];
  else if (code.length < 2 || code.length > 50) fieldErrors.code = ['Mã ngành nghề phải từ 2 đến 50 ký tự'];
  else if (!CODE_RE.test(code)) fieldErrors.code = ['Mã ngành nghề chỉ cho phép chữ, số, _ và -'];

  const name = values.name.trim();
  if (!name) fieldErrors.name = ['Tên ngành nghề không được để trống'];
  else if (name.length > 120) fieldErrors.name = ['Tên ngành nghề tối đa 120 ký tự'];

  if (values.description && values.description.trim().length > 500) {
    fieldErrors.description = ['Mô tả ngành nghề tối đa 500 ký tự'];
  }

  if (values.status && !['ACTIVE', 'INACTIVE'].includes(values.status)) {
    fieldErrors.status = ['Trạng thái không hợp lệ'];
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateTradeUpdate(values: Partial<TradeFormValues>): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  if (values.code !== undefined) {
    const v = values.code.trim();
    if (!v) fieldErrors.code = ['Mã ngành nghề không được để trống'];
    else if (v.length < 2 || v.length > 50) fieldErrors.code = ['Mã ngành nghề phải từ 2 đến 50 ký tự'];
    else if (!CODE_RE.test(v)) fieldErrors.code = ['Mã ngành nghề chỉ cho phép chữ, số, _ và -'];
  }
  if (values.name !== undefined) {
    const v = values.name.trim();
    if (!v) fieldErrors.name = ['Tên ngành nghề không được để trống'];
    else if (v.length > 120) fieldErrors.name = ['Tên ngành nghề tối đa 120 ký tự'];
  }
  if (values.description !== undefined && values.description && values.description.trim().length > 500) {
    fieldErrors.description = ['Mô tả ngành nghề tối đa 500 ký tự'];
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
