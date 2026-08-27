import * as React from 'react';

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'info' | 'success';
  children: React.ReactNode;
}) {
  const bg: Record<string, string> = {
    error: '#fef2f2',
    info: '#eff6ff',
    success: '#f0fdf4',
  };
  const border: Record<string, string> = {
    error: '#fecaca',
    info: '#bfdbfe',
    success: '#bbf7d0',
  };
  const color: Record<string, string> = {
    error: '#991b1b',
    info: '#1e40af',
    success: '#14532d',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        background: bg[tone],
        border: `1px solid ${border[tone]}`,
        color: color[tone],
        borderRadius: 8,
        padding: '0.75rem 0.875rem',
        fontSize: '0.9rem',
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}
