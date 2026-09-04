'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, type PasswordActionError } from '@/lib/api/password';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';
import { Alert } from '@/components/ui/alert/Alert';

export const POLICY_HINT = 'Mật khẩu mới tối thiểu 8 ký tự, chứa ít nhất một chữ cái và một chữ số.';

/**
 * IAM-SRS-007: reset password form.
 * - Reads token from searchParams (page wraps this in <Suspense> for the CSR bailout).
 * - Sends { token, newPassword, confirmPassword } — confirmPassword is mandatory per contract.
 * - 401 from confirm endpoint means token invalid/used/expired (not an auth session).
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    const errors: Record<string, string[]> = {};
    if (!token) errors.token = ['Link đặt lại không hợp lệ'];
    if (newPassword.length < 8) errors.newPassword = ['Mật khẩu mới tối thiểu 8 ký tự'];
    else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) errors.newPassword = ['Mật khẩu mới phải chứa ít nhất một chữ cái và một chữ số'];
    if (confirmPassword !== newPassword) errors.confirmPassword = ['Xác nhận mật khẩu không khớp'];
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, newPassword, confirmPassword);
      setDone(true);
      router.replace('/login?reason=password-reset');
    } catch (err) {
      const e = err as PasswordActionError;
      setGlobalError(e.message || 'Đặt lại mật khẩu thất bại');
      if (e.fieldErrors) setFieldErrors(e.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(name: string, id?: string) {
    return fieldErrors[name] ? (
      <span id={id} role="alert" className="bf-field-error">
        {fieldErrors[name].join(' ')}
      </span>
    ) : null;
  }

  return (
    <Card>
      <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
        <h1 className="bf-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
          Đặt lại mật khẩu
        </h1>
        <p className="bf-card-meta" style={{ margin: 0 }}>
          {POLICY_HINT}
        </p>
      </div>

      {done ? (
        <Alert tone="success">Đổi mật khẩu thành công. Đang chuyển đến trang đăng nhập…</Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14 }}>
          {globalError ? <Alert tone="error">{globalError}</Alert> : null}
          {!token ? (
            <Alert tone="error">Link không chứa token đặt lại. Vui lòng dùng link mới từ email.</Alert>
          ) : null}
          <div className="bf-field">
            <label htmlFor="rp-new" className="bf-label">
              Mật khẩu mới
            </label>
            <Input
              id="rp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting || !token}
              hasError={Boolean(fieldErrors.newPassword)}
              aria-describedby={fieldErrors.newPassword ? 'rp-new-error' : undefined}
            />
            {fieldError('newPassword', 'rp-new-error')}
          </div>
          <div className="bf-field">
            <label htmlFor="rp-confirm" className="bf-label">
              Xác nhận mật khẩu mới
            </label>
            <Input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting || !token}
              hasError={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={fieldErrors.confirmPassword ? 'rp-confirm-error' : undefined}
            />
            {fieldError('confirmPassword', 'rp-confirm-error')}
          </div>
          <button
            type="submit"
            className="bf-btn bf-btn-primary"
            disabled={submitting || !token}
            aria-busy={submitting || undefined}
            style={{ width: '100%' }}
          >
            {submitting ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
          </button>
          <p className="bf-card-meta" style={{ margin: 0 }}>
            <a href="/login">Quay lại đăng nhập</a>
          </p>
        </form>
      )}
    </Card>
  );
}
