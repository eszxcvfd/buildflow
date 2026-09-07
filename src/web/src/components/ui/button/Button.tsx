import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Control density: `md` (default) or compact `sm`. */
  size?: 'sm' | 'md';
  /**
   * Square icon-only button. Callers MUST pass a descriptive `aria-label`
   * (the button has no visible text for assistive technology otherwise).
   */
  iconOnly?: boolean;
  loading?: boolean;
}

const variantClass: Record<NonNullable<ButtonProps['variant']>, string> = {
  // DashCode look: primary-500 fill, 4px radius, subtle shadow.
  primary:
    'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white border border-transparent shadow-sm',
  secondary:
    'bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 border border-gray-300 shadow-sm',
  ghost: 'bg-transparent hover:bg-primary-50 text-primary-600 border border-transparent shadow-none',
};

/**
 * DashCode stage 2 — plain button (Ark UI ships no Button primitive) with
 * tokenized Tailwind classes. `.bf-btn*` names are kept for the class
 * contract; public props/exports are unchanged.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  iconOnly,
  loading,
  children,
  disabled,
  className,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'bf-btn',
        `bf-btn-${variant}`,
        'inline-flex items-center justify-center gap-2 rounded-[4px] text-sm font-medium',
        size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-4 py-2',
        iconOnly && (size === 'sm' ? 'h-7 w-7 px-0' : 'h-9 w-9 px-0'),
        'transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variantClass[variant],
        className,
      )}
      style={style}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          Đang xử lý…
        </>
      ) : (
        children
      )}
    </button>
  );
}
