import * as React from 'react';

const toneClass: Record<'error' | 'info' | 'success', string> = {
  error: 'bf-tone-risk',
  info: 'bf-tone-info',
  success: 'bf-tone-ok',
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
      className={['bf-alert', toneClass[tone], className].filter(Boolean).join(' ')}
      style={style}
    >
      {children}
    </div>
  );
}
