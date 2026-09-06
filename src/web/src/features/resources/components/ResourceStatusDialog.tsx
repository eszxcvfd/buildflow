'use client';

import * as React from 'react';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';

/**
 * ORG-SRS-004 (issue #27) — confirm dialog lifecycle dùng chung cho worker và
 * contractor (state policy API layer: ACTIVATE→ACTIVE, SUSPEND/TERMINATE→INACTIVE).
 * ORG-SRS-006 (issue #29) — mở rộng cho đội thi công (`entityType: 'CREW'`):
 * cùng policy, open-work đếm trực tiếp assignments của đội.
 *
 * Flow chuẩn (SRS): chọn action → pre-check open work (GET .../open-work của
 * caller) hiển thị cảnh báo ảnh hưởng → nhập lý do (bắt buộc khi
 * SUSPEND/TERMINATE, validate theo field) → xác nhận gọi lifecycle API.
 * Reason > 500 ký tự bị chặn ngay ở input (maxLength) — cùng luật API
 * (REASON_MAX_LENGTH = 500); thiếu lý do bị chặn trước khi submit.
 */

export type ResourceAction = 'ACTIVATE' | 'SUSPEND' | 'TERMINATE';

export const RESOURCE_ACTIONS: readonly ResourceAction[] = ['ACTIVATE', 'SUSPEND', 'TERMINATE'];

export const RESOURCE_ACTION_LABEL: Record<ResourceAction, string> = {
  ACTIVATE: 'Kích hoạt lại',
  SUSPEND: 'Tạm ngừng',
  TERMINATE: 'Chấm dứt',
};

export const RESOURCE_REASON_MAX_LENGTH = 500;
export const RESOURCE_REASON_REQUIRED_MESSAGE = 'Lý do là bắt buộc khi tạm ngừng/chấm dứt';

export function isResourceDeactivatingAction(action: ResourceAction): boolean {
  return action === 'SUSPEND' || action === 'TERMINATE';
}

/** Trạng thái pre-check open work do caller tải (GET .../open-work). */
export type OpenWorkCheck =
  | { state: 'loading' }
  | { state: 'done'; openAssignments: number }
  | { state: 'failed' };

export interface ResourceStatusDialogProps {
  /** Tên hiển thị của nguồn lực (worker.fullName / contractor.name / crew.name). */
  resourceName: string;
  currentStatus: string;
  action: ResourceAction;
  /**
   * ORG-SRS-006 (issue #29) — loại thực thể; 'CREW' đổi text cảnh báo sang
   * 'công việc/lịch mở của đội'. Mặc định giữ nguyên text worker/contractor
   * để caller cũ không đổi behavior.
   */
  entityType?: 'WORKER' | 'CONTRACTOR' | 'CREW';
  /** Kết quả pre-check open work; caller giữ state để không fetch lại khi bấm. */
  openCheck: OpenWorkCheck;
  submitting?: boolean;
  /** Lỗi server ngoài field reason (vd 401/403/message) — hiển thị banner. */
  serverMessage?: string | null;
  /** Lỗi server gắn field reason (vd 400 'Lý do là bắt buộc…') — hiển thị dưới textarea. */
  serverFieldError?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  /** Tải lại pre-check open work sau khi state 'failed'. */
  onRetryCheck?: () => void;
}

export function ResourceStatusDialog({
  resourceName,
  currentStatus,
  action,
  entityType = 'WORKER',
  openCheck,
  submitting,
  serverMessage,
  serverFieldError,
  onConfirm,
  onCancel,
  onRetryCheck,
}: ResourceStatusDialogProps) {
  const deactivating = isResourceDeactivatingAction(action);
  const [reason, setReason] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  // Reset trạng thái form khi dialog mở lại cho action/nguồn lực khác.
  React.useEffect(() => {
    setReason('');
    setFieldError(null);
  }, [resourceName, action]);

  function handleConfirm() {
    const trimmed = reason.trim();
    if (deactivating && trimmed.length === 0) {
      setFieldError(RESOURCE_REASON_REQUIRED_MESSAGE);
      return;
    }
    setFieldError(null);
    onConfirm(trimmed);
  }

  const confirmLabel = RESOURCE_ACTION_LABEL[action];
  // ORG-SRS-006 — text open-work theo loại thực thể. Nhánh mặc định giữ
  // nguyên từng chữ cũ (WorkerList test khớp regex 'công việc/lịch đang mở').
  const crewTexts = entityType === 'CREW';
  const checkingNoun = crewTexts ? 'công việc/lịch đang mở của đội' : 'công việc/lịch đang mở';
  const failedNoun = crewTexts ? 'công việc/lịch mở của đội' : 'công việc/lịch đang mở';
  const failedSubject = crewTexts ? 'đội đang có việc mở' : 'nguồn lực đang có việc mở';
  const warnSubject = crewTexts ? 'Đội đang có' : 'Nguồn lực đang có';
  const warnNoun = crewTexts ? 'công việc/lịch mở của đội' : 'công việc/lịch mở';
  const title =
    action === 'ACTIVATE'
      ? `Xác nhận kích hoạt lại ${entityType === 'CREW' ? 'đội thi công' : 'nguồn lực'}`
      : action === 'SUSPEND'
        ? `Xác nhận tạm ngừng ${entityType === 'CREW' ? 'đội thi công' : 'nguồn lực'}`
        : `Xác nhận chấm dứt ${entityType === 'CREW' ? 'đội thi công' : 'nguồn lực'}`;

  const showFieldError = fieldError ?? serverFieldError ?? null;
  const openDone = openCheck.state === 'done' ? openCheck.openAssignments : null;

  return (
    <div style={{ border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
      <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
        {title} — {resourceName}?
      </p>
      <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
        Trạng thái hiện tại: <strong>{currentStatus}</strong>.{' '}
        {deactivating
          ? 'Nguồn lực sẽ không nhận phân công mới; lịch sử và dữ liệu đã phát sinh được giữ nguyên. Thao tác được ghi nhật ký hệ thống kèm lý do.'
          : 'Kích hoạt lại sẽ cho phép nguồn lực nhận phân công mới (xóa khóa tạm thời nếu có).'}
      </p>

      {openCheck.state === 'loading' ? (
        <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.85rem' }} aria-busy="true">
          Đang kiểm tra {checkingNoun}…
        </p>
      ) : null}
      {openCheck.state === 'failed' ? (
        <div style={{ marginTop: '0.5rem' }}>
          <Alert tone="info">
            Chưa kiểm tra được {failedNoun}. Khi thực hiện, hệ thống vẫn cảnh báo trong
            kết quả nếu {failedSubject}.
          </Alert>
          {onRetryCheck ? (
            <div style={{ marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={onRetryCheck} disabled={submitting}>
                Kiểm tra lại
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {openCheck.state === 'done' && openDone !== null && openDone > 0 ? (
        <div style={{ marginTop: '0.5rem' }}>
          <Alert tone="info">
            {warnSubject}{' '}
            <strong>{openDone} {warnNoun}</strong>. Cảnh báo ảnh hưởng
            trước khi ngừng hoạt động: lịch sử đã phát sinh vẫn được giữ nguyên; công việc mở không
            bị xóa bởi thao tác này.
          </Alert>
        </div>
      ) : null}

      <div style={{ marginTop: '0.75rem' }}>
        <label
          htmlFor="lifecycle-reason"
          style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}
        >
          Lý do{deactivating ? ' *' : ''} {deactivating ? '(bắt buộc)' : '(không bắt buộc)'}
        </label>
        <textarea
          id="lifecycle-reason"
          className="bf-input"
          rows={3}
          maxLength={RESOURCE_REASON_MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={showFieldError ? true : undefined}
          aria-describedby={showFieldError ? 'lifecycle-reason-error' : undefined}
          placeholder={
            deactivating
              ? 'Nhập lý do tạm ngừng/chấm dứt (bắt buộc)…'
              : 'Nhập lý do kích hoạt lại nếu cần…'
          }
          style={showFieldError ? { borderColor: 'var(--bf-risk)' } : undefined}
        />
        {showFieldError ? (
          <p id="lifecycle-reason-error" className="bf-field-error" role="alert">
            {showFieldError}
          </p>
        ) : null}
        <p style={{ margin: '0.25rem 0 0', color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
          {reason.length}/{RESOURCE_REASON_MAX_LENGTH} ký tự · lý do được lưu cùng nhật ký thao tác
          (audit), không hiển thị dữ liệu nhạy cảm.
        </p>
      </div>

      {serverMessage ? (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert tone="error">{serverMessage}</Alert>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Hủy
        </Button>
        <Button loading={submitting} aria-busy={submitting} onClick={() => handleConfirm()}>
          Xác nhận {confirmLabel.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}
