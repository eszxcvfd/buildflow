import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Minh họa user-x (40–48px, slate-400) cho empty state 'không có hồ sơ'
 * (vd: /my-eligibility). Inline SVG để không thêm dependency runtime.
 */
export function EmptyProfileIcon({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="8" r="3.25" />
      <path d="M3.5 19.5c.9-3 3.2-4.75 6.5-4.75 1.4 0 2.7.35 3.75 1" />
      <path d="m17 4.5 5 5m0-5-5 5" />
    </svg>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: React.ReactNode;
  /** CTA dưới copy phụ (vd: link 'Thêm mới'). */
  action?: React.ReactNode;
  /** Minh họa phía trên text (vd: <EmptyProfileIcon /> trong vòng tròn soft). */
  icon?: React.ReactNode;
}) {
  return (
    <div className={cn('bf-empty', 'flex flex-col items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center')}>
      {icon ? (
        <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </span>
      ) : null}
      <span className={cn('bf-empty-title', 'text-sm font-semibold text-gray-800')}>{title}</span>
      {children ? <p className="m-0 text-sm text-gray-600">{children}</p> : null}
      {action ? <div className="bf-empty-action">{action}</div> : null}
    </div>
  );
}
