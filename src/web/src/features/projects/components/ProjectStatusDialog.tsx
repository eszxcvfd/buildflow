'use client';

import * as React from 'react';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import type { ProjectStatusAction } from '@/lib/api/projects';

/**
 * PRJ-SRS-002 (issue #33) — confirm dialog lifecycle dự án, mirror
 * `features/resources/ResourceStatusDialog` (ORG-SRS-004).
 *
 * Transition map L1 chỉ dùng để mở action phù hợp từ trạng thái hiện tại;
 * server là authoritative (action lạ → 400, sai trạng thái → 409
 * INVALID_TRANSITION + allowedTransitions).
 * Reason bắt buộc (1–500) cho PAUSE/CLOSE/REOPEN, optional cho
 * ACTIVATE/RESUME/COMPLETE — cùng luật API (PROJECT_REASON_MAX_LENGTH = 500);
 * thiếu lý do bị chặn trước khi submit.
 */

export type { ProjectStatusAction };

export const PROJECT_STATUS_ACTIONS: readonly ProjectStatusAction[] = [
  'ACTIVATE',
  'PAUSE',
  'RESUME',
  'COMPLETE',
  'CLOSE',
  'REOPEN',
];

export const PROJECT_ACTION_LABEL: Record<ProjectStatusAction, string> = {
  ACTIVATE: 'Kích hoạt',
  PAUSE: 'Tạm dừng',
  RESUME: 'Tiếp tục hoạt động',
  COMPLETE: 'Hoàn thành',
  CLOSE: 'Đóng',
  REOPEN: 'Mở lại',
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hoạt động',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CLOSED: 'Đóng',
};

/** Transition map L1 client-side (mirror API `project.policy.ts`). */
export const PROJECT_ALLOWED_ACTIONS: Record<string, readonly ProjectStatusAction[]> = {
  DRAFT: ['ACTIVATE', 'CLOSE'],
  ACTIVE: ['PAUSE', 'COMPLETE'],
  PAUSED: ['RESUME'],
  COMPLETED: ['CLOSE'],
  CLOSED: ['REOPEN'],
};

/** Các action hợp lệ từ trạng thái hiện tại (trạng thái lạ → rỗng). */
export function allowedProjectActionsFor(status: string): ProjectStatusAction[] {
  return [...(PROJECT_ALLOWED_ACTIONS[status] ?? [])];
}

export const PROJECT_REASON_MAX_LENGTH = 500;
export const PROJECT_REASON_REQUIRED_MESSAGE = 'Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án';

export function isProjectReasonRequired(action: ProjectStatusAction): boolean {
  return action === 'PAUSE' || action === 'CLOSE' || action === 'REOPEN';
}

export interface ProjectStatusDialogProps {
  /** Tên hiển thị của dự án. */
  projectName: string;
  currentStatus: string;
  action: ProjectStatusAction;
  submitting?: boolean;
  /** Lỗi server ngoài field reason (vd 401/403/409/message) — hiển thị banner. */
  serverMessage?: string | null;
  /** Lỗi server gắn field reason (vd 400 'Lý do là bắt buộc…') — hiển thị dưới textarea. */
  serverFieldError?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ProjectStatusDialog({
  projectName,
  currentStatus,
  action,
  submitting,
  serverMessage,
  serverFieldError,
  onConfirm,
  onCancel,
}: ProjectStatusDialogProps) {
  const reasonRequired = isProjectReasonRequired(action);
  const [reason, setReason] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  // Reset trạng thái form khi dialog mở lại cho action/dự án khác.
  React.useEffect(() => {
    setReason('');
    setFieldError(null);
  }, [projectName, action]);

  function handleConfirm() {
    const trimmed = reason.trim();
    if (reasonRequired && trimmed.length === 0) {
      setFieldError(PROJECT_REASON_REQUIRED_MESSAGE);
      return;
    }
    setFieldError(null);
    onConfirm(trimmed);
  }

  const confirmLabel = PROJECT_ACTION_LABEL[action];
  const statusLabel = PROJECT_STATUS_LABEL[currentStatus] ?? currentStatus;
  const showFieldError = fieldError ?? serverFieldError ?? null;

  return (
    <div style={{ border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
      <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
        Xác nhận {confirmLabel.toLowerCase()} dự án — {projectName}?
      </p>
      <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
        Trạng thái hiện tại: <strong>{statusLabel}</strong>.{' '}
        {action === 'CLOSE'
          ? 'Dự án đóng sẽ không nhận Work Order mới (áp dụng từ JOB slices); lịch sử và dữ liệu đã phát sinh được giữ nguyên. Thao tác được ghi nhật ký hệ thống kèm lý do.'
          : action === 'PAUSE'
            ? 'Dự án tạm dừng sẽ không nhận phân công mới cho đến khi tiếp tục hoạt động; lịch sử và dữ liệu đã phát sinh được giữ nguyên. Thao tác được ghi nhật ký hệ thống kèm lý do.'
            : 'Thao tác được ghi nhật ký hệ thống.'}
      </p>

      <div style={{ marginTop: '0.75rem' }}>
        <label
          htmlFor="project-status-reason"
          style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}
        >
          Lý do{reasonRequired ? ' *' : ''} {reasonRequired ? '(bắt buộc)' : '(không bắt buộc)'}
        </label>
        <textarea
          id="project-status-reason"
          className="bf-input"
          rows={3}
          maxLength={PROJECT_REASON_MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={showFieldError ? true : undefined}
          aria-describedby={showFieldError ? 'project-status-reason-error' : undefined}
          placeholder={
            reasonRequired
              ? 'Nhập lý do tạm dừng/đóng/mở lại (bắt buộc)…'
              : 'Nhập lý do nếu cần…'
          }
          style={showFieldError ? { borderColor: 'var(--bf-risk)' } : undefined}
        />
        {showFieldError ? (
          <p id="project-status-reason-error" className="bf-field-error" role="alert">
            {showFieldError}
          </p>
        ) : null}
        <p style={{ margin: '0.25rem 0 0', color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
          {reason.length}/{PROJECT_REASON_MAX_LENGTH} ký tự · lý do được lưu cùng nhật ký thao tác
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
