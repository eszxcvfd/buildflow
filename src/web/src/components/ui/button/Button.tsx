import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  loading,
  children,
  disabled,
  className,
  style,
  ...props
}: ButtonProps) {
  const cls = ['bf-btn', `bf-btn-${variant}`, className].filter(Boolean).join(' ');
  return (
    <button
      className={cls}
      style={style}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Đang xử lý…' : children}
    </button>
  );
}
