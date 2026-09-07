'use client';

import * as React from 'react';
import { listContractors, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ClearFiltersButton,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

export function ContractorList() {
  const [contractors, setContractors] = React.useState<Contractor[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState('');
  const [eligibleOnly, setEligibleOnly] = React.useState(false);
  const [retryKey, setRetryKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContractors({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        scope: scopeFilter.trim() || undefined,
        eligibleOnly: eligibleOnly || undefined,
        limit: 20,
        offset: 0,
      });
      setContractors(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, scopeFilter, eligibleOnly]);

  React.useEffect(() => {
    void load();
  }, [load, retryKey]);

  function handleRetry() {
    setRetryKey((k) => k + 1);
  }

  const hasActiveFilter =
    search.trim() !== '' || statusFilter !== '' || scopeFilter.trim() !== '' || eligibleOnly;

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('');
    setScopeFilter('');
    setEligibleOnly(false);
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải…</p>
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
          <Alert tone="info">Bạn không có quyền xem nhà thầu</Alert>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--bf-muted)' }}>
            Tài khoản hiện tại không đủ quyền để xem danh sách nhà thầu — cần vai trò ADMIN hoặc PROJECT_MANAGER.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách nhà thầu'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} hồ sơ · Hiển thị ${contractors.length}`}>
          <SearchField
            id="contractor-search"
            label="Tìm kiếm"
            placeholder="Mã, tên, liên hệ, email…"
            value={search}
            onChange={setSearch}
            onSubmit={() => void load()}
          />
          <div className="bf-filter">
            <Select
              id="contractor-status"
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
          <div className="bf-filter">
            <label className="bf-sr-only" htmlFor="contractor-scope">Phạm vi</label>
            <Input
              id="contractor-scope"
              placeholder="Phạm vi: thi công phần thô…"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={() => void load()}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.75rem', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--bf-muted)' }}>
          <input
            type="checkbox"
            checked={eligibleOnly}
            onChange={(e) => setEligibleOnly(e.target.checked)}
          />{' '}
          Chỉ hiển thị đủ điều kiện (ACTIVE)
        </label>
        <p className="bf-card-meta" style={{ marginTop: '0.5rem' }}>
          Nhà thầu ngừng hoạt động không chọn được cho phân công mới, lịch sử vẫn xem được.
        </p>
      </Card>

      {contractors.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có nhà thầu nào phù hợp bộ lọc"
            action={
              <a className="bf-btn bf-btn-primary" href="/contractors/new">
                Thêm nhà thầu
              </a>
            }
          >
            Thử thay đổi từ khóa hoặc tạo hồ sơ mới.
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
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.code}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="bf-cell-actions">
                      <span className="bf-row-actions">
                        <Tooltip content="Xem hồ sơ chi tiết">
                          <a className="bf-detail-link" href={`/contractors/${c.id}`}>Xem chi tiết</a>
                        </Tooltip>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
