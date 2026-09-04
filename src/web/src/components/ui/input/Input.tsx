import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError, className, style, ...props },
  ref,
) {
  const cls = ['bf-input', className].filter(Boolean).join(' ');
  return (
    <input
      ref={ref}
      className={cls}
      style={style}
      aria-invalid={hasError ? true : undefined}
      {...props}
    />
  );
});
