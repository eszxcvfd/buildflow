'use client';

import * as React from 'react';
import { searchWorkTypes, type WorkType, type ApiError } from '@/lib/api/work-types';
import { listTrades, type Trade } from '@/lib/api/trades';
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

function fieldSummary(wt: WorkType): string {
  if (wt.requiredFields.length === 0) return '—';
  if (wt.requiredFields.length === 1) return wt.requiredFields[0].label;
  return `${wt.requiredFields[0].label} +${wt.requiredFields.length - 1}`;
}

export function WorkTypesList() {
  const [items, setItems] = React.useState<WorkType[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ALL');
  const [groupFilter, setGroupFilter] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [tradeMap, setTradeMap] = React.useState<Record<string, Trade>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, trades] = await Promise.all([
        searchWorkTypes({
          search: search.trim() || undefined,
          status: statusFilter,
          group: groupFilter.trim() || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
        listTrades({ status: 'ALL', limit: 100, offset: 0 }).catch(() => null),
      ]);
      setItems(res.data);
      setTotal(res.total);
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
  }, [search, statusFilter, groupFilter, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách loại công việc…</p>
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
            Tài khoản hiện tại không đủ quyền để xem danh mục loại công việc.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách loại công việc'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL' || groupFilter.trim() !== '';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setGroupFilter('');
    setOffset(0);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} loại công việc · Hiển thị ${items.length}`}>
          <SearchField
            id="worktype-search"
            label="Tìm kiếm"
            placeholder="Mã hoặc tên loại công việc…"
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <div className="bf-filter">
            <Select
              id="worktype-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
              onChange={(v) => { setStatusFilter(v as 'ACTIVE' | 'INACTIVE' | 'ALL'); setOffset(0); }}
            />
          </div>
          <SearchField
            id="worktype-group-filter"
            label="Nhóm"
            placeholder="Lọc theo nhóm…"
            value={groupFilter}
            onChange={(v) => { setGroupFilter(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Loại ngừng hoạt động không chọn được cho work order mới nhưng lịch sử vẫn xem được;
          loại đã dùng chỉ được ngừng hoạt động, không xóa.
        </p>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có loại công việc nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc tạo loại mới từ nút “Thêm mới” ở đầu trang.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Nhóm</th>
                  <th>Ngành nghề yêu cầu</th>
                  <th>Dữ liệu bắt buộc</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((wt) => {
                  const active = wt.status === 'ACTIVE';
                  const trade = wt.requiredTradeId ? tradeMap[wt.requiredTradeId] : null;
                  return (
                    <tr key={wt.id}>
                      <td>
                        <a href={`/work-types/${wt.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                          {wt.name}
                        </a>{' '}
                        <span className="bf-chip">{wt.code}</span>
                      </td>
                      <td style={{ color: '#4b5563' }}>{wt.group || '—'}</td>
                      <td style={{ color: '#4b5563' }}>
                        {!wt.requiredTradeId
                          ? '—'
                          : trade
                            ? `${trade.code} — ${trade.name}`
                            : `${wt.requiredTradeId.slice(0, 8)}…`}
                      </td>
                      <td style={{ color: '#4b5563' }}>{fieldSummary(wt)}</td>
                      <td>
                        <span className={`bf-badge ${active ? 'bf-badge-busy' : 'bf-badge-risk'}`}>
                          {active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                        {new Date(wt.updatedAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="bf-cell-actions">
                        <span className="bf-row-actions">
                          <Tooltip content="Xem chi tiết loại công việc">
                            <a className="bf-detail-link" href={`/work-types/${wt.id}`}>
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
