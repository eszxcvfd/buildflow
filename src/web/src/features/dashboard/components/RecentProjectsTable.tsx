'use client';

import * as React from 'react';
import type { Project } from '@/lib/api/projects';
import { Card } from '@/components/ui/card/Card';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { apiErrorMessage } from '../lib/api-error';

export function formatViDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

/**
 * Bảng dự án gần đây — nhận dữ liệu đã tải từ page (useProjectsOverview),
 * tự sort theo createdAt giảm dần và cắt còn `limit` dòng (mặc định 5).
 */
export function RecentProjectsTable({
  projects,
  loading = false,
  error,
  limit = 5,
}: {
  projects: Project[];
  loading?: boolean;
  error?: unknown;
  limit?: number;
}) {
  const recent = React.useMemo(
    () =>
      [...projects]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit),
    [projects, limit],
  );

  return (
    <Card>
      <div className="bf-card-head">
        <span className="bf-card-title">Dự án gần đây</span>
        {projects.length > recent.length ? (
          <span className="bf-card-meta">
            {recent.length} mới nhất / {projects.length} dự án
          </span>
        ) : null}
      </div>

      {loading ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--bf-muted)' }} aria-busy="true">
          Đang tải…
        </p>
      ) : error ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--bf-muted)' }} role="alert">
          Không tải được dự án — {apiErrorMessage(error, 'lỗi không xác định')}
        </p>
      ) : recent.length === 0 ? (
        <EmptyState title="Chưa có dự án nào">Tạo dự án đầu tiên để xem tiến độ ở đây.</EmptyState>
      ) : (
        <div className="bf-table-wrap">
          <table className="bf-table">
            <thead>
              <tr>
                <th scope="col">Tên</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>{formatViDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
