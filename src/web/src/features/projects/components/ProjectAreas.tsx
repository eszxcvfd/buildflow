'use client';

import * as React from 'react';
import {
  listProjectAreas,
  createProjectArea,
  updateProjectArea,
  type ProjectArea,
  type ApiError,
} from '@/lib/api/projects';
import { useCanManageProjects } from '@/lib/auth/roles';
import {
  validateProjectAreaCreate,
  validateProjectAreaUpdate,
  PROJECT_AREA_REASON_MAX_LENGTH,
} from '../schemas/project-area.schema';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  projectId: string;
  onChanged?: () => void;
}

function areaCodeLabel(code: string | null): string {
  return code ?? '—';
}

/**
 * PRJ-SRS-003 (issue #34) — quản lý khu vực/hạng mục của dự án
 * (mirror ProjectMembers #36).
 * - Danh sách kèm inactive (badge 'Ngừng sử dụng', hàng xám); toggle
 *   'Chỉ hiện đang sử dụng' → `?activeOnly=true` (future WO picker).
 * - Tạo: name bắt buộc (1–150) + code optional (mirror policy API) —
 *   validate theo field trước submit, lỗi 409 AREA_DUPLICATE /
 *   AREA_CODE_DUPLICATE map về field tương ứng.
 * - Đổi tên inline từng hàng (name + code, code rỗng = gỡ mã → gửi null).
 * - Ngừng sử dụng: confirm inline + reason optional (max 500, counter);
 *   `alreadyInactive` → notice info, không báo lỗi. Kích hoạt lại cùng
 *   đường PATCH (không confirm). Không có hard delete.
 * - Write controls gated bởi canManageProjects (ADMIN + PROJECT_MANAGER,
 *   fail-closed); reads mở cho mọi member nên list luôn fetch.
 */
export function ProjectAreas({ projectId, onChanged }: Props) {
  const canManage = useCanManageProjects();

  const [areas, setAreas] = React.useState<ProjectArea[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const [activeOnly, setActiveOnly] = React.useState(false);

  const [notice, setNotice] = React.useState<{ tone: 'success' | 'info'; text: string } | null>(null);
  // Thông báo tạo/sửa/xóa khu vực hiển thị cả inline (giữ assert hiện có) lẫn
  // Ark Toast thoáng qua.
  React.useEffect(() => {
    if (notice) {
      if (notice.tone === 'success') toast.success({ title: notice.text });
      else toast.info({ title: notice.text });
    }
  }, [notice]);

  // Create form
  const [createName, setCreateName] = React.useState('');
  const [createCode, setCreateCode] = React.useState('');
  const [createPending, setCreatePending] = React.useState(false);
  const [createFieldErrors, setCreateFieldErrors] = React.useState<Record<string, string[]>>({});
  const [createGlobalError, setCreateGlobalError] = React.useState<string | null>(null);

  // Rename inline (per-row) — pending theo row.
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editCode, setEditCode] = React.useState('');
  const [editPendingId, setEditPendingId] = React.useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = React.useState<Record<string, string[]>>({});
  const [editGlobalError, setEditGlobalError] = React.useState<string | null>(null);

  // Deactivate confirm (per-row inline) — pending theo row.
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = React.useState('');
  const [deactivateReasonError, setDeactivateReasonError] = React.useState<string | null>(null);
  const [statusPendingId, setStatusPendingId] = React.useState<string | null>(null);
  const [statusGlobalError, setStatusGlobalError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjectAreas(projectId, activeOnly ? { activeOnly: true } : {});
      setAreas(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeOnly]);

  React.useEffect(() => {
    void load();
  }, [load, retryKey]);

  function reloadAreas() {
    setRetryKey((k) => k + 1);
  }

  function applyApiFieldErrors(
    e: ApiError,
    setFieldErrors: (fe: Record<string, string[]>) => void,
    setGlobal: (msg: string | null) => void,
  ): void {
    if (e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
      const fe: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(e.fieldErrors)) {
        if (k !== '_global') fe[k] = v;
      }
      setFieldErrors(fe);
      setGlobal(e.message);
    } else if (e.status === 401) {
      setGlobal('Phiên hết hạn, vui lòng đăng nhập lại.');
    } else if (e.status === 403) {
      setGlobal('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER và là thành viên dự án.');
    } else {
      setGlobal(e.message || 'Thao tác thất bại');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (createPending) return;
    const check = validateProjectAreaCreate({ name: createName, code: createCode });
    if (!check.valid) {
      setCreateFieldErrors(check.fieldErrors);
      setCreateGlobalError(null);
      return;
    }
    setCreatePending(true);
    setCreateFieldErrors({});
    setCreateGlobalError(null);
    setNotice(null);
    try {
      const code = createCode.trim() || null;
      const res = await createProjectArea(projectId, { name: createName.trim(), ...(code ? { code } : {}) });
      setNotice({ tone: 'success', text: `Đã thêm khu vực “${res.name}” vào dự án.` });
      setCreateName('');
      setCreateCode('');
      reloadAreas();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.code === 'AREA_DUPLICATE') {
        setCreateFieldErrors({ name: ['Tên khu vực đã tồn tại trong dự án'] });
        setCreateGlobalError(e2.message);
      } else if (e2.code === 'AREA_CODE_DUPLICATE') {
        setCreateFieldErrors({ code: ['Mã khu vực đã tồn tại trong dự án'] });
        setCreateGlobalError(e2.message);
      } else {
        applyApiFieldErrors(e2, setCreateFieldErrors, setCreateGlobalError);
      }
    } finally {
      setCreatePending(false);
    }
  }

  function openRename(a: ProjectArea) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditCode(a.code ?? '');
    setEditFieldErrors({});
    setEditGlobalError(null);
    setNotice(null);
  }

  async function handleRename(a: ProjectArea) {
    if (editPendingId) return;
    const codeValue = editCode.trim();
    const check = validateProjectAreaUpdate({ name: editName, code: codeValue || null });
    if (!check.valid) {
      setEditFieldErrors(check.fieldErrors);
      setEditGlobalError(null);
      return;
    }
    // No-op: không thay đổi hiệu lực → đóng editor, không gọi API
    // (server cũng no-op không audit).
    if (editName.trim() === a.name && codeValue === (a.code ?? '')) {
      setEditingId(null);
      return;
    }
    setEditPendingId(a.id);
    setEditFieldErrors({});
    setEditGlobalError(null);
    setNotice(null);
    try {
      const res = await updateProjectArea(projectId, a.id, {
        name: editName.trim(),
        code: codeValue || null,
      });
      setNotice({ tone: 'success', text: `Đã đổi tên khu vực thành “${res.name}”.` });
      setEditingId(null);
      reloadAreas();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.code === 'AREA_DUPLICATE') {
        setEditFieldErrors({ name: ['Tên khu vực đã tồn tại trong dự án'] });
        setEditGlobalError(e2.message);
      } else if (e2.code === 'AREA_CODE_DUPLICATE') {
        setEditFieldErrors({ code: ['Mã khu vực đã tồn tại trong dự án'] });
        setEditGlobalError(e2.message);
      } else {
        applyApiFieldErrors(e2, setEditFieldErrors, setEditGlobalError);
      }
    } finally {
      setEditPendingId(null);
    }
  }

  function openDeactivateConfirm(a: ProjectArea) {
    setConfirmId(a.id);
    setDeactivateReason('');
    setDeactivateReasonError(null);
    setStatusGlobalError(null);
    setNotice(null);
  }

  async function handleDeactivate(a: ProjectArea) {
    if (statusPendingId) return;
    const check = validateProjectAreaUpdate({ reason: deactivateReason || null });
    if (!check.valid) {
      setDeactivateReasonError(check.fieldErrors.reason?.join(' ') ?? 'Lý do không hợp lệ');
      return;
    }
    setStatusPendingId(a.id);
    setDeactivateReasonError(null);
    setStatusGlobalError(null);
    setNotice(null);
    try {
      const res = await updateProjectArea(projectId, a.id, {
        isActive: false,
        reason: deactivateReason.trim() || null,
      });
      if (res.alreadyInactive) {
        setNotice({ tone: 'info', text: `Khu vực “${res.name}” đã ngừng sử dụng trước đó — không thay đổi gì thêm.` });
      } else {
        setNotice({ tone: 'success', text: `Đã ngừng sử dụng khu vực “${res.name}” — lịch sử vẫn được giữ.` });
      }
      setConfirmId(null);
      reloadAreas();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.fieldErrors?.reason?.length) setDeactivateReasonError(e2.fieldErrors.reason.join(' '));
      else if (e2.status === 401) setStatusGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setStatusGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER và là thành viên dự án.');
      else setStatusGlobalError(e2.message || 'Ngừng sử dụng khu vực thất bại');
    } finally {
      setStatusPendingId(null);
    }
  }

  async function handleReactivate(a: ProjectArea) {
    if (statusPendingId) return;
    setStatusPendingId(a.id);
    setStatusGlobalError(null);
    setNotice(null);
    try {
      const res = await updateProjectArea(projectId, a.id, { isActive: true });
      setNotice({ tone: 'success', text: `Đã kích hoạt lại khu vực “${res.name}”.` });
      reloadAreas();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.status === 401) setStatusGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setStatusGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER và là thành viên dự án.');
      else setStatusGlobalError(e2.message || 'Kích hoạt lại khu vực thất bại');
    } finally {
      setStatusPendingId(null);
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
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền xem khu vực — cần là thành viên dự án (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={reloadAreas}>
              Thử lại
            </Button>
          </div>
        </Card>
      );
    }
    if (error.status === 404) {
      return (
        <Card>
          <Alert tone="error">Không tìm thấy dự án (404) — kiểm tra lại đường dẫn</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={reloadAreas}>
              Thử lại
            </Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách khu vực'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={reloadAreas}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  const confirming = confirmId ? areas.find((a) => a.id === confirmId) ?? null : null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="bf-card-head">
        <span className="bf-card-title">Khu vực / Hạng mục</span>
        {total > 0 ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>{total} khu vực</span>
        ) : null}
      </div>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      {statusGlobalError ? <Alert tone="error">{statusGlobalError}</Alert> : null}

      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(e) => setActiveOnly(e.target.checked)}
        />
        Chỉ hiện khu vực đang sử dụng
      </label>

      {loading ? (
        <p aria-busy="true">Đang tải danh sách khu vực…</p>
      ) : (
        renderListError() ??
        (areas.length === 0 ? (
          <EmptyState
            title={activeOnly ? 'Không có khu vực đang sử dụng' : 'Chưa có khu vực — thêm khu vực đầu tiên'}
          >
            {activeOnly
              ? 'Bỏ chọn “Chỉ hiện khu vực đang sử dụng” để xem toàn bộ.'
              : 'Nhập tên ở form bên dưới để thêm khu vực/hạng mục cho dự án.'}
          </EmptyState>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
            {areas.map((a) => (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  border: '1px solid var(--bf-line)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  ...(a.isActive ? {} : { opacity: 0.65, background: 'var(--bf-muted-bg, transparent)' }),
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {editingId === a.id ? (
                    <div style={{ display: 'grid', gap: '0.5rem', minWidth: 'min(20rem, 100%)' }}>
                      <div className="bf-field">
                        <label className="bf-label" htmlFor={`area-edit-name-${a.id}`}>
                          Tên khu vực
                        </label>
                        <Input
                          id={`area-edit-name-${a.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={editPendingId === a.id}
                          aria-invalid={editFieldErrors.name ? true : undefined}
                          aria-describedby={editFieldErrors.name ? `area-edit-name-error-${a.id}` : undefined}
                        />
                        {editFieldErrors.name ? (
                          <p id={`area-edit-name-error-${a.id}`} role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                            {editFieldErrors.name.join(' ')}
                          </p>
                        ) : null}
                      </div>
                      <div className="bf-field">
                        <label className="bf-label" htmlFor={`area-edit-code-${a.id}`}>
                          Mã khu vực (để trống = gỡ mã)
                        </label>
                        <Input
                          id={`area-edit-code-${a.id}`}
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          disabled={editPendingId === a.id}
                          aria-invalid={editFieldErrors.code ? true : undefined}
                          aria-describedby={editFieldErrors.code ? `area-edit-code-error-${a.id}` : undefined}
                        />
                        {editFieldErrors.code ? (
                          <p id={`area-edit-code-error-${a.id}`} role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                            {editFieldErrors.code.join(' ')}
                          </p>
                        ) : null}
                      </div>
                      {editGlobalError ? <Alert tone="error">{editGlobalError}</Alert> : null}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Button variant="primary" onClick={() => void handleRename(a)} disabled={editPendingId === a.id}>
                          {editPendingId === a.id ? 'Đang lưu…' : 'Lưu'}
                        </Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)} disabled={editPendingId === a.id}>
                          Hủy
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600 }}>
                        {a.name}{' '}
                        {a.code ? (
                          <span className="bf-badge-neutral" style={{ fontWeight: 500, fontSize: '0.75rem' }}>
                            {a.code}
                          </span>
                        ) : null}{' '}
                        {!a.isActive ? (
                          <span className="bf-badge-neutral" style={{ fontSize: '0.75rem' }}>
                            Ngừng sử dụng
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
                        Mã: {areaCodeLabel(a.code)}
                      </div>
                    </>
                  )}
                </div>
                {canManage && editingId !== a.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button variant="secondary" onClick={() => openRename(a)} disabled={statusPendingId === a.id || editPendingId !== null}>
                      Đổi tên
                    </Button>
                    {a.isActive ? (
                      <Button variant="secondary" onClick={() => openDeactivateConfirm(a)} disabled={statusPendingId === a.id}>
                        Ngừng sử dụng
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => void handleReactivate(a)} disabled={statusPendingId === a.id}>
                        {statusPendingId === a.id ? 'Đang xử lý…' : 'Kích hoạt lại'}
                      </Button>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ))
      )}

      {confirming ? (
        <div
          role="dialog"
          aria-label={`Xác nhận ngừng sử dụng khu vực ${confirming.name}`}
          style={{
            border: '1px solid var(--bf-line)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Ngừng sử dụng khu vực “{confirming.name}”?
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
            Ngừng sử dụng giữ lại lịch sử — tên có thể tái sử dụng, mã vẫn được giữ.
            Không có xóa vĩnh viễn.
          </p>
          <div className="bf-field">
            <label className="bf-label" htmlFor="area-deactivate-reason">
              Lý do (không bắt buộc)
            </label>
            <textarea
              id="area-deactivate-reason"
              className="bf-input"
              rows={2}
              maxLength={PROJECT_AREA_REASON_MAX_LENGTH}
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="Ví dụ: gộp khu vực A vào khu vực B…"
              aria-describedby="area-deactivate-reason-count"
            />
            <p id="area-deactivate-reason-count" style={{ fontSize: '0.8rem', color: 'var(--bf-muted)', margin: '0.25rem 0 0' }}>
              {deactivateReason.length}/{PROJECT_AREA_REASON_MAX_LENGTH} ký tự · lý do được lưu cùng nhật ký thao tác
            </p>
          </div>
          {deactivateReasonError ? (
            <p id="area-deactivate-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: 0 }}>
              {deactivateReasonError}
            </p>
          ) : null}
          {statusGlobalError ? <Alert tone="error">{statusGlobalError}</Alert> : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => void handleDeactivate(confirming)} disabled={statusPendingId !== null}>
              {statusPendingId ? 'Đang xử lý…' : 'Xác nhận ngừng sử dụng'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={statusPendingId !== null}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'grid', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Thêm khu vực</p>
          {createGlobalError && !createFieldErrors.name && !createFieldErrors.code ? (
            <Alert tone="error">{createGlobalError}</Alert>
          ) : null}
          <div className="bf-field">
            <label className="bf-label" htmlFor="area-add-name">
              Tên khu vực
            </label>
            <Input
              id="area-add-name"
              placeholder="Ví dụ: Tầng 1 — Khu A…"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={createPending}
              aria-invalid={createFieldErrors.name ? true : undefined}
              aria-describedby={createFieldErrors.name ? 'area-add-name-error' : undefined}
            />
            {createFieldErrors.name ? (
              <p id="area-add-name-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {createFieldErrors.name.join(' ')}
              </p>
            ) : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="area-add-code">
              Mã khu vực (không bắt buộc)
            </label>
            <Input
              id="area-add-code"
              placeholder="Ví dụ: T1-A…"
              value={createCode}
              onChange={(e) => setCreateCode(e.target.value)}
              disabled={createPending}
              aria-invalid={createFieldErrors.code ? true : undefined}
              aria-describedby={createFieldErrors.code ? 'area-add-code-error' : undefined}
            />
            {createFieldErrors.code ? (
              <p id="area-add-code-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {createFieldErrors.code.join(' ')}
              </p>
            ) : null}
          </div>
          <div>
            <Button variant="primary" type="submit" disabled={createPending || !createName.trim()}>
              {createPending ? 'Đang thêm…' : 'Thêm khu vực'}
            </Button>
          </div>
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
          Chỉ ADMIN và PROJECT_MANAGER là thành viên dự án mới được thêm/sửa khu vực.
        </p>
      )}
    </div>
  );
}
