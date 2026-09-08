'use client';

import * as React from 'react';
import {
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  ADDABLE_PROJECT_MEMBER_ROLES,
  type ProjectMember,
  type ApiError,
} from '@/lib/api/projects';
import { listWorkers, type Worker } from '@/lib/api/workers';
import { useCanManageProjects } from '@/lib/auth/roles';
import { PROJECT_REASON_MAX_LENGTH } from './ProjectStatusDialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState, EmptyProfileIcon } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { Select } from '@/components/ui/select/Select';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  projectId: string;
  /** Manager hiện tại của dự án — row của manager ẩn nút xóa (đổi qua Sửa hồ sơ). */
  managerId: string | null;
  onChanged?: () => void;
}

function workerLabel(w: Worker): string {
  return `${w.fullName} · ${w.employeeCode ?? w.id.slice(0, 8)}`;
}

function memberDisplayName(m: ProjectMember, workerNames: Map<string, string>): string {
  if (m.userName) return `${m.userName} · ${m.userCode ?? m.userId.slice(0, 8)}`;
  const hit = workerNames.get(m.userId);
  if (hit) return hit;
  return `${m.userId.slice(0, 8)}…`;
}

function roleLabel(role: string): string {
  switch (role) {
    case 'MANAGER':
      return 'QUẢN LÝ';
    case 'COORDINATOR':
      return 'ĐIỀU PHỐI';
    case 'QC':
      return 'QC';
    case 'WORKER':
      return 'THÀNH VIÊN';
    case 'VIEWER':
      return 'XEM';
    default:
      return role;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

function membershipPeriod(m: ProjectMember): string {
  return m.leftAt ? `${formatDate(m.joinedAt)} → ${formatDate(m.leftAt)}` : `${formatDate(m.joinedAt)} → nay`;
}

/**
 * PRJ-SRS-005 (issue #36) — quản lý thành viên dự án (mirror CrewMembers #30).
 * PRJ-SRS-006 (issue #37) — reads mở cho mọi ACTIVE member (kể cả WORKER/QC/
 * VIEWER): danh sách + lịch sử hiển thị cho bất kỳ ai load được; write
 * controls (form thêm, nút xóa) gated bởi canManageProjects (ADMIN +
 * PROJECT_MANAGER global, fail-closed — server authoritative kiểm tra
 * membership MANAGER/COORDINATOR, 403 → message graceful). 403 ở list nghĩa
 * là ngoài scope → EmptyState 'Bạn không phải thành viên dự án này' + icon,
 * KHÔNG Alert đỏ.
 * - Danh sách active (+ worker-name lookup fallback khi API không join tên).
 * - Thêm: user select listWorkers({status:'ACTIVE',limit:100}) + lọc text client
 *   (tên/mã NV/email, label 'tên · mã NV') + role select 4 giá trị
 *   (COORDINATOR/QC/WORKER/VIEWER); MANAGER bị chặn client-side (không có trong
 *   select) lẫn server-side (400 fieldErrors projectRole → PATCH managerId).
 * - Xóa mềm từng member active (trừ row của manager hiện tại — đổi quản lý qua
 *   form Sửa hồ sơ): confirm inline + reason optional (max 500, counter).
 * - Lịch sử: 'Xem lịch sử' toggle → includeInactive=true (badge 'Đã rời',
 *   period joined→left, role).
 */
export function ProjectMembers({ projectId, managerId, onChanged }: Props) {
  // Write-gate client-side (server là authoritative theo scope membership).
  const canManage = useCanManageProjects();
  const [members, setMembers] = React.useState<ProjectMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const [showHistory, setShowHistory] = React.useState(false);

  const [workerNames, setWorkerNames] = React.useState<Map<string, string>>(new Map());

  // Add form
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [userId, setUserId] = React.useState('');
  const [userSearch, setUserSearch] = React.useState('');
  const [projectRole, setProjectRole] = React.useState('');
  const [addPending, setAddPending] = React.useState(false);
  const [addFieldErrors, setAddFieldErrors] = React.useState<Record<string, string[]>>({});
  const [addGlobalError, setAddGlobalError] = React.useState<string | null>(null);
  const [addSuccess, setAddSuccess] = React.useState<string | null>(null);

  // Remove confirm (per-row inline) — pending theo row, chỉ row đang
  // xóa + dialog của nó bị disable.
  const [confirmMemberId, setConfirmMemberId] = React.useState<string | null>(null);
  const [removeReason, setRemoveReason] = React.useState('');
  const [removePendingId, setRemovePendingId] = React.useState<string | null>(null);
  const [removeFieldError, setRemoveFieldError] = React.useState<string | null>(null);
  const [removeGlobalError, setRemoveGlobalError] = React.useState<string | null>(null);
  const [removeNotice, setRemoveNotice] = React.useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjectMembers(projectId, showHistory ? { includeInactive: true } : {});
      setMembers(res.data);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [projectId, showHistory]);

  React.useEffect(() => {
    void load();
  }, [load, retryKey]);

  function reloadMembers() {
    setRetryKey((k) => k + 1);
  }

  // Worker ACTIVE cho select thêm + fallback tra tên (pattern CrewForm leader selector).
  React.useEffect(() => {
    let cancelled = false;
    async function loadWorkers() {
      try {
        const res = await listWorkers({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (cancelled) return;
        setWorkers(res.data);
        setWorkerNames(new Map(res.data.map((w) => [w.id, workerLabel(w)])));
      } catch {
        if (!cancelled) {
          setWorkers([]);
          setWorkerNames(new Map());
        }
      }
    }
    void loadWorkers();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWorkers = React.useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.fullName.toLowerCase().includes(q) ||
        (w.employeeCode ?? '').toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q),
    );
  }, [workers, userSearch]);

  const activeMembers = React.useMemo(() => members.filter((m) => m.isActive), [members]);

  function isManagerRow(m: ProjectMember): boolean {
    return managerId !== null && m.userId === managerId;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addPending) return;
    setAddPending(true);
    setAddFieldErrors({});
    setAddGlobalError(null);
    setAddSuccess(null);
    try {
      const res = await addProjectMember(projectId, { userId, projectRole });
      const name = memberDisplayName(res, workerNames);
      setAddSuccess(`Đã thêm ${name} vào dự án với vai trò ${roleLabel(res.projectRole)}.`);
      toast.success({ title: `Đã thêm ${name} vào dự án.` });
      setUserId('');
      setUserSearch('');
      setProjectRole('');
      reloadMembers();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.code === 'MEMBER_DUPLICATE') {
        setAddFieldErrors({ userId: ['Thành viên đã trong dự án'] });
        setAddGlobalError(e2.message);
      } else if (e2.fieldErrors && Object.keys(e2.fieldErrors).length > 0) {
        const fe: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(e2.fieldErrors)) {
          if (k !== '_global') fe[k] = v;
        }
        setAddFieldErrors(fe);
        setAddGlobalError(e2.message);
      } else if (e2.status === 401) {
        setAddGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      } else if (e2.status === 403) {
        setAddGlobalError('Không có quyền — cần ADMIN hoặc là quản lý/điều phối viên của dự án (403).');
      } else {
        setAddGlobalError(e2.message || 'Thêm thành viên thất bại');
      }
    } finally {
      setAddPending(false);
    }
  }

  function openRemoveConfirm(m: ProjectMember) {
    setConfirmMemberId(m.id);
    setRemoveReason('');
    setRemoveFieldError(null);
    setRemoveGlobalError(null);
    setRemoveNotice(null);
    setRemoveSuccess(null);
  }

  async function handleRemove(m: ProjectMember) {
    if (removePendingId) return;
    setRemovePendingId(m.id);
    setRemoveFieldError(null);
    setRemoveGlobalError(null);
    setRemoveNotice(null);
    setRemoveSuccess(null);
    try {
      const res = await removeProjectMember(projectId, m.id, {
        reason: removeReason.trim() || null,
      });
      const name = memberDisplayName(res, workerNames);
      if (res.alreadyRemoved) {
        setRemoveNotice(`${name} đã rời dự án trước đó — không thay đổi gì thêm.`);
      } else {
        setRemoveSuccess(`Đã xóa ${name} khỏi dự án — lịch sử thành viên vẫn được giữ.`);
      }
      setConfirmMemberId(null);
      reloadMembers();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.code === 'MANAGER_MEMBER') {
        setRemoveGlobalError('Thành viên này là quản lý hiện tại của dự án — đổi quản lý qua Sửa hồ sơ.');
      } else if (e2.fieldErrors?.reason?.length) setRemoveFieldError(e2.fieldErrors.reason.join(' '));
      else if (e2.status === 401) setRemoveGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setRemoveGlobalError('Không có quyền — cần ADMIN hoặc là quản lý/điều phối viên của dự án (403).');
      else setRemoveGlobalError(e2.message || 'Xóa thành viên thất bại');
    } finally {
      setRemovePendingId(null);
    }
  }

  function renderListError() {
    if (!error) return null;
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
    // PRJ-SRS-006 — 403 ở members-read nghĩa là ngoài scope (không phải ACTIVE
    // member): EmptyState trung tính + icon, KHÔNG Alert đỏ.
    if (error.status === 403) {
      return (
        <EmptyState
          title="Bạn không phải thành viên dự án này"
          icon={<EmptyProfileIcon />}
          action={
            <Button variant="secondary" onClick={reloadMembers}>
              Thử lại
            </Button>
          }
        >
          Liên hệ quản lý dự án để được thêm vào, hoặc quay lại danh sách dự án của bạn.
        </EmptyState>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách thành viên'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={reloadMembers}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  const confirming = confirmMemberId ? members.find((m) => m.id === confirmMemberId) ?? null : null;
  const visibleMembers = showHistory ? members : activeMembers;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="bf-card-head">
        <span className="bf-card-title">Thành viên dự án</span>
      </div>

      {removeNotice ? <Alert tone="info">{removeNotice}</Alert> : null}
      {removeSuccess ? <Alert tone="success">{removeSuccess}</Alert> : null}

      {loading ? (
        <p aria-busy="true">Đang tải danh sách thành viên…</p>
      ) : (
        renderListError() ??
        (visibleMembers.length === 0 && !showHistory ? (
          <EmptyState title="Chưa có thành viên — thêm thành viên đầu tiên">
            Chọn người dùng đang hoạt động ở form bên dưới để thêm vào dự án.
          </EmptyState>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
            {visibleMembers.map((m) => (
              <li
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  border: '1px solid var(--bf-line)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {memberDisplayName(m, workerNames)}{' '}
                    <span
                      className={m.projectRole === 'MANAGER' ? 'bf-badge-info' : 'bf-badge-neutral'}
                      style={{ fontWeight: 500, fontSize: '0.75rem' }}
                    >
                      {roleLabel(m.projectRole)}
                    </span>{' '}
                    {!m.isActive ? (
                      <span className="bf-badge-neutral" style={{ fontSize: '0.75rem' }}>
                        Đã rời
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
                    {showHistory ? (
                      <>Giai đoạn: {membershipPeriod(m)} · </>
                    ) : (
                      <>Tham gia ngày {formatDate(m.joinedAt)} · </>
                    )}
                    Vai trò {roleLabel(m.projectRole)}
                  </div>
                  {isManagerRow(m) ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
                      Đổi quản lý qua Sửa hồ sơ.
                    </div>
                  ) : null}
                </div>
                {/* PRJ-SRS-006 — nút xóa gated bởi canManage (fail-closed);
                    member thường (WORKER/QC/VIEWER) chỉ xem danh sách. */}
                {canManage && m.isActive && !isManagerRow(m) ? (
                  <Button variant="secondary" onClick={() => openRemoveConfirm(m)} disabled={removePendingId === m.id}>
                    Xóa khỏi dự án
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ))
      )}

      {confirming ? (
        <div
          role="dialog"
          aria-label={`Xác nhận xóa ${memberDisplayName(confirming, workerNames)} khỏi dự án`}
          style={{
            border: '1px solid var(--bf-line)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Xóa {memberDisplayName(confirming, workerNames)} khỏi dự án?
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
            Xóa mềm — lịch sử thành viên vẫn được giữ, chỉ kết thúc vai trò trong dự án.
          </p>
          <div className="bf-field">
            <label className="bf-label" htmlFor="member-remove-reason">
              Lý do (không bắt buộc)
            </label>
            <textarea
              id="member-remove-reason"
              className="bf-input"
              rows={2}
              maxLength={PROJECT_REASON_MAX_LENGTH}
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Ví dụ: kết thúc phân công giai đoạn 1…"
              aria-describedby="member-remove-reason-count"
            />
            <p id="member-remove-reason-count" style={{ fontSize: '0.8rem', color: 'var(--bf-muted)', margin: '0.25rem 0 0' }}>
              {removeReason.length}/{PROJECT_REASON_MAX_LENGTH} ký tự · lý do được lưu cùng nhật ký thao tác
            </p>
          </div>
          {removeFieldError ? (
            <p id="member-remove-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: 0 }}>
              {removeFieldError}
            </p>
          ) : null}
          {removeGlobalError ? <Alert tone="error">{removeGlobalError}</Alert> : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => void handleRemove(confirming)} disabled={removePendingId !== null}>
              {removePendingId ? 'Đang xóa…' : 'Xác nhận xóa'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmMemberId(null)} disabled={removePendingId !== null}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}

      {/* PRJ-SRS-006 — form thêm gated bởi canManage (fail-closed); member
          thường chỉ xem danh sách + lịch sử. */}
      {canManage ? (
      <form onSubmit={(e) => void handleAdd(e)} style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Thêm thành viên</p>
        {addSuccess ? <Alert tone="success">{addSuccess}</Alert> : null}
        {addGlobalError && !addFieldErrors.userId && !addFieldErrors.projectRole ? (
          <Alert tone="error">{addGlobalError}</Alert>
        ) : null}
        <div className="bf-field">
          <label className="bf-label" htmlFor="member-add-search">
            Tìm người dùng
          </label>
          <Input
            id="member-add-search"
            placeholder="Tên, mã NV, email…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            disabled={addPending}
          />
        </div>
        <div className="bf-field">
          <Select
            id="member-add-user"
            label="Người dùng"
            value={userId}
            options={[
              { value: '', label: '— Chọn người dùng đang hoạt động —' },
              ...filteredWorkers.map((w) => ({ value: w.id, label: workerLabel(w) })),
            ]}
            onChange={setUserId}
            disabled={addPending}
            aria-invalid={addFieldErrors.userId ? true : undefined}
            aria-describedby={addFieldErrors.userId ? 'member-add-user-error' : undefined}
          />
          {addFieldErrors.userId ? (
            <p id="member-add-user-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {addFieldErrors.userId.join(' ')}
            </p>
          ) : null}
        </div>
        <div className="bf-field">
          <Select
            id="member-add-role"
            label="Vai trò trong dự án"
            value={projectRole}
            options={[
              { value: '', label: '— Chọn vai trò —' },
              ...ADDABLE_PROJECT_MEMBER_ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
            ]}
            onChange={setProjectRole}
            disabled={addPending}
            aria-invalid={addFieldErrors.projectRole ? true : undefined}
            aria-describedby={addFieldErrors.projectRole ? 'member-add-role-error' : undefined}
          />
          {addFieldErrors.projectRole ? (
            <p id="member-add-role-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {addFieldErrors.projectRole.join(' ')}
            </p>
          ) : null}
          <p style={{ fontSize: '0.8rem', color: 'var(--bf-muted)', margin: '0.25rem 0 0' }}>
            Vai trò Quản lý chỉ đặt qua Sửa hồ sơ (trường quản lý dự án).
          </p>
        </div>
        <div>
          <Button variant="primary" type="submit" disabled={addPending || !userId || !projectRole}>
            {addPending ? 'Đang thêm…' : 'Thêm vào dự án'}
          </Button>
        </div>
      </form>
      ) : null}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Lịch sử thành viên</p>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />
          Xem lịch sử (kể cả thành viên đã rời)
        </label>
      </div>
    </div>
  );
}
