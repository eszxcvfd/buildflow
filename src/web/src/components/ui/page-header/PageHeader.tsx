import * as React from 'react';

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
      className="bf-page-head"
      style={actions ? { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' } : undefined}
    >
      <div>
        <h1>{title}</h1>
        {subtitle ? <p className="bf-page-head-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div> : null}
    </header>
  );
}
