import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError, style, ...props },
  ref,
) {
  const base: React.CSSProperties = {
    width: '100%',
    borderRadius: 8,
    border: `1px solid ${hasError ? '#ef4444' : '#d1d5db'}`,
    padding: '0.6rem 0.75rem',
    fontSize: '0.95rem',
    outline: 'none',
    background: '#fff',
  };
  return <input ref={ref} style={{ ...base, ...style }} aria-invalid={hasError ? true : undefined} {...props} />;
});
