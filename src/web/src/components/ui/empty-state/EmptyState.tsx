import * as React from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  /** CTA dưới copy phụ (vd: link 'Thêm công nhân'). */
  action?: React.ReactNode;
}) {
  return (
    <div className={cn('bf-empty', 'flex flex-col items-center gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center')}>
      <span className={cn('bf-empty-title', 'text-sm font-semibold text-gray-800')}>{title}</span>
      {children ? <p className="m-0 text-sm text-gray-600">{children}</p> : null}
      {action ? <div className="bf-empty-action">{action}</div> : null}
    </div>
  );
}
