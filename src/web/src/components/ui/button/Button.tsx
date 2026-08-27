import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}

export function Button({ variant = 'primary', loading, children, disabled, style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    appearance: 'none',
    borderRadius: 8,
    border: variant === 'ghost' ? '1px solid #e5e7eb' : '1px solid transparent',
    padding: '0.6rem 1rem',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1,
    transition: 'background 120ms, border-color 120ms',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: '#111827', color: '#fff' },
    secondary: { background: '#f3f4f6', color: '#111827', borderColor: '#e5e7eb' },
    ghost: { background: '#fff', color: '#111827' },
  };

  return (
    <button style={{ ...base, ...variants[variant], ...style }} disabled={disabled || loading} {...props}>
      {loading ? 'Đang xử lý…' : children}
    </button>
  );
}
