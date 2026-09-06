'use client';

import * as React from 'react';
import { getWorker, updateWorker, changeWorkerLifecycleStatus, getWorkerOpenWork, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { checkWorkerEligibility, type ApiError as EligibilityApiError, type WorkerEligibilityResult } from '@/lib/api/eligibility';
import { EligibilityChecklist } from '@/features/eligibility';
import { useTradeNames } from '@/features/workers/hooks/useTradeNames';
import { useIsAdmin } from '@/lib/auth/roles';
import {
  ResourceStatusDialog,
  type ResourceAction,
  type OpenWorkCheck,
  RESOURCE_ACTION_LABEL,
} from '@/features/resources/components/ResourceStatusDialog';
import { StatusTimeline } from '@/features/resources/components/StatusTimeline';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

function statusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Hoạt động';
    case 'INACTIVE': return 'Ngừng hoạt động';
    case 'LOCKED': return 'Bị khóa';
    default: return status;
  }
}

/**
 * ORG-SRS-004 (issue #27) — chi tiết worker + lifecycle status:
 * ACTIVE → nút 'Tạm ngừng' (SUSPEND)/'Chấm dứt' (TERMINATE); INACTIVE → 'Kích hoạt lại'
 * (ACTIVATE). Mỗi action mở dialog: pre-check open work (GET .../open-work) hiển thị
 * cảnh báo ảnh hưởng, lý do bắt buộc theo field; `alreadyInState` từ API → thông tin
 * không lỗi; LOCKED không có action ở đây (bảo mật — quản trị tài khoản). Chi tiết có
 * section 'Lịch sử trạng thái' (timeline audit).
 */
export function WorkerDetail({ id }: { id: string }) {
  const tradeNames = useTradeNames();
  // ORG-SRS-005 (issue #28) — PM đọc được chi tiết nhưng lifecycle/edit/timeline
  // là admin-only (PATCH status/open-work/audit-logs giữ assertAdmin ở API).
  const isAdmin = useIsAdmin();
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<ResourceAction | null>(null);
  const [openCheck, setOpenCheck] = React.useState<OpenWorkCheck>({ state: 'loading' });
  const [dialogServerMessage, setDialogServerMessage] = React.useState<string | null>(null);
  const [dialogReasonError, setDialogReasonError] = React.useState<string | null>(null);
  const [timelineKey, setTimelineKey] = React.useState(0);
  // ORG-SRS-008 (issue #31) — nguồn duy nhất cho 'Điều kiện phân công':
  // GET /api/v1/eligibility/workers/:id (auto-load, skeleton, error retry).
  const [eligResult, setEligResult] = React.useState<WorkerEligibilityResult | null>(null);
  const [eligLoading, setEligLoading] = React.useState(true);
  const [eligError, setEligError] = React.useState<EligibilityApiError | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const w = await getWorker(id);
      setWorker(w);
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
      const r = await checkWorkerEligibility(id);
      setEligResult(r);
    } catch (e) {
      setEligError(e as EligibilityApiError);
    } finally {
      setEligLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void loadEligibility(); }, [loadEligibility]);

  function handleRetry() {
    void load();
  }

  async function runOpenCheck(workerId: string) {
    setOpenCheck({ state: 'loading' });
    try {
      const res = await getWorkerOpenWork(workerId);
      setOpenCheck({ state: 'done', openAssignments: res.openAssignments });
    } catch {
      setOpenCheck({ state: 'failed' });
    }
  }

  function openDialog(action: ResourceAction) {
    if (!worker) return;
    setConfirmAction(action);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionError(null);
    setActionSuccess(null);
    setOpenCheck(action === 'ACTIVATE' ? { state: 'done', openAssignments: 0 } : { state: 'loading' });
    if (action !== 'ACTIVATE') void runOpenCheck(worker.id);
  }

  async function handleStatusTransition(reason: string) {
    if (!worker || !confirmAction) return;
    const action = confirmAction;
    setActionLoading(true);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await changeWorkerLifecycleStatus(worker.id, { action, reason: reason || null });
      setWorker({ ...worker, status: updated.status, eligible: updated.eligible });
      setConfirmAction(null);
      setTimelineKey((k) => k + 1);
      if (updated.alreadyInState) {
        setActionSuccess(
          action === 'ACTIVATE'
            ? 'Worker đã ở trạng thái hoạt động — không thay đổi gì thêm.'
            : 'Worker đã ở trạng thái ngừng hoạt động — không thay đổi gì thêm.',
        );
      } else if (action === 'ACTIVATE') {
        setActionSuccess('Đã kích hoạt lại worker — có thể nhận phân công mới.');
      } else if (updated.warning && updated.warning.openAssignments > 0) {
        setActionSuccess(
          `${RESOURCE_ACTION_LABEL[action]} thành công. Worker đang có ${updated.warning.openAssignments} công việc/lịch mở — lịch sử vẫn được giữ nguyên, công việc mở không bị xóa.`,
        );
      } else {
        setActionSuccess(
          `${RESOURCE_ACTION_LABEL[action]} thành công — worker sẽ bị chặn phân công mới, lịch sử vẫn giữ.`,
        );
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setDialogServerMessage('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (err.status === 403) setDialogServerMessage('Không có quyền — cần ADMIN.');
      else if (err.fieldErrors?.reason?.length) setDialogReasonError(err.fieldErrors.reason.join(' '));
      else setDialogServerMessage(err.message || 'Chuyển trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveTrades() {
    if (!worker) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await updateWorker(worker.id, {
        trades: worker.trades.map((t) => ({ tradeId: t.tradeId, skillLevel: t.skillLevel })),
      });
      setWorker(updated);
      setActionSuccess('Đã lưu thay đổi');
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setActionError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (err.status === 403) setActionError('Không có quyền — cần ADMIN.');
      else setActionError(err.message || 'Cập nhật thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết công nhân…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy công nhân (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
  }
  if (!worker) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = worker.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader
        title={worker.fullName}
        subtitle={`${worker.email} · ${statusLabel(worker.status)}`}
        actions={
          isAdmin ? (
            <a className="bf-btn bf-btn-secondary" href={`/workers/${worker.id}/edit`}>
              Sửa hồ sơ
            </a>
          ) : undefined
        }
      />

      <Card>
        <dl style={{ margin: 0, display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Mã nhân viên</dt>
            <dd style={{ margin: 0 }}>{worker.employeeCode ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>SĐT</dt>
            <dd style={{ margin: 0 }}>{worker.phone ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Trạng thái</dt>
            <dd style={{ margin: 0 }}>{statusLabel(worker.status)}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Ngành nghề / kỹ năng</dt>
            <dd style={{ margin: 0 }}>
              {worker.trades.length
                ? worker.trades
                    .map((t) => {
                      const label = tradeNames.names.get(t.tradeId);
                      return label ? `${label} · Lv${t.skillLevel}` : `${t.tradeId} · Lv${t.skillLevel}`;
                    })
                    .join('; ')
                : '—'}
            </dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Tạo</dt>
            <dd style={{ margin: 0 }}>{new Date(worker.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Cập nhật</dt>
            <dd style={{ margin: 0 }}>{new Date(worker.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isAdmin ? (
            isActive ? (
              <>
                <Button variant="secondary" onClick={() => openDialog('SUSPEND')} disabled={actionLoading}>
                  Tạm ngừng
                </Button>
                <Button variant="secondary" onClick={() => openDialog('TERMINATE')} disabled={actionLoading}>
                  Chấm dứt
                </Button>
              </>
            ) : worker.status === 'INACTIVE' ? (
              <Button variant="primary" onClick={() => openDialog('ACTIVATE')} disabled={actionLoading}>
                Kích hoạt lại
              </Button>
            ) : null
          ) : (
            <span style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>
              Thay đổi trạng thái cần quyền ADMIN — tài khoản hiện tại chỉ xem.
            </span>
          )}
          <a href="/workers" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
        </div>

        {confirmAction && worker ? (
          <div style={{ marginTop: '1rem' }}>
            <ResourceStatusDialog
              resourceName={worker.fullName}
              currentStatus={worker.status}
              action={confirmAction}
              openCheck={openCheck}
              submitting={actionLoading}
              serverMessage={dialogServerMessage}
              serverFieldError={dialogReasonError}
              onConfirm={(reason) => void handleStatusTransition(reason)}
              onCancel={() => setConfirmAction(null)}
              onRetryCheck={() => void runOpenCheck(worker.id)}
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
          Kết quả kiểm tra từng điều kiện trước khi phân công — dữ liệu có thể cũ, bấm kiểm tra lại để làm mới.
        </p>
        <EligibilityChecklist
          result={eligResult}
          loading={eligLoading}
          error={eligError}
          onRefresh={() => void loadEligibility()}
        />
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử trạng thái</span>
        </div>
        {isAdmin ? (
          <>
            <p style={{ margin: '0 0 0.75rem', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
              Các lần kích hoạt, tạm ngừng, chấm dứt — kèm lý do và người thực hiện (10 bản ghi mới nhất).
            </p>
            <StatusTimeline key={timelineKey} id={worker.id} entityType="WORKER" />
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
            Lịch sử trạng thái chỉ dành cho ADMIN (nhật ký thao tác).
          </p>
        )}
      </Card>
    </div>
  );
}
