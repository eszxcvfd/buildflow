'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, type PasswordActionError } from '@/lib/api/password';
import { getAuth, clearAuth, isTokenExpired } from '@/lib/auth/storage';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Input } from '@/components/ui/input/Input';
import { Card } from '@/components/ui/card/Card';

const POLICY_HINT = 'Mật khẩu mới tối thiểu 8 ký tự, chứa ít nhất một chữ cái và một chữ số.';

export function ChangePasswordForm() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  // Auth guard on mount (same pattern as ProfileForm): unauthenticated/expired → login.
  React.useEffect(() => {
    const auth = getAuth();
    if (!auth || isTokenExpired(auth)) {
      router.replace('/login?reason=session-expired');
      return;
    }
    setAuthChecked(true);
  }, [router]);

  function clientValidate(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (!currentPassword) errors.currentPassword = ['Mật khẩu hiện tại không được để trống'];
    if (newPassword.length < 8) errors.newPassword = ['Mật khẩu mới tối thiểu 8 ký tự'];
    else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) errors.newPassword = ['Mật khẩu mới phải chứa ít nhất một chữ cái và một chữ số'];
    if (confirmPassword !== newPassword) errors.confirmPassword = ['Xác nhận mật khẩu không khớp'];
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    const errors = clientValidate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const auth = getAuth();
    if (!auth || isTokenExpired(auth)) {
      clearAuth();
      router.replace('/login?reason=session-expired');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(auth.accessToken, currentPassword, newPassword, confirmPassword);
      // Per SRS: after change, require re-login (session invalid)
      clearAuth();
      router.replace('/login?reason=password-changed');
    } catch (err) {
      const e = err as PasswordActionError;
      // 401 now only means dead session (not wrong currentPassword) → force re-login.
      if (e.status === 401) {
        clearAuth();
        router.replace('/login?reason=password-changed');
        return;
      }
      setGlobalError(e.message || 'Đổi mật khẩu thất bại');
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

  if (!authChecked) return null;

  return (
    <Card>
      <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
        <h2 className="bf-card-title" style={{ margin: 0 }}>
          Đổi mật khẩu
        </h2>
        <p className="bf-card-meta" style={{ margin: 0 }}>
          {POLICY_HINT}
        </p>
      </div>
      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14, marginTop: globalError ? 14 : 0 }}>
        <div className="bf-field">
          <label htmlFor="cp-current" className="bf-label">
            Mật khẩu hiện tại
          </label>
          <Input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
            hasError={Boolean(fieldErrors.currentPassword)}
            aria-describedby={fieldErrors.currentPassword ? 'cp-current-err' : undefined}
          />
          {fieldError('currentPassword', 'cp-current-err')}
        </div>
        <div className="bf-field">
          <label htmlFor="cp-new" className="bf-label">
            Mật khẩu mới
          </label>
          <Input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            hasError={Boolean(fieldErrors.newPassword)}
            aria-describedby={fieldErrors.newPassword ? 'cp-new-err' : undefined}
          />
          {fieldError('newPassword', 'cp-new-err')}
        </div>
        <div className="bf-field">
          <label htmlFor="cp-confirm" className="bf-label">
            Xác nhận mật khẩu mới
          </label>
          <Input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            hasError={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? 'cp-confirm-err' : undefined}
          />
          {fieldError('confirmPassword', 'cp-confirm-err')}
        </div>
        <div>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
