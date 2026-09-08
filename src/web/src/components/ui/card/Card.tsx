import * as React from 'react';
import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  style,
  bodyClassName,
  bodyStyle,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Extra class cho .bf-card-body (mặc định p-5 DashCode). */
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('bf-card', 'rounded-md border border-slate-200/60 bg-white shadow-base', className)}
      style={style}
    >
      <div className={cn('bf-card-body', 'p-5', bodyClassName)} style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}
