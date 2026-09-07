import * as React from 'react';
import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header
      className={cn('bf-page-head', actions && 'flex flex-wrap items-end justify-between gap-4')}
      style={actions ? { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' } : undefined}
    >
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle ? <p className={cn('bf-page-head-sub', 'mt-1 text-sm text-gray-600')}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}
