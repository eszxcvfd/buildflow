'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Kanban dùng chung cho các list pages (WORKERS, CONTRACTORS, CREWS, PROJECTS).
 *
 * Tham khảo visual DashCode kanban
 * (/home/trung/Downloads/theme/dashcode → src/pages/app/kanban):
 * column header trắng rounded + thanh accent tone + count; card trắng
 * rounded-md shadow-base p-3, hover shadow-base2, click → điều hướng detail;
 * cột min-w 260px, horizontal scroll; cột rỗng = dashed placeholder.
 *
 * KANBAN CHỈ ĐỌC — KHÔNG drag-drop. Mọi đổi trạng thái phải đi qua API flow
 * riêng của từng feature (vd: ResourceStatusDialog / ProjectStatusDialog với
 * reason policy + open-work pre-check); kanban không tự suy diễn hay mutate
 * status phía client.
 */

export type KanbanTone = 'ok' | 'busy' | 'risk' | 'idle' | 'info';

export interface KanbanColumn {
  key: string;
  label: string;
  tone: KanbanTone;
}

export interface KanbanCardProps {
  /** Tên chính của card (vd: tên worker / mã-tên dự án). */
  title: string;
  /** 1–2 dòng meta phụ (vd: mã NV · email). */
  metas?: string[];
  /** Link tới trang chi tiết — click card điều hướng qua thẻ <a>. */
  href: string;
}

const TONE_DOT: Record<KanbanTone, string> = {
  ok: '#059669',
  busy: '#d97706',
  risk: '#dc2626',
  idle: '#64748b',
  info: '#2563eb',
};

export function ViewToggle({
  value,
  onChange,
}: {
  value: 'table' | 'kanban';
  onChange: (next: 'table' | 'kanban') => void;
}) {
  return (
    <div
      role="group"
      aria-label="Chế độ xem"
      className="bf-view-toggle"
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        background: 'var(--bf-toggle-bg, #eef1f9)',
        border: '1px solid var(--bf-toggle-border, #e2e8f0)',
      }}
    >
      <button
        type="button"
        aria-pressed={value === 'table'}
        onClick={() => onChange('table')}
        className={cn('bf-view-toggle-btn')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: '0.85rem',
          fontWeight: value === 'table' ? 600 : 400,
          background: value === 'table' ? '#fff' : 'transparent',
          color: value === 'table' ? 'var(--bf-ink, #0f172a)' : 'var(--bf-muted, #64748b)',
          boxShadow: value === 'table' ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
          border: 0,
          cursor: 'pointer',
        }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Bảng
      </button>
      <button
        type="button"
        aria-pressed={value === 'kanban'}
        onClick={() => onChange('kanban')}
        className={cn('bf-view-toggle-btn')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: '0.85rem',
          fontWeight: value === 'kanban' ? 600 : 400,
          background: value === 'kanban' ? '#fff' : 'transparent',
          color: value === 'kanban' ? 'var(--bf-ink, #0f172a)' : 'var(--bf-muted, #64748b)',
          boxShadow: value === 'kanban' ? '0 1px 2px rgba(15,23,42,0.12)' : 'none',
          border: 0,
          cursor: 'pointer',
        }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm10 0a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5Z" />
        </svg>
        Kanban
      </button>
    </div>
  );
}

/**
 * State chế độ xem qua URL param `?view=kanban` (shareable).
 * Mặc định = bảng (không param — KHÔNG đổi default vì specs + E2E drivers
 * phụ thuộc bảng). Đọc từ window.location lúc mount (client-only, không cần
 * Suspense boundary); đổi view dùng history.replaceState, giữ query còn lại.
 */
export function useViewMode(): ['table' | 'kanban', (next: 'table' | 'kanban') => void] {
  const [view, setView] = React.useState<'table' | 'kanban'>(() => {
    if (typeof window === 'undefined') return 'table';
    return new URLSearchParams(window.location.search).get('view') === 'kanban' ? 'kanban' : 'table';
  });

  const set = React.useCallback((next: 'table' | 'kanban') => {
    setView(next);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (next === 'kanban') params.set('view', 'kanban');
    else params.delete('view');
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }, []);

  return [view, set];
}

export function KanbanView<T>({
  columns,
  items,
  getColumnKey,
  getCardProps,
  renderItem,
  emptyText = 'Chưa có hồ sơ nào',
}: {
  columns: readonly KanbanColumn[];
  items: readonly T[];
  getColumnKey: (item: T) => string;
  getCardProps: (item: T) => KanbanCardProps;
  /** Render card tùy biến (mặc định: title + metas + link detail). */
  renderItem?: (item: T, card: KanbanCardProps) => React.ReactNode;
  emptyText?: string;
}) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, T[]>();
    for (const c of columns) map.set(c.key, []);
    for (const item of items) {
      const key = getColumnKey(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [columns, items, getColumnKey]);

  return (
    <div
      className="bf-kanban"
      role="region"
      aria-label="Xem kanban theo trạng thái"
      style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}
    >
      {columns.map((col) => {
        const colItems = grouped.get(col.key) ?? [];
        return (
          <section
            key={col.key}
            aria-label={`${col.label} (${colItems.length})`}
            style={{ minWidth: 260, maxWidth: 320, flex: '1 0 260px', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}
          >
            <header
              className="bg-white rounded shadow-base"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                overflow: 'hidden',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: '2rem',
                  width: 3,
                  borderRadius: 2,
                  backgroundColor: TONE_DOT[col.tone],
                }}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
                <span
                  aria-hidden="true"
                  style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: TONE_DOT[col.tone], flex: 'none' }}
                />
                {col.label}
              </span>
              <span
                aria-label={`${colItems.length} hồ sơ`}
                style={{
                  minWidth: 24,
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '1px 8px',
                  borderRadius: 999,
                  background: '#eef1f9',
                  color: '#334155',
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {colItems.length}
              </span>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {colItems.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: 6,
                    background: '#f8fafc',
                    color: '#94a3b8',
                    fontSize: '0.82rem',
                    textAlign: 'center',
                    padding: '1.25rem 0.75rem',
                  }}
                >
                  {emptyText}
                </div>
              ) : (
                colItems.map((item, i) => {
                  const card = getCardProps(item);
                  const key = `${col.key}-${card.href}-${i}`;
                  if (renderItem) return <React.Fragment key={key}>{renderItem(item, card)}</React.Fragment>;
                  return (
                    <a
                      key={key}
                      href={card.href}
                      className="bg-white rounded-md shadow-base hover:shadow-base2"
                      style={{
                        display: 'block',
                        padding: '0.75rem',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        transition: 'box-shadow 120ms ease',
                      }}
                    >
                      <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                        {card.title}
                      </span>
                      {card.metas?.map((m) => (
                        <span key={m} className="bf-card-meta" style={{ display: 'block', marginTop: 2 }}>
                          {m}
                        </span>
                      ))}
                    </a>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
