import * as React from 'react';
import { cn } from '@/lib/cn';

const toneClass: Record<'error' | 'info' | 'success', string> = {
  error: 'bf-tone-risk',
  info: 'bf-tone-info',
  success: 'bf-tone-ok',
};

const toneTw: Record<'error' | 'info' | 'success', string> = {
  error: 'border-danger-500/50 bg-danger-100 text-danger-700',
  info: 'border-info-500/50 bg-info-100 text-info-700',
  success: 'border-success-500/50 bg-success-100 text-success-700',
};

export function Alert({
  tone = 'error',
  children,
  className,
  style,
}: {
  tone?: 'error' | 'info' | 'success';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('bf-alert', toneClass[tone], 'rounded-[4px] border px-3 py-2 text-sm', toneTw[tone], className)}
      style={style}
    >
      {children}
    </div>
  );
}
