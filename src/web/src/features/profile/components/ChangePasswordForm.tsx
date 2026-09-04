'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, type PasswordActionError } from '@/lib/api/password';
import { getAuth, clearAuth, isTokenExpired } from '@/lib/auth/storage';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
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

  function fieldError(name: string) {
    return fieldErrors[name] ? <span style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: 2, display: 'block' }}>{fieldErrors[name].join(' ')}</span> : null;
  }

  if (!authChecked) return null;

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Đổi mật khẩu</h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>{POLICY_HINT}</p>
        </div>
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}
        <div>
          <label htmlFor="cp-current" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Mật khẩu hiện tại</label>
          <input id="cp-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={submitting}
            style={{ width: '100%', border: fieldErrors.currentPassword ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
          {fieldError('currentPassword')}
        </div>
        <div>
          <label htmlFor="cp-new" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Mật khẩu mới</label>
          <input id="cp-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={submitting}
            style={{ width: '100%', border: fieldErrors.newPassword ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
          {fieldError('newPassword')}
        </div>
        <div>
          <label htmlFor="cp-confirm" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Xác nhận mật khẩu mới</label>
          <input id="cp-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={submitting}
            style={{ width: '100%', border: fieldErrors.confirmPassword ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
          {fieldError('confirmPassword')}
        </div>
        <div>
          <Button type="submit" loading={submitting} disabled={submitting}>
            {submitting ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
