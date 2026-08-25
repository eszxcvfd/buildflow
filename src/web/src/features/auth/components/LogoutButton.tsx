'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout, getStoredToken, clearStoredToken } from '@/lib/api/auth-client';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setError(null);
    setLoading(true);
    const token = getStoredToken();
    try {
      if (token) {
        await logout(token);
      }
    } catch (e) {
      // Even if API returns 401 (already revoked), we still clear local state for idempotent UX
      // Show error only for unexpected failures
      if (e instanceof Error) {
        // If it's a 401, treat as already logged out
        const msg = e.message;
        if (msg.includes('Unauthorized') || msg.includes('401')) {
          // silent
        } else {
          setError(msg);
        }
      }
    } finally {
      clearStoredToken();
      setLoading(false);
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        aria-label="Logout"
        style={{
          padding: '0.5rem 1rem',
          background: loading ? '#888' : '#dc2626',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: loading ? 'wait' : 'pointer',
          fontWeight: 600,
        }}
      >
        {loading ? 'Logging out…' : 'Logout'}
      </button>
      {error && (
        <div role="alert" style={{ color: '#a00', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}
    </div>
  );
}
