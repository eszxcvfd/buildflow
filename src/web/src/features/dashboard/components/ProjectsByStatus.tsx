'use client';

import * as React from 'react';
import { listProjects, type Project } from '@/lib/api/projects';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { apiErrorMessage } from '../lib/api-error';

/** Nhãn tiếng Việt cho status dự án; status lạ hiển thị nguyên văn. */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang chạy',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CLOSED: 'Đã đóng',
};

export function statusLabelVi(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export interface StatusCount {
  status: string;
  count: number;
}

/** Group dự án theo status, sắp giảm dần theo số lượng ( alphabetical khi bằng nhau). */
export function groupProjectsByStatus(projects: Project[]): StatusCount[] {
  const counts = new Map<string, number>();
  for (const p of projects) {
    counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

type WidgetState =
  | { kind: 'loading' }
  | { kind: 'ok'; groups: StatusCount[]; total: number }
  | { kind: 'error'; message: string };

/**
 * Widget "Dự án theo trạng thái" — bar chart SVG-free (div + width %) tự vẽ,
 * tự fetch listProjects. Thanh fill chạy từ 0 → x% khi mount (transition CSS,
 * prefers-reduced-motion đã được global chặn).
 */
export function ProjectsByStatus() {
  const [state, setState] = React.useState<WidgetState>({ kind: 'loading' });
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    listProjects({ limit: 100 }).then(
      (data) => {
        if (alive) setState({ kind: 'ok', groups: groupProjectsByStatus(data), total: data.length });
      },
      (e: unknown) => {
        if (alive) setState({ kind: 'error', message: apiErrorMessage(e, 'lỗi không xác định') });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const ok = state.kind === 'ok';
  React.useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => setRevealed(true), 20);
    return () => window.clearTimeout(t);
  }, [ok]);

  const max = state.kind === 'ok' ? (state.groups[0]?.count ?? 0) : 0;

  return (
    <Card>
      <div className="bf-card-head">
        <span className="bf-card-title">Dự án theo trạng thái</span>
        {state.kind === 'ok' && state.total > 0 ? (
          <span className="bf-card-meta">Tổng {state.total} dự án</span>
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--bf-muted)' }} aria-busy="true">
          Đang tải…
        </p>
      ) : state.kind === 'error' ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--bf-muted)' }} role="alert">
          Không tải được dữ liệu — {state.message}
        </p>
      ) : state.groups.length === 0 ? (
        <EmptyState title="Chưa có dự án nào">Tạo dự án đầu tiên để xem tiến độ ở đây.</EmptyState>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {state.groups.map((g) => {
            const pct = max > 0 ? Math.round((g.count / max) * 100) : 0;
            const isTop = g.count === max;
            return (
              <div
                key={g.status}
                className="bf-dash-status-row"
                style={{ display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr) 32px', alignItems: 'center', gap: 10 }}
              >
                <span
                  title={g.status}
                  style={{ fontSize: 13, color: 'var(--bf-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {statusLabelVi(g.status)}
                </span>
                <span
                  aria-hidden="true"
                  style={{ display: 'block', height: 10, borderRadius: 999, background: 'var(--bf-idle-bg)', overflow: 'hidden' }}
                >
                  <span
                    className="bf-dash-status-fill"
                    style={{
                      display: 'block',
                      height: '100%',
                      width: revealed ? `${pct}%` : '0%',
                      borderRadius: 999,
                      background: isTop ? 'var(--bf-accent)' : 'var(--bf-line-strong)',
                      transition: 'width 600ms ease',
                    }}
                  />
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--bf-ink)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {g.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
