'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login, storeToken, ApiError } from '@/lib/api/auth-client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('worker1@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login({ email: email.trim().toLowerCase(), password });
      storeToken(result.token);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError) {
        // Generic error is already safe to display; problem-details detail is user-facing
        setError(err.problem.detail ?? err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Login form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360 }}>
      <div>
        <label htmlFor="email" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
      </div>
      <div>
        <label htmlFor="password" style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
        />
      </div>
      {error && (
        <div role="alert" style={{ color: '#a00', background: '#fee', padding: '0.5rem', borderRadius: 4 }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '0.6rem 1rem',
          background: loading ? '#888' : '#111',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: loading ? 'wait' : 'pointer',
          fontWeight: 600,
        }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        Demo accounts: <code>worker1@example.com / Password123!</code> or <code>worker2@example.com / Password123!</code>
      </p>
    </form>
  );
}
