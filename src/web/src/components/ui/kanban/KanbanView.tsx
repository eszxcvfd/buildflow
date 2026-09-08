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
 * Polish hiện tại (theo DashCode Task card): card có avatar chip initials
 * (36px rounded-full, soft bg theo tone cột) + tên font-medium + meta dòng
 * nhỏ có icon + status badge chip (.bf-badge-*); hover shadow-base2 +
 * translateY(-2px); cột nền slate-50 rounded-lg p-2.5, min-w 272px, gap 12px.
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

export type KanbanMetaIcon = 'hash' | 'mail' | 'user' | 'clock';

export interface KanbanMeta {
  icon?: KanbanMetaIcon;
  text: string;
}

export interface KanbanCardProps {
  /** Tên chính của card (vd: tên worker / mã-tên dự án). */
  title: string;
  /** 1–2 dòng meta phụ (string thuần hoặc {icon, text} có icon nhỏ). */
  metas?: Array<string | KanbanMeta>;
  /** Link tới trang chi tiết — click card điều hướng qua thẻ <a>. */
  href: string;
  /** Nhãn badge trạng thái hiển thị trên card (vd: 'Hoạt động'). */
  badge?: string;
  /** Tone badge — mặc định theo tone của cột chứa card. */
  badgeTone?: KanbanTone;
  /** Initials avatar — mặc định suy từ title (2 ký tự đầu của 2 từ đầu). */
  initials?: string;
}

const TONE_DOT: Record<KanbanTone, string> = {
  ok: '#059669',
  busy: '#d97706',
  risk: '#dc2626',
  idle: '#64748b',
  info: '#2563eb',
};

/** Nền chữ soft cho avatar chip + count pill theo tone cột. */
const TONE_SOFT: Record<KanbanTone, { bg: string; fg: string }> = {
  ok: { bg: '#dcfce7', fg: '#047857' },
  busy: { bg: '#fef3c7', fg: '#b45309' },
  risk: { bg: '#fee2e2', fg: '#b91c1c' },
  idle: { bg: '#f1f5f9', fg: '#475569' },
  info: { bg: '#e0f2fe', fg: '#0369a1' },
};

function initialsOf(title: string, explicit?: string): string {
  if (explicit) return explicit;
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '•';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

function MetaIcon({ icon }: { icon: KanbanMetaIcon }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  } as const;
  if (icon === 'mail') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }
  if (icon === 'user') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    );
  }
  if (icon === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

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

function DefaultCard({ card, tone }: { card: KanbanCardProps; tone: KanbanTone }) {
  const soft = TONE_SOFT[tone];
  const badgeTone = card.badgeTone ?? tone;
  return (
    <a
      href={card.href}
      className="bf-kanban-card bg-white rounded-md shadow-base hover:shadow-base2"
      style={{
        display: 'block',
        borderRadius: 6,
        padding: '0.75rem',
        textDecoration: 'none',
        cursor: 'pointer',
        background: '#fff',
      }}
    >
      <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            flex: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '0.8rem',
            letterSpacing: '0.02em',
            background: soft.bg,
            color: soft.fg,
          }}
        >
          {initialsOf(card.title, card.initials)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span
              style={{
                display: 'block',
                fontWeight: 500,
                fontSize: '0.9rem',
                lineHeight: 1.4,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {card.title}
            </span>
            {card.badge ? (
              <span className={cn('bf-badge', `bf-badge-${badgeTone}`)} style={{ flex: 'none' }}>
                {card.badge}
              </span>
            ) : null}
          </span>
          {card.metas?.map((m, idx) => {
            const meta: KanbanMeta = typeof m === 'string' ? { text: m } : m;
            return (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={`${idx}-${meta.text}`}
                className="bf-card-meta"
                style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}
              >
                {meta.icon ? <MetaIcon icon={meta.icon} /> : null}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {meta.text}
                </span>
              </span>
            );
          })}
        </span>
      </span>
    </a>
  );
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
  /** Render card tùy biến (mặc định: avatar + title + metas + badge + link detail). */
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
      style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '4px 4px 12px' }}
    >
      {columns.map((col) => {
        const colItems = grouped.get(col.key) ?? [];
        const soft = TONE_SOFT[col.tone];
        return (
          <section
            key={col.key}
            aria-label={`${col.label} (${colItems.length})`}
            style={{
              minWidth: 272,
              maxWidth: 320,
              flex: '1 0 272px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: '#f8fafc',
              borderRadius: 8,
              padding: 10,
            }}
          >
            <header
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 1,
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '2px 4px',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
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
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '1px 8px',
                  borderRadius: 999,
                  background: soft.bg,
                  color: soft.fg,
                  fontFeatureSettings: "'tnum'",
                }}
              >
                {colItems.length}
              </span>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {colItems.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed #cbd5e1',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.6)',
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
                  return <DefaultCard key={key} card={card} tone={col.tone} />;
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
