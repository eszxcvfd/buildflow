"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { loginAndPersist } from '@/features/auth/services/auth.service';
import type { LoginError } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = 'Email không được để trống';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) errors.email = 'Email không hợp lệ';
    if (!password) errors.password = 'Mật khẩu không được để trống';
    else if (password.length > 128) errors.password = 'Mật khẩu tối đa 128 ký tự';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await loginAndPersist(email, password);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const loginError = err as LoginError;
      setGlobalError(loginError.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
        <h1 className="text-2xl font-semibold mb-1">Đăng nhập</h1>
        <p className="text-sm text-neutral-500 mb-6">Sử dụng email và mật khẩu để truy cập hệ thống.</p>

        {globalError ? (
          <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {globalError}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {fieldErrors.email ? (
              <p id="email-error" role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {fieldErrors.password ? (
              <p id="password-error" role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full rounded-md bg-blue-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <p className="text-xs text-neutral-500">
            Tài khoản bị khóa hoặc ngừng hoạt động sẽ bị từ chối; thông báo lỗi không tiết lộ tồn tại tài khoản (IAM-SRS-001).
          </p>
        </form>
      </div>
    </main>
  );
}
