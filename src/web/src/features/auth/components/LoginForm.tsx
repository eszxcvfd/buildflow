'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { validateLogin } from '@/features/auth/schemas/login.schema';
import { loginAndPersist } from '@/features/auth/services/auth.service';
import type { LoginError } from '@/lib/api/auth';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);

    const validation = validateLogin({ email, password });
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await loginAndPersist(email, password);
      // Redirect to dashboard (BR-13 app shell filtered by roles/projectIds)
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const e = err as LoginError;
      // Map contract labels:
      // 400 validation may contain fieldErrors
      if (e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        const fe: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(e.fieldErrors)) {
          if (k === '_global') continue;
          fe[k] = v;
        }
        setFieldErrors(fe);
        if (e.fieldErrors._global?.length) {
          setGlobalError(e.fieldErrors._global.join(' '));
        } else if (Object.keys(fe).length === 0) {
          setGlobalError(e.message);
        }
      } else {
        // 401 generic, 403 locked/inactive, 401 token expired
        setGlobalError(e.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div style={{ display: 'grid', gap: 4 }}>
        <h1 className="bf-card-title" style={{ fontSize: '1.15rem' }}>
          Đăng nhập
        </h1>
        <p className="bf-card-meta" style={{ margin: 0 }}>
          Sử dụng email và mật khẩu để truy cập hệ thống.
        </p>
      </div>

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14 }}>
        <div className="bf-field">
          <label htmlFor="email" className="bf-label">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            hasError={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email ? (
            <p id="email-error" role="alert" className="bf-field-error" style={{ margin: 0 }}>
              {fieldErrors.email.join(' ')}
            </p>
          ) : null}
        </div>

        <div className="bf-field">
          <label htmlFor="password" className="bf-label">
            Mật khẩu
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            hasError={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password ? (
            <p id="password-error" role="alert" className="bf-field-error" style={{ margin: 0 }}>
              {fieldErrors.password.join(' ')}
            </p>
          ) : null}
        </div>

        <Button type="submit" loading={loading} aria-busy={loading} style={{ width: '100%' }}>
          Đăng nhập
        </Button>

        <p className="bf-card-meta" style={{ margin: 0 }}>
          Bằng việc đăng nhập, phiên làm việc sẽ khởi tạo theo vai trò (BR-13). Tài khoản bị khóa hoặc ngừng hoạt
          động sẽ bị từ chối; thông báo lỗi không tiết lộ tồn tại tài khoản (IAM-SRS-001).
        </p>
      </form>
    </Card>
  );
}
