'use client';

import * as React from 'react';
import { listCrews, type Crew } from '@/lib/api/crews';
import type { ApiError } from '@/lib/api/crews';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';

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

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="bf-field" style={{ flex: '1 1 220px' }}>
            <label className="bf-label" htmlFor="crew-search">Tìm kiếm</label>
            <Input
              id="crew-search"
              placeholder="Mã, tên hoặc mô tả đội…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bf-field" style={{ minWidth: 180 }}>
            <label className="bf-label" htmlFor="crew-status">Trạng thái</label>
            <select
              id="crew-status"
              className="bf-input"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>
          <div className="bf-field" style={{ minWidth: 140 }}>
            <label className="bf-label" htmlFor="crew-sort">Sắp xếp</label>
            <select
              id="crew-sort"
              className="bf-input"
              value={sort}
              onChange={(e) => { setSort(e.target.value); setOffset(0); }}
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="bf-field" style={{ minWidth: 130 }}>
            <label className="bf-label" htmlFor="crew-order">Thứ tự</label>
            <select
              id="crew-order"
              className="bf-input"
              value={order}
              onChange={(e) => { setOrder(e.target.value); setOffset(0); }}
            >
              {ORDERS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              id="crew-eligible-only"
              checked={eligibleOnly}
              onChange={(e) => { setEligibleOnly(e.target.checked); setOffset(0); }}
            />
            Chỉ đội đủ điều kiện
          </label>
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>Tìm</Button>
        </div>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Tổng: {total} đội · Hiển thị {crews.length} · Đội ngừng hoạt động không nhận phân công mới
          nhưng lịch sử công việc đã hoàn tất vẫn giữ nguyên.
        </p>
      </Card>

      {crews.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có đội thi công nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc tạo đội mới.
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
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {crews.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <a href={`/crews/${c.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>
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
                    <td>
                      <a href={`/crews/${c.id}`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>
                        Chi tiết
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                Trang {page}/{totalPages}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
                  Trước
                </Button>
                <Button
                  variant="secondary"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                >
                  Sau
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
