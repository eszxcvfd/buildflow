'use client';

import * as React from 'react';
import { listAdminUsers, updateAdminUserStatus, type AdminUser, type AdminUserError } from '@/lib/api/admin-users';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';

export function AdminUserList() {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<AdminUserError | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<AdminUserError | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<{ user: AdminUser; next: string } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminUsers({
        status: statusFilter || undefined,
        limit: 100,
        offset: 0,
      });
      const q = search.trim().toLowerCase();
      const filtered = q
        ? res.data.filter((u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q))
        : res.data;
      setUsers(filtered);
    } catch (e) {
      setError(e as AdminUserError);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  async function handleStatusChange(user: AdminUser, next: 'ACTIVE' | 'LOCKED' | 'INACTIVE') {
    setActionError(null);
    setBusyId(user.id);
    try {
      const updated = await updateAdminUserStatus(user.id, { status: next });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setConfirmTarget(null);
    } catch (e) {
      setActionError(e as AdminUserError);
    } finally {
      setBusyId(null);
    }
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
          <Alert tone="info">Không có quyền truy cập — cần vai trò ADMIN (403)</Alert>
          <EmptyState title="Bạn không thể quản lý tài khoản">
            Tài khoản hiện tại không đủ quyền. Hãy liên hệ quản trị viên hoặc đăng nhập bằng tài
            khoản quản trị để tiếp tục.
          </EmptyState>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách tài khoản'}</Alert>
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
            <label className="bf-label" htmlFor="admin-user-search">Tìm kiếm</label>
            <Input
              id="admin-user-search"
              placeholder="Email hoặc họ tên…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <div className="bf-field" style={{ minWidth: 180 }}>
            <label className="bf-label" htmlFor="admin-user-status">Trạng thái</label>
            <select
              id="admin-user-status"
              className="bf-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Bị khóa</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>
          <Button variant="secondary" onClick={() => setSearch(searchInput)}>Tìm</Button>
        </div>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Tổng: {users.length} tài khoản · Tài khoản LOCKED/INACTIVE không thể đăng nhập hay nhận phân công mới · Không có xóa cứng — dùng ngừng hoạt động.
        </p>
      </Card>

      {actionError ? (
        <Alert tone="error">{actionError.message || 'Thao tác thất bại'}</Alert>
      ) : null}

      {confirmTarget ? (
        <Card>
          <Alert tone="info">
            Xác nhận {confirmTarget.next === 'LOCKED' ? 'khóa' : confirmTarget.next === 'INACTIVE' ? 'ngừng hoạt động' : 'mở khóa / kích hoạt'} tài khoản{' '}
            <strong>{confirmTarget.user.email}</strong>?
          </Alert>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button
              onClick={() => void handleStatusChange(confirmTarget.user, confirmTarget.next as 'ACTIVE' | 'LOCKED' | 'INACTIVE')}
              loading={busyId === confirmTarget.user.id}
              aria-busy={busyId === confirmTarget.user.id}
            >
              Xác nhận
            </Button>
            <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Hủy</Button>
          </div>
        </Card>
      ) : null}

      {users.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có tài khoản nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc trạng thái để xem thêm tài khoản.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <a href={`/admin/users/${u.id}`} style={{ fontWeight: 600 }}>{u.fullName}</a>
                    </td>
                    <td>{u.email}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {u.status !== 'LOCKED' ? (
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmTarget({ user: u, next: 'LOCKED' })}
                            disabled={busyId === u.id}
                          >
                            Khóa
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmTarget({ user: u, next: 'ACTIVE' })}
                            disabled={busyId === u.id}
                          >
                            Mở khóa
                          </Button>
                        )}
                        {u.status !== 'INACTIVE' ? (
                          <Button
                            variant="secondary"
                            onClick={() => setConfirmTarget({ user: u, next: 'INACTIVE' })}
                            disabled={busyId === u.id}
                          >
                            Ngừng hoạt động
                          </Button>
                        ) : null}
                        <a href={`/admin/users/${u.id}/edit`}>Sửa</a>
                        <a href={`/admin/users/${u.id}/roles`}>Vai trò</a>
                      </div>
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
