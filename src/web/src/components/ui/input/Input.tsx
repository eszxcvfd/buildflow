import * as React from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError, className, style, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'bf-input',
        'w-full rounded-[4px] border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm',
        'placeholder:text-gray-400',
        'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
        hasError && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500',
        className,
      )}
      style={style}
      aria-invalid={hasError ? true : undefined}
      {...props}
    />
  );
});
