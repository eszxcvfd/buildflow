'use client';

import * as React from 'react';
import { searchWorkOrders } from '@/lib/api/work-orders';

/**
 * Section `Công việc` ở ProjectDetail (sau `ProjectAttachments`).
 * Đếm rẻ qua `searchWorkOrders({ projectId, limit: 1 }) → total` (không tải
 * rows) + link deep-link `Xem tất cả công việc → /work-orders?projectId=<id>`.
 * Fail-soft: lỗi đếm → vẫn hiện link (không chặn render detail).
 */
export function ProjectWorkOrders({ projectId }: { projectId: string }) {
  const [total, setTotal] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function count() {
      try {
        const res = await searchWorkOrders({ projectId, limit: 1, offset: 0 });
        if (!cancelled) setTotal(res.total);
      } catch {
        if (!cancelled) setTotal(null);
      }
    }
    void count();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div>
      <div className="bf-card-head">
        <span className="bf-card-title">Công việc</span>
      </div>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
        {total === null
          ? 'Công việc của dự án này.'
          : total === 0
            ? 'Dự án này chưa có công việc nào.'
            : `Dự án này có ${total} công việc.`}
      </p>
      <a href={`/work-orders?projectId=${encodeURIComponent(projectId)}`}>Xem tất cả công việc</a>
    </div>
  );
}
