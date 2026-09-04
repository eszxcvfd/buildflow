'use client';

import * as React from 'react';
import { requestPasswordReset } from '@/lib/api/password';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';
import { Alert } from '@/components/ui/alert/Alert';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError('Email không được để trống'); return; }
    setSubmitting(true);
    try {
      // IAM-SRS-007 anti-enumeration: response is always a generic { message };
      // never surface resetUrl/dev links to the user.
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch {
      setError('Gửi yêu cầu thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
        <h1 className="bf-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>
          Đặt lại mật khẩu
        </h1>
        <p className="bf-card-meta" style={{ margin: 0 }}>
          Nhập email đăng nhập để nhận hướng dẫn đặt lại mật khẩu.
        </p>
      </div>

      {done ? (
        <Alert tone="success">
          <p style={{ margin: 0 }}>
            Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.
          </p>
          <p className="bf-card-meta" style={{ margin: '8px 0 0' }}>
            Nếu bạn không nhận được email, liên hệ quản trị viên.
          </p>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14 }}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="bf-field">
            <label htmlFor="fp-email" className="bf-label">
              Email
            </label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              hasError={error === 'Email không được để trống'}
            />
          </div>
          <button
            type="submit"
            className="bf-btn bf-btn-primary"
            disabled={submitting}
            aria-busy={submitting || undefined}
            style={{ width: '100%' }}
          >
            {submitting ? 'Đang gửi…' : 'Gửi hướng dẫn đặt lại'}
          </button>
          <p className="bf-card-meta" style={{ margin: 0 }}>
            <a href="/login">Quay lại đăng nhập</a>
          </p>
        </form>
      )}
    </Card>
  );
}
