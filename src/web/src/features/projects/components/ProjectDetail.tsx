'use client';

import * as React from 'react';
import { getProject, changeProjectStatus, type Project, type ProjectProfile } from '@/lib/api/projects';
import type { ApiError } from '@/lib/api/projects';
import { listWorkers, type Worker } from '@/lib/api/workers';
import { useCanManageProjects } from '@/lib/auth/roles';
import {
  ProjectStatusDialog,
  allowedProjectActionsFor,
  PROJECT_ACTION_LABEL,
  type ProjectStatusAction,
} from './ProjectStatusDialog';
import { ProjectMembers } from './ProjectMembers';
import { ProjectAreas } from './ProjectAreas';
import { StatusTimeline } from '@/features/resources/components/StatusTimeline';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';

function statusLabel(status: string): string {
  switch (status) {
    case 'DRAFT':
      return 'Nháp';
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'PAUSED':
      return 'Tạm dừng';
    case 'COMPLETED':
      return 'Hoàn thành';
    case 'CLOSED':
      return 'Đóng';
    default:
      return status;
  }
}

/**
 * PRJ-SRS-001 (issue #32) — chi tiết hồ sơ dự án (read-only ở slice này).
 * Reads là iam-owned, trả summary shape (id/code/name/status/managerId/
 * createdAt/updatedAt) nên các field hồ sơ đầy đủ (địa chỉ, múi giờ, ngày kế
 * hoạch, mô tả) hiển thị '—' cho đến khi reads trả full profile; tên quản lý
 * tra qua worker ACTIVE (fallback id rút gọn).
 * PRJ-SRS-002 (issue #33) — vòng đời dự án qua `PATCH /api/v1/projects/:id/status`
 * với `ProjectStatusDialog` (actions theo transition map L1 của trạng thái hiện
 * tại, gated bởi canManageProjects — ADMIN + PROJECT_MANAGER, fail-closed).
 * CTA 'Tạo dự án'/'Sửa hồ sơ' gated bởi canManageProjects() (fail-closed).
 */
export function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [managerName, setManagerName] = React.useState<string | null>(null);
  const canManage = useCanManageProjects();
  // PRJ-SRS-002 — state chuyển trạng thái.
  const [confirmAction, setConfirmAction] = React.useState<ProjectStatusAction | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionNotice, setActionNotice] = React.useState<{ tone: 'success' | 'info'; text: string } | null>(null);
  const [dialogServerMessage, setDialogServerMessage] = React.useState<string | null>(null);
  const [dialogReasonError, setDialogReasonError] = React.useState<string | null>(null);
  const [timelineKey, setTimelineKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await getProject(id);
      setProject(p);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Tra tên quản lý từ worker ACTIVE (fallback hiển thị rút gọn id).
  React.useEffect(() => {
    const managerId = project?.managerId ?? null;
    if (!managerId) {
      setManagerName(null);
      return;
    }
    let cancelled = false;
    async function lookup() {
      try {
        const res = await listWorkers({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (cancelled) return;
        const hit: Worker | undefined = res.data.find((w) => w.id === managerId);
        setManagerName(hit ? `${hit.fullName} · ${hit.employeeCode ?? hit.id.slice(0, 8)}` : null);
      } catch {
        if (!cancelled) setManagerName(null);
      }
    }
    void lookup();
    return () => {
      cancelled = true;
    };
  }, [project?.managerId]);

  // PRJ-SRS-002 — mở dialog confirm cho một action lifecycle.
  function openDialog(action: ProjectStatusAction) {
    if (!project) return;
    setConfirmAction(action);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionNotice(null);
  }

  // PRJ-SRS-002 — xác nhận chuyển trạng thái; thành công → cập nhật state
  // trực tiếp từ full profile của response (fallback re-fetch khi thiếu shape),
  // alreadyInState → notice info.
  async function handleStatusTransition(reason: string) {
    if (!project || !confirmAction) return;
    const action = confirmAction;
    setActionLoading(true);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionNotice(null);
    try {
      const updated = await changeProjectStatus(project.id, { action, reason: reason || null });
      setConfirmAction(null);
      setTimelineKey((k) => k + 1);
      if (updated.alreadyInState) {
        setActionNotice({ tone: 'info', text: 'Dự án đã ở trạng thái này — không thay đổi gì thêm.' });
      } else {
        // Cập nhật state trực tiếp từ full profile của transition response
        // (P8, đủ trường — badge/ngày đồng bộ, khỏi round-trip re-fetch).
        const profile = updated as unknown as Partial<ProjectProfile>;
        if (typeof profile.code === 'string' && typeof profile.name === 'string') {
          setProject({
            id: profile.id ?? project.id,
            code: profile.code ?? project.code,
            name: profile.name ?? project.name,
            status: profile.status ?? updated.status,
            managerId: profile.managerId ?? project.managerId,
            createdAt: profile.createdAt ?? project.createdAt,
            updatedAt: profile.updatedAt ?? updated.updatedAt ?? project.updatedAt,
          });
        } else {
          // Fallback: response thiếu shape profile → re-fetch summary.
          try {
            const fresh = await getProject(project.id);
            setProject(fresh);
          } catch {
            setProject({ ...project, status: updated.status, updatedAt: updated.updatedAt });
          }
        }
        setActionNotice({ tone: 'success', text: `${PROJECT_ACTION_LABEL[action]} dự án thành công.` });
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setDialogServerMessage('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (err.status === 403) setDialogServerMessage('Không có quyền chuyển trạng thái — cần ADMIN hoặc PROJECT_MANAGER (403).');
      else if (err.status === 404) setDialogServerMessage('Không tìm thấy dự án (404).');
      else if (err.status === 409 && err.code === 'INVALID_TRANSITION') {
        const allowed = (err.allowedTransitions ?? [])
          .map((a) => PROJECT_ACTION_LABEL[a as ProjectStatusAction] ?? a)
          .join(', ');
        setDialogServerMessage(
          allowed
            ? `Không thể chuyển trạng thái từ ${statusLabel(project.status)} với thao tác này — chỉ cho phép: ${allowed}.`
            : (err.message || 'Chuyển trạng thái không hợp lệ (409).'),
        );
      } else if (err.fieldErrors?.reason?.length) setDialogReasonError(err.fieldErrors.reason.join(' '));
      else if (err.fieldErrors?.action?.length) setDialogServerMessage(err.fieldErrors.action.join(' '));
      else setDialogServerMessage(err.message || 'Chuyển trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết dự án…</p></Card>;
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
          <Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    if (error.status === 404) {
      return (
        <Card>
          <Alert tone="error">Không tìm thấy dự án (404) — kiểm tra lại đường dẫn</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
        </div>
      </Card>
    );
  }
  if (!project) return <Card><p>Không có dữ liệu.</p></Card>;

  // PRJ-SRS-002 — actions theo transition map L1 của trạng thái hiện tại
  // (client-side để mở dialog đúng; server là authoritative).
  const allowedActions = allowedProjectActionsFor(project.status);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader
        title={project.name}
        subtitle={`${project.code} · ${statusLabel(project.status)}`}
        actions={
          canManage ? (
            <a className="bf-btn bf-btn-secondary" href={`/projects/${project.id}/edit`}>
              Sửa hồ sơ
            </a>
          ) : undefined
        }
      />

      <Card>
        <dl style={{ margin: 0, display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Mã dự án</dt>
            <dd style={{ margin: 0 }}>{project.code}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Tên dự án</dt>
            <dd style={{ margin: 0 }}>{project.name}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Địa chỉ</dt>
            <dd style={{ margin: 0 }}>—</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Múi giờ</dt>
            <dd style={{ margin: 0 }}>—</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Ngày kế hoạch</dt>
            <dd style={{ margin: 0 }}>—</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Quản lý dự án</dt>
            <dd style={{ margin: 0 }}>
              {project.managerId
                ? (managerName ?? `${project.managerId.slice(0, 8)}…`)
                : '— chưa chỉ định —'}
            </dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Trạng thái</dt>
            <dd style={{ margin: 0 }}>
              <StatusBadge status={project.status} />{' '}
              <span style={{ color: 'var(--bf-muted)', fontSize: '0.85rem' }}>{statusLabel(project.status)}</span>
            </dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Ngày tạo</dt>
            <dd style={{ margin: 0 }}>{new Date(project.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Cập nhật</dt>
            <dd style={{ margin: 0 }}>{new Date(project.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        <p style={{ color: 'var(--bf-muted)', fontSize: '0.85rem', margin: '0.75rem 0 0' }}>
          Địa chỉ, múi giờ và ngày kế hoạch hiển thị đầy đủ sau khi tạo/sửa (API đọc
          hiện trả summary shape — reads iam-owned). Vòng đời dự án — PRJ-SRS-002.
        </p>
        {project.status === 'CLOSED' ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Dự án Đóng không nhận Work Order mới (áp dụng từ JOB slices); lịch sử và dữ liệu
              đã phát sinh được giữ nguyên.
            </Alert>
          </div>
        ) : null}

        {canManage && allowedActions.length > 0 ? (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Chuyển trạng thái:</span>
            {allowedActions.map((action) => (
              <Button
                key={action}
                variant={action === 'PAUSE' || action === 'CLOSE' ? 'secondary' : 'primary'}
                onClick={() => openDialog(action)}
                disabled={actionLoading}
              >
                {PROJECT_ACTION_LABEL[action]}
              </Button>
            ))}
          </div>
        ) : null}

        {confirmAction && project ? (
          <div style={{ marginTop: '1rem' }}>
            <ProjectStatusDialog
              projectName={project.name}
              currentStatus={project.status}
              action={confirmAction}
              submitting={actionLoading}
              serverMessage={dialogServerMessage}
              serverFieldError={dialogReasonError}
              onConfirm={(reason) => void handleStatusTransition(reason)}
              onCancel={() => setConfirmAction(null)}
            />
          </div>
        ) : null}

        {actionNotice ? <div style={{ marginTop: '0.75rem' }}><Alert tone={actionNotice.tone}>{actionNotice.text}</Alert></div> : null}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {canManage ? (
            <a className="bf-btn bf-btn-secondary" href="/projects/new">
              Tạo dự án
            </a>
          ) : null}
          <a href="/projects" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
        </div>
      </Card>

      <Card>
        <ProjectMembers projectId={project.id} managerId={project.managerId} />
      </Card>

      <Card>
        <ProjectAreas projectId={project.id} />
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử trạng thái</span>
        </div>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Các lần đổi trạng thái dự án — kèm lý do và người thực hiện (10 bản ghi mới nhất).
        </p>
        <StatusTimeline key={timelineKey} id={project.id} entityType="PROJECT" />
      </Card>
    </div>
  );
}
