'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, type PasswordActionError } from '@/lib/api/password';

export default function ResetPasswordPage() {
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
      await confirmPasswordReset(token, newPassword);
      setDone(true);
      setTimeout(() => router.replace('/login?reason=password-reset'), 2500);
    } catch (err) {
      const e = err as PasswordActionError;
      setGlobalError(e.message || 'Đặt lại mật khẩu thất bại');
      if (e.fieldErrors) setFieldErrors(e.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(name: string) {
    return fieldErrors[name] ? <span style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: 2, display: 'block' }}>{fieldErrors[name].join(' ')}</span> : null;
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Đặt lại mật khẩu</h1>
      {done ? (
        <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem' }}>
          <p style={{ margin: 0, color: '#166534' }}>Đổi mật khẩu thành công. Đang chuyển đến trang đăng nhập…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
          {globalError ? <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{globalError}</p> : null}
          {!token ? <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>Link không chứa token đặt lại. Vui lòng dùng link mới từ email.</p> : null}
          <div>
            <label htmlFor="rp-new" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Mật khẩu mới</label>
            <input id="rp-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={submitting || !token}
              style={{ width: '100%', border: fieldErrors.newPassword ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
            {fieldError('newPassword')}
          </div>
          <div>
            <label htmlFor="rp-confirm" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Xác nhận mật khẩu mới</label>
            <input id="rp-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={submitting || !token}
              style={{ width: '100%', border: fieldErrors.confirmPassword ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
            {fieldError('confirmPassword')}
          </div>
          <button type="submit" disabled={submitting || !token}
            style={{ background: submitting || !token ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
          </button>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Quay lại đăng nhập</a>
          </p>
        </form>
      )}
    </main>
  );
}
