'use client';

import * as React from 'react';
import { listAdminUsers, updateAdminUserStatus, type AdminUser, type AdminUserError } from '@/lib/api/admin-users';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Hoạt động', color: '#065f46' },
  LOCKED: { label: 'Bị khóa', color: '#92400e' },
  INACTIVE: { label: 'Ngừng hoạt động', color: '#991b1b' },
};

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
        <p aria-busy="true">Đang tải danh sách tài khoản…</p>
      </Card>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN (403)</Alert>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tài khoản hiện tại không đủ quyền quản lý tài khoản.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
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
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="admin-user-search" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Tìm kiếm</label>
            <input
              id="admin-user-search"
              placeholder="Email hoặc họ tên…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <label htmlFor="admin-user-status" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Trạng thái</label>
            <select
              id="admin-user-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', background: '#fff' }}
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Bị khóa</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>
          <Button variant="secondary" onClick={() => setSearch(searchInput)}>Tìm</Button>
          <a href="/admin/users/new" style={{ marginLeft: 'auto', alignSelf: 'center', color: '#1d4ed8', textDecoration: 'underline', fontWeight: 600 }}>+ Tạo tài khoản</a>
        </div>
        <p style={{ margin: '0.75rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
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
          <p style={{ margin: 0, color: '#6b7280' }}>Chưa có tài khoản nào phù hợp bộ lọc.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {users.map((u) => {
            const meta = STATUS_META[u.status] ?? { label: u.status, color: '#374151' };
            return (
              <Card key={u.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      <a href={`/admin/users/${u.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>{u.fullName}</a>{' '}
                      <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>· {u.email}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: '0.88rem', color: '#374151' }}>
                      Loại: {u.userType} · <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                      {u.employeeCode ? ` · Mã NV: ${u.employeeCode}` : ''}
                      {u.phone ? ` · SĐT: ${u.phone}` : ''}
                    </div>
                    <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>
                      Tạo: {new Date(u.createdAt).toLocaleDateString('vi-VN')} · Cập nhật: {new Date(u.updatedAt).toLocaleDateString('vi-VN')}
                    </div>
                    {u.status !== 'ACTIVE' ? (
                      <div style={{ marginTop: 6, fontSize: '0.8rem', background: u.status === 'LOCKED' ? '#fffbeb' : '#fef2f2', border: `1px solid ${u.status === 'LOCKED' ? '#fde68a' : '#fecaca'}`, color: u.status === 'LOCKED' ? '#92400e' : '#991b1b', borderRadius: 6, padding: '0.2rem 0.5rem', display: 'inline-block' }}>
                        {u.status === 'LOCKED' ? 'Tài khoản bị khóa — không thể đăng nhập' : 'Tài khoản ngừng hoạt động — không thể đăng nhập, không nhận phân công mới'}
                      </div>
                    ) : null}
                  </div>
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
                    <a href={`/admin/users/${u.id}/edit`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>Sửa</a>
                    <a href={`/admin/users/${u.id}/roles`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>Vai trò</a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
