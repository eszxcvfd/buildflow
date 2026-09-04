export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordPolicyResult {
  ok: boolean;
  errors: string[];
}

/**
 * IAM-SRS-007 password policy: min 8, max 128, at least one letter and one digit.
 * Mirrors create-user DTO rule (min 8) and adds complexity hints per SRS policy requirement.
 */
export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const errors: string[] = [];
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    errors.push('Mật khẩu tối thiểu 8 ký tự');
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push('Mật khẩu tối đa 128 ký tự');
  }
  if (!/[A-Za-z]/.test(password)) {
    errors.push('Mật khẩu phải chứa ít nhất một chữ cái');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Mật khẩu phải chứa ít nhất một chữ số');
  }
  return { ok: errors.length === 0, errors };
}
