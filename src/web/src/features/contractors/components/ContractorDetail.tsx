'use client';

import * as React from 'react';
import { getContractor, changeContractorLifecycleStatus, getContractorOpenWork, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import {
  ResourceStatusDialog,
  type ResourceAction,
  type OpenWorkCheck,
  RESOURCE_ACTION_LABEL,
} from '@/features/resources/components/ResourceStatusDialog';
import { StatusTimeline } from '@/features/resources/components/StatusTimeline';
import { useIsAdmin } from '@/lib/auth/roles';
import { ContractorEditDialog } from './ContractorEditDialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';

function statusLabel(status: string): string {
  return status === 'ACTIVE' ? 'Đang hoạt động' : 'Ngừng hoạt động';
}

/**
 * ORG-SRS-004 (issue #27) — chi tiết nhà thầu + lifecycle status qua
 * PATCH /contractors/:id/status (ACTIVATE/SUSPEND/TERMINATE + reason).
 * Form sửa hồ sơ (ContractorForm) KHÔNG còn đổi status inline (bỏ đường xung đột):
 * mọi thay đổi trạng thái đi qua dialog ở đây — open-work pre-check, lý do bắt buộc
 * theo field, `alreadyInState` → thông tin không lỗi. Kèm section 'Lịch sử trạng thái'.
 */
export function ContractorDetail({ id }: { id: string }) {
  // ORG-SRS-005 (issue #28) — PM đọc được chi tiết nhưng lifecycle/edit/timeline
  // là admin-only (PATCH status/open-work/audit-logs giữ assertAdmin ở API).
  const isAdmin = useIsAdmin();
  const [contractor, setContractor] = React.useState<Contractor | null>(null);
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
  // CRUD popup: nút 'Sửa hồ sơ' mở ContractorEditDialog (không điều hướng /edit);
  // route /edit giữ hoạt động độc lập cho E2E drivers goto trực tiếp.
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getContractor(id);
      setContractor(c);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void load(); }, [load]);

  function handleRetry() {
    void load();
  }
  async function runOpenCheck(contractorId: string) {
    setOpenCheck({ state: 'loading' });
    try {
      const res = await getContractorOpenWork(contractorId);
      setOpenCheck({ state: 'done', openAssignments: res.openAssignments });
    } catch {
      setOpenCheck({ state: 'failed' });
    }
  }

  function openDialog(action: ResourceAction) {
    if (!contractor) return;
    setConfirmAction(action);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionError(null);
    setActionSuccess(null);
    setOpenCheck(action === 'ACTIVATE' ? { state: 'done', openAssignments: 0 } : { state: 'loading' });
    if (action !== 'ACTIVATE') void runOpenCheck(contractor.id);
  }

  async function handleStatusTransition(reason: string) {
    if (!contractor || !confirmAction) return;
    const action = confirmAction;
    setActionLoading(true);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await changeContractorLifecycleStatus(contractor.id, { action, reason: reason || null });
      setContractor({ ...contractor, status: updated.status, eligible: updated.eligible });
      setConfirmAction(null);
      setTimelineKey((k) => k + 1);
      if (updated.alreadyInState) {
        setActionSuccess(
          action === 'ACTIVATE'
            ? 'Nhà thầu đã ở trạng thái hoạt động — không thay đổi gì thêm.'
            : 'Nhà thầu đã ở trạng thái ngừng hoạt động — không thay đổi gì thêm.',
        );
      } else if (action === 'ACTIVATE') {
        setActionSuccess('Đã kích hoạt lại nhà thầu — có thể nhận phân công mới.');
      } else if (updated.warning && updated.warning.openAssignments > 0) {
        setActionSuccess(
          `${RESOURCE_ACTION_LABEL[action]} thành công. Nhà thầu đang có ${updated.warning.openAssignments} công việc/lịch mở — lịch sử vẫn được giữ nguyên, công việc mở không bị xóa.`,
        );
      } else {
        setActionSuccess(
          `${RESOURCE_ACTION_LABEL[action]} thành công — nhà thầu sẽ bị chặn phân công mới, lịch sử vẫn giữ.`,
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

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết nhà thầu…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy nhà thầu (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
  }
  if (!contractor) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = contractor.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-profile-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{contractor.name}</h1>
              <span className="bf-chip">{contractor.code}</span>
              <span className={`bf-badge bf-badge-${isActive ? 'ok' : 'busy'}`}>{statusLabel(contractor.status)}</span>
            </div>
            <p style={{ margin: '0.3rem 0 0', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
              {contractor.email ?? contractor.phone ?? '—'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdmin ? (
              <>
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
              </>
            ) : (
              <span style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>
                Thay đổi trạng thái cần quyền ADMIN — tài khoản hiện tại chỉ xem.
              </span>
            )}
            <a href="/contractors" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
          </div>
        </div>

        <dl className="bf-def-grid">
          <div>
            <dt>Mã</dt>
            <dd>{contractor.code}</dd>
          </div>
          <div>
            <dt>Liên hệ</dt>
            <dd>{contractor.contactName ?? '—'}</dd>
          </div>
          <div>
            <dt>SĐT</dt>
            <dd>{contractor.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{contractor.email ?? '—'}</dd>
          </div>
          <div>
            <dt>Phạm vi</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{contractor.scope ?? '—'}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd style={{ fontWeight: 600, color: isActive ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {statusLabel(contractor.status)}
            </dd>
          </div>
          <div>
            <dt>Điều kiện phân công</dt>
            <dd style={{ color: contractor.eligible ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {contractor.eligible ? 'Đủ điều kiện — cho phép phân công' : 'Không đủ điều kiện — chặn phân công mới, lịch sử vẫn giữ'}
            </dd>
          </div>
          <div>
            <dt>Tạo bởi</dt>
            <dd>{contractor.createdBy.slice(0, 8)}… · {new Date(contractor.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd>{new Date(contractor.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {!contractor.eligible ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Nhà thầu đang ngừng hoạt động nên không chọn được cho phân công mới. Các phân công cũ
              vẫn truy được bình thường.
            </Alert>
          </div>
        ) : null}

        {confirmAction && contractor ? (
          <div style={{ marginTop: '1rem' }}>
            <ResourceStatusDialog
              resourceName={contractor.name}
              currentStatus={contractor.status}
              action={confirmAction}
              openCheck={openCheck}
              submitting={actionLoading}
              serverMessage={dialogServerMessage}
              serverFieldError={dialogReasonError}
              onConfirm={(reason) => void handleStatusTransition(reason)}
              onCancel={() => setConfirmAction(null)}
              onRetryCheck={() => void runOpenCheck(contractor.id)}
            />
          </div>
        ) : null}

        {actionError ? <div style={{ marginTop: '0.75rem' }}><Alert tone="error">{actionError}</Alert></div> : null}
        {actionSuccess ? <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div> : null}
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
            <StatusTimeline key={timelineKey} id={contractor.id} entityType="CONTRACTOR" />
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
            Lịch sử trạng thái chỉ dành cho ADMIN (nhật ký thao tác).
          </p>
        )}
      </Card>

      <ContractorEditDialog
        id={contractor.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={() => void load()}
      />
    </div>
  );
}
