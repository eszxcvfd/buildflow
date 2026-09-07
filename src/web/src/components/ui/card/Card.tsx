import * as React from 'react';
import { cn } from '@/lib/cn';

export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn('bf-card', 'rounded-md border border-slate-200/60 bg-white shadow-base', className)}
      style={style}
    >
      {children}
    </div>
  );
}
