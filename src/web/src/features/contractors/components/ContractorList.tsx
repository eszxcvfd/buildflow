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
  }, [search, statusFilter, scopeFilter, eligibleOnly, retryKey]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    setRetryKey((k) => k + 1);
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
            Tài khoản hiện tại không đủ quyền để xem danh sách nhà thầu — cần vai trò quản trị.
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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="bf-field" style={{ flex: '1 1 220px' }}>
            <label className="bf-label" htmlFor="contractor-search">Tìm kiếm</label>
            <Input
              id="contractor-search"
              placeholder="Mã, tên, liên hệ, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bf-field" style={{ minWidth: 160 }}>
            <label className="bf-label" htmlFor="contractor-status">Trạng thái</label>
            <select
              id="contractor-status"
              className="bf-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>
          <div className="bf-field" style={{ flex: '1 1 160px' }}>
            <label className="bf-label" htmlFor="contractor-scope">Phạm vi</label>
            <Input
              id="contractor-scope"
              placeholder="Thí dụ: Thi công phần thô"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={() => void load()}>Tìm</Button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={eligibleOnly}
            onChange={(e) => setEligibleOnly(e.target.checked)}
          />{' '}
          Chỉ hiển thị đủ điều kiện (ACTIVE)
        </label>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Tổng: {total} hồ sơ · Hiển thị {contractors.length} · Nhà thầu ngừng hoạt động không chọn
          được cho phân công mới, lịch sử vẫn xem được.
        </p>
      </Card>

      {contractors.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có nhà thầu nào phù hợp bộ lọc">
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
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <a href={`/contractors/${c.id}`}>Xem chi tiết</a>
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
