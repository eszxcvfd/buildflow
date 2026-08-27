import type { LoginFormValues } from '@/features/auth/types/auth';

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(values: LoginFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const email = values.email?.trim() ?? '';
  const password = values.password ?? '';

  if (!email) {
    fieldErrors.email = ['Email không được để trống'];
  } else if (!EMAIL_RE.test(email)) {
    fieldErrors.email = ['Email không hợp lệ'];
  } else if (email.length > 255) {
    fieldErrors.email = ['Email tối đa 255 ký tự'];
  }

  if (!password) {
    fieldErrors.password = ['Mật khẩu không được để trống'];
  } else if (password.length > 128) {
    fieldErrors.password = ['Mật khẩu tối đa 128 ký tự'];
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
