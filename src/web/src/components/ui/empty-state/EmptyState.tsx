import * as React from 'react';

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bf-empty">
      <span className="bf-empty-title">{title}</span>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
