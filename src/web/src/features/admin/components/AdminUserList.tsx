'use client';

import * as React from 'react';
import { listAdminUsers, updateAdminUserStatus, type AdminUser, type AdminUserError } from '@/lib/api/admin-users';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ClearFiltersButton,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';
import { AdminUserEditDialog } from './AdminUserEditDialog';
import { AdminUserRolesDialog } from './AdminUserRolesDialog';

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
  // CRUD popup (Pinback /admin/users/:id/edit): nút 'Sửa' mở AdminUserEditDialog
  // (không điều hướng /edit); route /edit giữ hoạt động độc lập cho E2E drivers.
  const [editId, setEditId] = React.useState<string | null>(null);
  // CRUD popup (Pinback /admin/users/:id/roles): nút 'Vai trò' mở AdminUserRolesDialog
  // (không điều hướng /roles); route /roles giữ hoạt động độc lập.
  const [rolesId, setRolesId] = React.useState<string | null>(null);

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

  const hasActiveFilter = searchInput.trim() !== '' || search.trim() !== '' || statusFilter !== '';

  function handleClearFilters() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('');
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
        <ListToolbar count={`Tổng: ${users.length} tài khoản`}>
          <SearchField
            id="admin-user-search"
            label="Tìm kiếm"
            placeholder="Email hoặc họ tên…"
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => setSearch(searchInput)}
          />
          <div className="bf-filter">
            <Select
              id="admin-user-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'LOCKED', label: 'Bị khóa' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
              ]}
              onChange={setStatusFilter}
            />
          </div>
          <Button variant="secondary" onClick={() => setSearch(searchInput)}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Tài khoản LOCKED/INACTIVE không thể đăng nhập hay nhận phân công mới · Không có xóa cứng — dùng ngừng hoạt động.
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
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <a href={`/admin/users/${u.id}`} style={{ fontWeight: 600, color: '#111827', textDecoration: 'none' }}>{u.fullName}</a>
                    </td>
                    <td>{u.email}</td>
                    <td><StatusBadge status={u.status} /></td>
                    <td className="bf-cell-actions">
                      <span className="bf-row-actions">
                        {u.status !== 'LOCKED' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setConfirmTarget({ user: u, next: 'LOCKED' })}
                            disabled={busyId === u.id}
                          >
                            Khóa
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setConfirmTarget({ user: u, next: 'ACTIVE' })}
                            disabled={busyId === u.id}
                          >
                            Mở khóa
                          </Button>
                        )}
                        {u.status !== 'INACTIVE' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setConfirmTarget({ user: u, next: 'INACTIVE' })}
                            disabled={busyId === u.id}
                          >
                            Ngừng hoạt động
                          </Button>
                        ) : null}
                        <Tooltip content="Sửa hồ sơ tài khoản">
                          <button
                            type="button"
                            className="bf-detail-link"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                            onClick={() => setEditId(u.id)}
                          >
                            Sửa
                          </button>
                        </Tooltip>
                        <Tooltip content="Gán vai trò">
                          <button
                            type="button"
                            className="bf-detail-link"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                            onClick={() => setRolesId(u.id)}
                          >
                            Vai trò
                          </button>
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

      {editId ? (
        <AdminUserEditDialog
          id={editId}
          open
          onClose={() => setEditId(null)}
          onUpdated={() => void load()}
        />
      ) : null}

      {rolesId ? (
        <AdminUserRolesDialog
          id={rolesId}
          open
          onClose={() => setRolesId(null)}
          onUpdated={() => void load()}
        />
      ) : null}
    </div>
  );
}
