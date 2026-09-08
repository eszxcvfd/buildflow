'use client';

import * as React from 'react';
import { listContractors, type Contractor, type ApiError } from '@/lib/api/contractors';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Select } from '@/components/ui/select/Select';
import { KanbanView, type KanbanColumn, type KanbanTone } from '@/components/ui/kanban/KanbanView';
import { ClearFiltersButton, ListToolbar, SearchField } from '@/components/ui/list/ListKit';

function statusLabel(status: string): string {
  return status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động';
}

function statusTone(status: string): KanbanTone {
  return status === 'ACTIVE' ? 'ok' : 'risk';
}

/**
 * Kanban nhà thầu — CHỈ ĐỌC, nhóm theo status.
 * Fetch riêng limit 100 theo filter của chính kanban (bảng phân trang
 * server-side nên không tái dùng data trang hiện tại). Tradeoff: filter
 * bảng ↔ kanban độc lập.
 */

const KANBAN_LIMIT = 100;

const COLUMNS: readonly KanbanColumn[] = [
  { key: 'ACTIVE', label: 'Hoạt động', tone: 'ok' },
  { key: 'INACTIVE', label: 'Ngừng hoạt động', tone: 'risk' },
];

export function ContractorsKanban() {
  const [contractors, setContractors] = React.useState<Contractor[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContractors({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: KANBAN_LIMIT,
        offset: 0,
      });
      setContractors(res.data);
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
        <p aria-busy="true">Đang tải kanban nhà thầu…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải kanban nhà thầu'}</Alert>
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
        <ListToolbar count={total > contractors.length ? `Hiển thị ${contractors.length}/${total} hồ sơ` : `Tổng: ${total} hồ sơ`}>
          <SearchField
            id="contractors-kanban-search"
            label="Tìm kiếm"
            placeholder="Mã, tên, liên hệ, email…"
            value={search}
            onChange={setSearch}
            onSubmit={() => void load()}
          />
          <div className="bf-filter">
            <Select
              id="contractors-kanban-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
              onChange={setStatusFilter}
            />
          </div>
          <Button variant="secondary" onClick={() => void load()}>
            Tìm
          </Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0.75rem 0 0', fontSize: '0.8rem', color: 'var(--bf-muted, #64748b)' }}>
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5m0-8v.01" />
          </svg>
          Kanban chỉ đọc — đổi trạng thái qua trang chi tiết nhà thầu.
        </p>
      </Card>
      {contractors.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có nhà thầu nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc trạng thái.
          </EmptyState>
        </Card>
      ) : (
        <KanbanView<Contractor>
          columns={COLUMNS}
          items={contractors}
          getColumnKey={(c) => c.status}
          getCardProps={(c) => ({
            title: c.name,
            metas: [
              { icon: 'hash', text: c.code },
              { icon: 'user', text: c.contactName ?? c.phone ?? '—' },
            ],
            badge: statusLabel(c.status),
            badgeTone: statusTone(c.status),
            href: `/contractors/${c.id}`,
          })}
        />
      )}
    </div>
  );
}
