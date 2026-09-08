'use client';

import * as React from 'react';
import { listWorkers, type Worker, type ApiError } from '@/lib/api/workers';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Select } from '@/components/ui/select/Select';
import { KanbanView, type KanbanColumn } from '@/components/ui/kanban/KanbanView';
import { ClearFiltersButton, ListToolbar, SearchField } from '@/components/ui/list/ListKit';

/**
 * Kanban công nhân — CHỈ ĐỌC, nhóm theo lifecycle status.
 * Fetch riêng limit 100 theo filter của chính kanban (không tái dùng page
 * bảng vì bảng phân trang server-side limit 20 — chỉ hiện trang hiện tại sẽ
 * gây thiếu cột). Tradeoff: filter bảng ↔ kanban độc lập, đổi view reset
 * filter của view kia (chỉ giữ ?view= trên URL).
 */

const KANBAN_LIMIT = 100;

const COLUMNS: readonly KanbanColumn[] = [
  { key: 'ACTIVE', label: 'Hoạt động', tone: 'ok' },
  { key: 'INACTIVE', label: 'Ngừng hoạt động', tone: 'risk' },
  { key: 'LOCKED', label: 'Bị khóa', tone: 'busy' },
];

export function WorkersKanban() {
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWorkers({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: KANBAN_LIMIT,
        offset: 0,
      });
      setWorkers(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const hasActiveFilter = search.trim() !== '' || statusFilter !== '';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('');
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải kanban công nhân…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải kanban công nhân'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => void load()}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={total > workers.length ? `Hiển thị ${workers.length}/${total} hồ sơ` : `Tổng: ${total} hồ sơ`}>
          <SearchField
            id="workers-kanban-search"
            label="Tìm kiếm"
            placeholder="Tên, email, mã nhân viên…"
            value={search}
            onChange={setSearch}
            onSubmit={() => void load()}
          />
          <div className="bf-filter">
            <Select
              id="workers-kanban-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
                { value: 'LOCKED', label: 'Bị khóa' },
              ]}
              onChange={setStatusFilter}
            />
          </div>
          <Button variant="secondary" onClick={() => void load()}>
            Tìm
          </Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Kanban chỉ đọc — đổi trạng thái qua nút hành động ở chế độ bảng hoặc trang chi tiết.
        </p>
      </Card>
      {workers.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có worker nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc trạng thái.
          </EmptyState>
        </Card>
      ) : (
        <KanbanView<Worker>
          columns={COLUMNS}
          items={workers}
          getColumnKey={(w) => w.status}
          getCardProps={(w) => ({
            title: w.fullName,
            metas: [`${w.employeeCode ?? '—'} · ${w.email}`, w.eligible ? 'Đang hoạt động' : 'Không nhận việc mới'],
            href: `/workers/${w.id}`,
          })}
        />
      )}
    </div>
  );
}
