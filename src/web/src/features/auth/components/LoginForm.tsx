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
    <Card style={{ display: 'grid', gap: 20, padding: 24 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 className="bf-card-title" style={{ fontSize: '1.25rem' }}>
          Đăng nhập
        </h1>
        <p className="bf-card-meta" style={{ margin: 0 }}>
          Sử dụng email và mật khẩu để truy cập hệ thống.
        </p>
      </div>

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 16 }}>
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

        <Button
          type="submit"
          loading={loading}
          aria-busy={loading}
          style={{ width: '100%', minHeight: 42, marginTop: 4 }}
        >
          Đăng nhập
        </Button>

        <div style={{ textAlign: 'center' }}>
          <a
            href="/forgot-password"
            style={{
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"
              />
            </svg>
            Quên mật khẩu?
          </a>
        </div>
      </form>
    </Card>
  );
}
