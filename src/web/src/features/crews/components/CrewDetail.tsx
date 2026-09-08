'use client';

import * as React from 'react';
import { getCrew, changeCrewLifecycleStatus, getCrewOpenWork, type Crew } from '@/lib/api/crews';
import type { ApiError } from '@/lib/api/crews';
import { checkCrewEligibility, type ApiError as EligibilityApiError, type CrewEligibilityResult } from '@/lib/api/eligibility';
import { EligibilityChecklist } from '@/features/eligibility';
import { listWorkers, type Worker } from '@/lib/api/workers';
import {
  ResourceStatusDialog,
  type ResourceAction,
  type OpenWorkCheck,
  RESOURCE_ACTION_LABEL,
} from '@/features/resources/components/ResourceStatusDialog';
import { StatusTimeline } from '@/features/resources/components/StatusTimeline';
import { CrewMembers } from './CrewMembers';
import { CrewEditDialog } from './CrewEditDialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';

function statusLabel(status: string): string {
  return status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động';
}

/**
 * ORG-SRS-006 (issue #29) — chi tiết đội thi công + lifecycle status qua
 * PATCH /crews/:id/status (ACTIVATE/SUSPEND/TERMINATE + reason).
 * Read + write mở cho ADMIN + PROJECT_MANAGER (SRS actor Điều phối viên).
 * Section 'Thành viên' là `CrewMembers` đầy đủ (ORG-SRS-007, issue #30):
 * danh sách MEMBER + LEAD, thêm/xóa mềm, lịch sử + point-in-time.
 */
export function CrewDetail({ id }: { id: string }) {
  const [crew, setCrew] = React.useState<Crew | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  // Thông báo lifecycle thành công hiển thị cả inline (giữ assert hiện có) lẫn
  // Ark Toast thoáng qua.
  React.useEffect(() => {
    if (actionSuccess) toast.success({ title: actionSuccess });
  }, [actionSuccess]);
  const [confirmAction, setConfirmAction] = React.useState<ResourceAction | null>(null);
  const [openCheck, setOpenCheck] = React.useState<OpenWorkCheck>({ state: 'loading' });
  const [dialogServerMessage, setDialogServerMessage] = React.useState<string | null>(null);
  const [dialogReasonError, setDialogReasonError] = React.useState<string | null>(null);
  const [timelineKey, setTimelineKey] = React.useState(0);
  const [leaderName, setLeaderName] = React.useState<string | null>(null);
  // ORG-SRS-008 (issue #31) — section 'Điều kiện nhận việc':
  // GET /api/v1/eligibility/crews/:id (auto-load, skeleton, error retry).
  const [eligResult, setEligResult] = React.useState<CrewEligibilityResult | null>(null);
  const [eligLoading, setEligLoading] = React.useState(true);
  const [eligError, setEligError] = React.useState<EligibilityApiError | null>(null);
  // CRUD popup: nút 'Sửa hồ sơ' mở CrewEditDialog (không điều hướng /edit);
  // route /edit giữ hoạt động độc lập cho E2E drivers goto trực tiếp.
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCrew(id);
      setCrew(c);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void load(); }, [load]);

  const loadEligibility = React.useCallback(async () => {
    setEligLoading(true);
    setEligError(null);
    try {
      const r = await checkCrewEligibility(id);
      setEligResult(r);
    } catch (e) {
      setEligError(e as EligibilityApiError);
    } finally {
      setEligLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void loadEligibility(); }, [loadEligibility]);

  // Tra tên trưởng nhóm từ worker ACTIVE (fallback hiển thị rút gọn id).
  React.useEffect(() => {
    const leaderId = crew?.leaderUserId ?? null;
    if (!leaderId) {
      setLeaderName(null);
      return;
    }
    let cancelled = false;
    async function lookup() {
      try {
        const res = await listWorkers({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (cancelled) return;
        const hit: Worker | undefined = res.data.find((w) => w.id === leaderId);
        setLeaderName(hit ? `${hit.fullName} · ${hit.employeeCode ?? hit.id.slice(0, 8)}` : null);
      } catch {
        if (!cancelled) setLeaderName(null);
      }
    }
    void lookup();
    return () => {
      cancelled = true;
    };
  }, [crew?.leaderUserId]);

  function handleRetry() {
    void load();
  }

  async function runOpenCheck(crewId: string) {
    setOpenCheck({ state: 'loading' });
    try {
      const res = await getCrewOpenWork(crewId);
      setOpenCheck({ state: 'done', openAssignments: res.openAssignments });
    } catch {
      setOpenCheck({ state: 'failed' });
    }
  }

  function openDialog(action: ResourceAction) {
    if (!crew) return;
    setConfirmAction(action);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionError(null);
    setActionSuccess(null);
    setOpenCheck(action === 'ACTIVATE' ? { state: 'done', openAssignments: 0 } : { state: 'loading' });
    if (action !== 'ACTIVATE') void runOpenCheck(crew.id);
  }

  async function handleStatusTransition(reason: string) {
    if (!crew || !confirmAction) return;
    const action = confirmAction;
    setActionLoading(true);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await changeCrewLifecycleStatus(crew.id, { action, reason: reason || null });
      setCrew({ ...crew, status: updated.status, eligible: updated.eligible });
      setConfirmAction(null);
      setTimelineKey((k) => k + 1);
      if (updated.alreadyInState) {
        setActionSuccess(
          action === 'ACTIVATE'
            ? 'Đội đã ở trạng thái hoạt động — không thay đổi gì thêm.'
            : 'Đội đã ở trạng thái ngừng hoạt động — không thay đổi gì thêm.',
        );
      } else if (action === 'ACTIVATE') {
        setActionSuccess('Đã kích hoạt lại đội — có thể nhận phân công mới.');
      } else if (updated.warning && updated.warning.openAssignments > 0) {
        setActionSuccess(
          `${RESOURCE_ACTION_LABEL[action]} thành công. Đội đang có ${updated.warning.openAssignments} công việc/lịch mở của đội — lịch sử vẫn được giữ nguyên, công việc mở không bị xóa.`,
        );
      } else {
        setActionSuccess(
          `${RESOURCE_ACTION_LABEL[action]} thành công — đội sẽ bị chặn phân công mới, lịch sử công việc đã hoàn tất vẫn giữ.`,
        );
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setDialogServerMessage('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (err.status === 403) setDialogServerMessage('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER.');
      else if (err.fieldErrors?.reason?.length) setDialogReasonError(err.fieldErrors.reason.join(' '));
      else setDialogServerMessage(err.message || 'Chuyển trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  // ORG-SRS-007 (issue #30, fix E2E run 1) — chỉ unmount khi chưa có dữ liệu lần đầu.
  // Reload sau onChanged (thêm/xóa thành viên) mà early-return ở đây sẽ unmount
  // <CrewMembers>, xóa sạch success/warning notices vừa set. Khi đã có crew thì
  // giữ nguyên cây con + hiện ghi chú tải lại inline.
  if (loading && crew === null) return <Card><p aria-busy="true">Đang tải chi tiết đội thi công…</p></Card>;
  if (error && crew === null) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy đội thi công (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
  }
  if (!crew) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = crew.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-profile-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{crew.name}</h1>
              <span className="bf-chip">{crew.code}</span>
              <span className={`bf-badge bf-badge-${isActive ? 'ok' : 'busy'}`}>{statusLabel(crew.status)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa hồ sơ
            </Button>
            {isActive ? (
              <>
                <Button variant="secondary" onClick={() => openDialog('SUSPEND')} disabled={actionLoading}>
                  Tạm ngừng
                </Button>
                <Button variant="secondary" onClick={() => openDialog('TERMINATE')} disabled={actionLoading}>
                  Chấm dứt
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => openDialog('ACTIVATE')} disabled={actionLoading}>
                Kích hoạt lại
              </Button>
            )}
            <a href="/crews" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
          </div>
        </div>
        {loading ? (
          <p aria-busy="true" style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
            Đang tải lại chi tiết đội thi công…
          </p>
        ) : null}
        {error ? (
          <div style={{ marginBottom: '0.75rem' }}>
            <Alert tone="error">
              Tải lại thất bại{error.message ? `: ${error.message}` : ''} — đang hiện dữ liệu trước đó.
            </Alert>
          </div>
        ) : null}
        <dl className="bf-def-grid">
          <div>
            <dt>Mô tả</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{crew.description ?? '—'}</dd>
          </div>
          <div>
            <dt>Trưởng nhóm</dt>
            <dd>
              {crew.leaderUserId ? (
                <a href={`/workers/${crew.leaderUserId}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                  {leaderName ?? `${crew.leaderUserId.slice(0, 8)}…`}
                </a>
              ) : (
                '— chưa chỉ định —'
              )}
            </dd>
          </div>
          <div>
            <dt>Nhà thầu</dt>
            <dd>{crew.contractorId ? `${crew.contractorId.slice(0, 8)}…` : '—'}</dd>
          </div>
          <div>
            <dt>Điều kiện phân công</dt>
            <dd style={{ color: crew.eligible ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {crew.eligible ? 'Đủ điều kiện — cho phép phân công' : 'Không đủ điều kiện — chặn phân công mới, lịch sử vẫn giữ'}
            </dd>
          </div>
          <div>
            <dt>Tạo bởi</dt>
            <dd>{crew.createdBy.slice(0, 8)}… · {new Date(crew.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd>{new Date(crew.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {!crew.eligible ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Đội đang ngừng hoạt động nên không nhận phân công mới. Các công việc đã hoàn tất
              giữ nguyên liên kết với đội.
            </Alert>
          </div>
        ) : null}

        {confirmAction && crew ? (
          <div style={{ marginTop: '1rem' }}>
            <ResourceStatusDialog
              resourceName={crew.name}
              currentStatus={crew.status}
              action={confirmAction}
              entityType="CREW"
              openCheck={openCheck}
              submitting={actionLoading}
              serverMessage={dialogServerMessage}
              serverFieldError={dialogReasonError}
              onConfirm={(reason) => void handleStatusTransition(reason)}
              onCancel={() => setConfirmAction(null)}
              onRetryCheck={() => void runOpenCheck(crew.id)}
            />
          </div>
        ) : null}

        {actionError ? <div style={{ marginTop: '0.75rem' }}><Alert tone="error">{actionError}</Alert></div> : null}
        {actionSuccess ? <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div> : null}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Điều kiện nhận việc</span>
        </div>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Kết quả kiểm tra từng điều kiện trước khi giao việc cho đội — bấm kiểm tra lại để làm mới.
        </p>
        <EligibilityChecklist
          result={eligResult}
          loading={eligLoading}
          error={eligError}
          onRefresh={() => void loadEligibility()}
          compact
        />
      </Card>

      <CrewMembers
        crewId={crew.id}
        crewStatus={crew.status}
        onChanged={() => {
          void load();
          setTimelineKey((k) => k + 1);
        }}
      />

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử trạng thái</span>
        </div>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Các lần tạo, đổi trưởng nhóm, kích hoạt, tạm ngừng, chấm dứt — kèm lý do và người thực hiện
          (10 bản ghi mới nhất).
        </p>
        <StatusTimeline key={timelineKey} id={crew.id} entityType="CREW" />
      </Card>

      <CrewEditDialog
        id={crew.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={() => void load()}
      />
    </div>
  );
}
