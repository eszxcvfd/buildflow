'use client';

import * as React from 'react';
import { requestPasswordReset } from '@/lib/api/password';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Email không được để trống'); return; }
    setSubmitting(true);
    try {
      const out = await requestPasswordReset(email.trim());
      setDone(true);
      setDevResetUrl(out.resetUrl ?? null);
    } catch {
      setError('Gửi yêu cầu thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Quên mật khẩu</h1>
      {done ? (
        <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem' }}>
          <p style={{ margin: 0, color: '#166534' }}>Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.</p>
          {devResetUrl ? (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              Môi trường demo chưa cấu hình email — dùng link đặt lại: <a href={devResetUrl} style={{ color: '#1d4ed8', textDecoration: 'underline', wordBreak: 'break-all' }}>{devResetUrl}</a>
            </p>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
          {error ? <p role="alert" style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}
          <div>
            <label htmlFor="fp-email" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Email</label>
            <input id="fp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} placeholder="name@company.com" />
          </div>
          <button type="submit" disabled={submitting}
            style={{ background: submitting ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Đang gửi…' : 'Gửi hướng dẫn đặt lại'}
          </button>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Quay lại đăng nhập</a>
          </p>
        </form>
      )}
    </main>
  );
}

