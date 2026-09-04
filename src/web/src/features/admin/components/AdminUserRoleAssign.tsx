'use client';

import * as React from 'react';
import {
  getUserRoles,
  assignRoles,
  type AdminRole,
  type AdminRolesError,
} from '@/lib/api/admin-roles';
import { listAdminUsers, type AdminUser } from '@/lib/api/admin-users';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

// Approved role catalog per SRS. Server re-validates; client shows only known roles.
const APPROVED_ROLE_CODES = ['ADMIN', 'WORKER'];

export function AdminUserRoleAssign({ userId }: { userId: string }) {
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [currentRoles, setCurrentRoles] = React.useState<AdminRole[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [initialRoleIds, setInitialRoleIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<AdminRolesError | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{ before: string[]; after: string[] } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, roles] = await Promise.all([
        listAdminUsers({ limit: 100 }),
        getUserRoles(userId),
      ]);
      const found = u.data.find((x) => x.id === userId) ?? null;
      setUser(found);
      setCurrentRoles(roles.roles);
      setSelected(new Set(roles.roles.map((r) => r.id)));
      setInitialRoleIds(roles.roles.map((r) => r.id).sort());
    } catch (e) {
      setLoadError(e as AdminRolesError);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function toggle(roleId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  }

  const diff = React.useMemo(() => {
    const after = [...selected].sort();
    const removed = initialRoleIds.filter((id) => !selected.has(id));
    const added = after.filter((id) => !initialRoleIds.includes(id));
    const roleById = new Map(currentRoles.map((r) => [r.id, r]));
    return { removed, added, after, roleById };
  }, [selected, initialRoleIds, currentRoles]);

  async function handleSave() {
    setGlobalError(null);
    setSuccess(null);
    if (diff.after.length === 0) {
      setGlobalError('Danh sách role không được để trống (policy yêu cầu ≥1 role)');
      return;
    }
    setSaving(true);
    try {
      const result = await assignRoles(userId, {
        roleIds: diff.after,
        reason: reason.trim() || null,
      });
      setSuccess({ before: result.beforeRoleIds, after: result.afterRoleIds });
      setCurrentRoles(result.roles);
      setInitialRoleIds(result.afterRoleIds);
      setSelected(new Set(result.afterRoleIds));
      setReason('');
    } catch (e) {
      setGlobalError((e as AdminRolesError).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card><p aria-busy="true">Đang tải vai trò…</p></Card>;
  }

  if (loadError) {
    if (loadError.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (loadError.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{loadError.message}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
          Vai trò: {user?.fullName ?? userId} {user ? <span style={{ color: '#6b7280', fontWeight: 400 }}>({user.email})</span> : null}
        </h2>
        {success ? (
          <Alert tone="success">
            Đã cập nhật vai trò ({success.before.length} → {success.after.length} role). Quyền mới có hiệu lực từ lần truy cập tiếp theo (đăng nhập lại nếu cần).
          </Alert>
        ) : null}
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}

        <p style={{ margin: '0.5rem 0 1rem', color: '#6b7280', fontSize: '0.9rem' }}>
          Chỉ vai trò đã phê duyệt mới gán được. Server kiểm tra quyền ở mọi thao tác.
        </p>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {currentRoles.length === 0 ? (
            <p style={{ margin: 0, color: '#6b7280' }}>Chưa có vai trò active nào — chọn bên dưới để gán.</p>
          ) : (
            currentRoles.map((r) => (
              <label key={r.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  disabled={saving}
                  aria-label={`Chọn vai trò ${r.code}`}
                />
                <strong>{r.code}</strong> — {r.name}
              </label>
            ))
          )}
          {currentRoles.length === 0 ? (
            <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              Catalog role được phép: {APPROVED_ROLE_CODES.join(', ')}. Danh sách đầy đủ lấy từ API GET /admin/users/:id/roles.
            </p>
          ) : null}
        </div>

        {hasChanges ? (
          <div style={{ marginTop: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <strong style={{ fontSize: '0.9rem' }}>Diff trước/sau:</strong>
            <div style={{ marginTop: 4, fontSize: '0.88rem' }}>
              {diff.added.length > 0 ? <div>+ Thêm: {diff.added.map((id) => diff.roleById.get(id)?.code ?? id).join(', ')}</div> : null}
              {diff.removed.length > 0 ? <div style={{ color: '#991b1b' }}>− Bỏ: {diff.removed.map((id) => diff.roleById.get(id)?.code ?? id).join(', ')}</div> : null}
              <div style={{ color: '#6b7280', marginTop: 4 }}>Sau khi lưu: {diff.after.length} role</div>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="aur-reason" style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: '0.9rem' }}>Lý do (tùy chọn, tối đa 500 ký tự)</label>
          <input
            id="aur-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }}
            placeholder="VD: Thăng chức sang vị trí công nhân..."
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem' }}>
          <Button onClick={() => void handleSave()} loading={saving} aria-busy={saving} disabled={!hasChanges || saving}>
            Lưu vai trò
          </Button>
          <a href="/admin/users" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Về danh sách</a>
        </div>
      </Card>
    </div>
  );
}
