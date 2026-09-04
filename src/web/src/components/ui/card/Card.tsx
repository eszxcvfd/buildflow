import * as React from 'react';

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
    <div className={['bf-card', className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}
