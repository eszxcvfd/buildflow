'use client';

import * as React from 'react';
import { listTrades, changeTradeStatus, type Trade } from '@/lib/api/trades';
import type { ApiError } from '@/lib/api/trades';
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

export const TRADE_IN_USE_WARNING =
  'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực';

const PAGE_SIZE = 20;

export function TradeList() {
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ACTIVE' | 'INACTIVE' | 'ALL'>('ALL');
  const [offset, setOffset] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<{ trade: Trade; next: 'ACTIVE' | 'INACTIVE' } | null>(null);
  const [statusWarning, setStatusWarning] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTrades({
        search: search.trim() || undefined,
        status: statusFilter,
        limit: PAGE_SIZE,
        offset,
      });
      setTrades(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  async function handleStatusChange(target: { trade: Trade; next: 'ACTIVE' | 'INACTIVE' }) {
    setActionError(null);
    setStatusWarning(null);
    setBusyId(target.trade.id);
    try {
      const updated = await changeTradeStatus(target.trade.id, { status: target.next });
      // Warning xuất hiện khi deactivate danh mục đang được tham chiếu bởi
      // resource/work type/work order đang hiệu lực (vẫn cho phép, audit giữ).
      if (target.next === 'INACTIVE' && updated.warning) setStatusWarning(updated.warning);
      setTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setConfirmTarget(null);
    } catch (e) {
      const err = e as ApiError;
      setActionError(
        err.status === 401
          ? 'Phiên hết hạn, vui lòng đăng nhập lại.'
          : err.status === 403
            ? 'Không có quyền — cần ADMIN.'
            : err.message || 'Thao tác thất bại',
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách ngành nghề…</p>
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
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN (403)</Alert>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tài khoản hiện tại không đủ quyền để xem danh sách ngành nghề.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách ngành nghề'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setOffset(0);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} danh mục · Hiển thị ${trades.length}`}>
          <SearchField
            id="trade-search"
            label="Tìm kiếm"
            placeholder="Mã hoặc tên ngành nghề…"
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <div className="bf-filter">
            <Select
              id="trade-status"
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
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Danh mục ngừng hoạt động không chọn được cho phân công mới nhưng lịch sử vẫn xem được;
          danh mục đã dùng chỉ được ngừng hoạt động, không xóa.
        </p>
      </Card>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {statusWarning ? (
        <Alert tone="info">
          {statusWarning} — bản thân danh mục vẫn được chuyển sang ngừng hoạt động; phân công mới
          dùng danh mục này sẽ bị chặn theo quy tắc, lịch sử cũ giữ nguyên.
        </Alert>
      ) : null}

      {confirmTarget ? (
        <Card>
          <Alert tone="info">
            Xác nhận chuyển trạng thái danh mục <strong>{confirmTarget.trade.code} — {confirmTarget.trade.name}</strong> sang{' '}
            <strong>{confirmTarget.next === 'INACTIVE' ? 'Ngừng hoạt động' : 'Hoạt động'}</strong>?
            {confirmTarget.next === 'INACTIVE'
              ? ' Danh mục sẽ không được chọn cho phân công mới; nếu đang được tham chiếu, hệ thống vẫn cho phép và báo cảnh báo.'
              : ''}
          </Alert>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button
              onClick={() => {
                const t = confirmTarget;
                setConfirmTarget(null);
                void handleStatusChange(t);
              }}
              loading={busyId === confirmTarget.trade.id}
              aria-busy={busyId === confirmTarget.trade.id}
            >
              Xác nhận
            </Button>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Hủy</Button>
          </div>
        </Card>
      ) : null}

      {trades.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có ngành nghề nào phù hợp bộ lọc"
            action={
              <a className="bf-btn bf-btn-primary" href="/trades/new">
                Tạo ngành nghề
              </a>
            }
          >
            Thử thay đổi từ khóa hoặc tạo danh mục mới.
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
                  <th>Mô tả</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const active = t.status === 'ACTIVE';
                  return (
                    <tr key={t.id}>
                      <td>
                        <a href={`/trades/${t.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                          {t.name}
                        </a>
                      </td>
                      <td>{t.code}</td>
                      <td style={{ color: '#6b7280', maxWidth: 320 }}>
                        {t.description || '—'}
                      </td>
                      <td>
                        <span className={`bf-badge ${active ? 'bf-badge-busy' : 'bf-badge-risk'}`}>
                          {active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="bf-cell-actions">
                        <span className="bf-row-actions">
                          {active ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmTarget({ trade: t, next: 'INACTIVE' })}
                              disabled={busyId === t.id}
                            >
                              Ngừng hoạt động
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setConfirmTarget({ trade: t, next: 'ACTIVE' })}
                              disabled={busyId === t.id}
                            >
                              Kích hoạt lại
                            </Button>
                          )}
                          <Tooltip content="Xem chi tiết danh mục">
                            <a className="bf-detail-link" href={`/trades/${t.id}`}>
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
