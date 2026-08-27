import * as React from 'react';

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '1.5rem',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
