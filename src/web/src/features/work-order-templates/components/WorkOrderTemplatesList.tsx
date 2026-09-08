'use client';

import * as React from 'react';
import {
  searchWorkOrderTemplates,
  WORK_ORDER_TEMPLATE_STATUS_LABELS,
  type WorkOrderTemplate,
  type ApiError,
} from '@/lib/api/work-order-templates';
import { listActiveWorkTypes, type WorkType } from '@/lib/api/work-types';
import { listTrades, type Trade } from '@/lib/api/trades';
import { WORK_ORDER_TEMPLATE_PRIORITY_LABELS } from '@/features/work-order-templates/schemas/work-order-template.schema';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ClearFiltersButton,
  ListPagination,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

const PAGE_SIZE = 20;

function checklistSummary(t: WorkOrderTemplate): string {
  if (t.checklistSnapshot.length === 0) return '—';
  if (t.checklistSnapshot.length === 1) return t.checklistSnapshot[0].title;
  return `${t.checklistSnapshot[0].title} +${t.checklistSnapshot.length - 1}`;
}

function durationLabel(t: WorkOrderTemplate): string {
  return t.defaultDurationMinutes != null ? `${t.defaultDurationMinutes} phút` : '—';
}

export function WorkOrderTemplatesList() {
  const [items, setItems] = React.useState<WorkOrderTemplate[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ALL'>('ALL');
  const [workTypeFilter, setWorkTypeFilter] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [workTypeMap, setWorkTypeMap] = React.useState<Record<string, WorkType>>({});
  const [tradeMap, setTradeMap] = React.useState<Record<string, Trade>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, wts, trades] = await Promise.all([
        searchWorkOrderTemplates({
          search: search.trim() || undefined,
          status: statusFilter,
          workTypeId: workTypeFilter || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
        listActiveWorkTypes().catch(() => null),
        listTrades({ status: 'ALL', limit: 100, offset: 0 }).catch(() => null),
      ]);
      setItems(res.data);
      setTotal(res.total);
      if (wts) {
        const map: Record<string, WorkType> = {};
        for (const w of wts.data) map[w.id] = w;
        setWorkTypeMap(map);
      }
      if (trades) {
        const map: Record<string, Trade> = {};
        for (const t of trades.data) map[t.id] = t;
        setTradeMap(map);
      }
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, workTypeFilter, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách mẫu công việc…</p>
      </Card>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login">Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)</Alert>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tài khoản hiện tại không đủ quyền để xem danh mục mẫu công việc.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách mẫu công việc'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL' || workTypeFilter !== '';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setWorkTypeFilter('');
    setOffset(0);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} mẫu công việc · Hiển thị ${items.length}`}>
          <SearchField
            id="wot-search"
            label="Tìm kiếm"
            placeholder="Mã hoặc tên mẫu công việc…"
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <div className="bf-filter">
            <Select
              id="wot-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'DRAFT', label: 'Nháp' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
              onChange={(v) => { setStatusFilter(v as 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ALL'); setOffset(0); }}
            />
          </div>
          <div className="bf-filter">
            <Select
              id="wot-worktype-filter"
              label="Loại công việc"
              hideLabel
              value={workTypeFilter}
              options={[
                { value: '', label: 'Tất cả loại công việc' },
                ...Object.values(workTypeMap).map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
              ]}
              onChange={(v) => { setWorkTypeFilter(v); setOffset(0); }}
            />
          </div>
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Mẫu Nháp chưa dùng được cho work order mới — cần kích hoạt sau khi đã có kỹ
          năng hoặc checklist; sửa mẫu không thay đổi work order đã tạo.
        </p>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có mẫu công việc nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc tạo mẫu mới từ nút “Thêm mới” ở đầu trang.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Loại công việc</th>
                  <th>Thời lượng</th>
                  <th>Ưu tiên</th>
                  <th>Checklist</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const wt = t.workTypeId ? workTypeMap[t.workTypeId] : null;
                  return (
                    <tr key={t.id}>
                      <td>
                        <a href={`/work-order-templates/${t.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                          {t.name}
                        </a>{' '}
                        <span className="bf-chip">{t.code}</span>
                      </td>
                      <td style={{ color: '#4b5563' }}>
                        {!t.workTypeId
                          ? '—'
                          : wt
                            ? <a href={`/work-types/${wt.id}`}>{wt.code} — {wt.name}</a>
                            : `${t.workTypeId.slice(0, 8)}…`}
                      </td>
                      <td style={{ color: '#4b5563' }}>{durationLabel(t)}</td>
                      <td style={{ color: '#4b5563' }}>
                        {WORK_ORDER_TEMPLATE_PRIORITY_LABELS[t.defaultPriority] ?? t.defaultPriority}
                      </td>
                      <td style={{ color: '#4b5563' }}>{checklistSummary(t)}</td>
                      <td>
                        <span className={`bf-badge ${t.status === 'ACTIVE' ? 'bf-badge-ok' : t.status === 'DRAFT' ? 'bf-badge-busy' : 'bf-badge-risk'}`}>
                          {WORK_ORDER_TEMPLATE_STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                        {new Date(t.updatedAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="bf-cell-actions">
                        <span className="bf-row-actions">
                          <Tooltip content="Xem chi tiết mẫu công việc">
                            <a className="bf-detail-link" href={`/work-order-templates/${t.id}`}>
                              Chi tiết
                            </a>
                          </Tooltip>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} totalPages={totalPages} onPage={(p) => setOffset((p - 1) * PAGE_SIZE)} prevLabel="Trước" nextLabel="Sau" />
        </Card>
      )}
    </div>
  );
}
