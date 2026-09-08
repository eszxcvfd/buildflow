'use client';

import * as React from 'react';
import { listCrews, type Crew } from '@/lib/api/crews';
import type { ApiError } from '@/lib/api/crews';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ActiveChips,
  ClearFiltersButton,
  ListPagination,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

const PAGE_SIZE = 20;

const SORTS = [
  { value: 'createdAt', label: 'Mới nhất' },
  { value: 'name', label: 'Tên' },
];

const ORDERS = [
  { value: 'desc', label: 'Giảm dần' },
  { value: 'asc', label: 'Tăng dần' },
];

/**
 * ORG-SRS-006 (issue #29) — danh sách đội thi công cho ADMIN + PROJECT_MANAGER.
 * Filter status/search/eligibleOnly + sort/order + pagination; reads no-store.
 * Đội INACTIVE hiển thị rõ 'không nhận phân công mới'.
 */
export function CrewList() {
  const [crews, setCrews] = React.useState<Crew[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [eligibleOnly, setEligibleOnly] = React.useState(false);
  const [sort, setSort] = React.useState('createdAt');
  const [order, setOrder] = React.useState('desc');
  const [offset, setOffset] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listCrews({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        eligibleOnly: eligibleOnly || undefined,
        sort,
        order,
        limit: PAGE_SIZE,
        offset,
      });
      setCrews(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, eligibleOnly, sort, order, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách đội thi công…</p>
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
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN hoặc PROJECT_MANAGER (403)</Alert>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tài khoản hiện tại không đủ quyền để xem danh sách đội thi công.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách đội thi công'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilter =
    search.trim() !== '' || statusFilter !== '' || eligibleOnly || sort !== 'createdAt' || order !== 'desc';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('');
    setEligibleOnly(false);
    setSort('createdAt');
    setOrder('desc');
    setOffset(0);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} đội · Hiển thị ${crews.length}`}>
          <SearchField
            id="crew-search"
            label="Tìm kiếm"
            placeholder="Mã, tên hoặc mô tả đội…"
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <div className="bf-filter">
            <Select
              id="crew-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
              onChange={(v) => { setStatusFilter(v); setOffset(0); }}
            />
          </div>
          <div className="bf-filter">
            <Select
              id="crew-sort"
              label="Sắp xếp"
              hideLabel
              value={sort}
              options={SORTS}
              onChange={(v) => { setSort(v); setOffset(0); }}
            />
          </div>
          <div className="bf-filter">
            <Select
              id="crew-order"
              label="Thứ tự"
              hideLabel
              value={order}
              options={ORDERS}
              onChange={(v) => { setOrder(v); setOffset(0); }}
            />
          </div>
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <ActiveChips
          chips={[
            ...(statusFilter
              ? [{
                  key: 'status',
                  label: `Trạng thái: ${statusFilter === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}`,
                  onRemove: () => { setStatusFilter(''); setOffset(0); },
                }]
              : []),
            ...(eligibleOnly
              ? [{
                  key: 'eligible',
                  label: 'Chỉ đội đủ điều kiện',
                  onRemove: () => { setEligibleOnly(false); setOffset(0); },
                }]
              : []),
            ...(search.trim()
              ? [{
                  key: 'q',
                  label: `Tìm: “${search.trim()}”`,
                  onRemove: () => { setSearch(''); setOffset(0); },
                }]
              : []),
          ]}
        />
        <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.88rem', color: 'var(--bf-muted)', marginTop: '0.75rem', cursor: 'pointer', width: 'fit-content' }}>
          <input
            type="checkbox"
            id="crew-eligible-only"
            checked={eligibleOnly}
            onChange={(e) => { setEligibleOnly(e.target.checked); setOffset(0); }}
          />
          Chỉ đội đủ điều kiện
        </label>
        <p className="bf-card-meta" style={{ marginTop: '0.5rem' }}>
          Đội ngừng hoạt động không nhận phân công mới nhưng lịch sử công việc đã hoàn tất vẫn giữ nguyên.
        </p>
      </Card>

      {crews.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có đội thi công nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc tạo đội mới từ nút “Thêm mới” ở đầu trang.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Mã</th>
                  <th>Trạng thái</th>
                  <th>Điều kiện phân công</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {crews.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={`/crews/${c.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                        {c.name}
                      </a>
                    </td>
                    <td>{c.code}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <span style={{ color: c.eligible ? '#065f46' : '#991b1b', fontSize: '0.88rem' }}>
                        {c.eligible ? 'Đủ điều kiện phân công' : 'Không nhận việc mới'}
                      </span>
                    </td>
                    <td className="bf-cell-actions">
                      <span className="bf-row-actions">
                        <Tooltip content="Xem chi tiết đội">
                          <a className="bf-detail-link" href={`/crews/${c.id}`}>
                            Chi tiết
                          </a>
                        </Tooltip>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} totalPages={totalPages} onPage={(p) => setOffset((p - 1) * PAGE_SIZE)} prevLabel="Trước" nextLabel="Sau" />
        </Card>
      )}
    </div>
  );
}
