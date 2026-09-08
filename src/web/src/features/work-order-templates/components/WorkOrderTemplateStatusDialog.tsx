'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import {
  changeWorkOrderTemplateStatus,
  WORK_ORDER_TEMPLATE_STATUS_LABELS,
  type WorkOrderTemplate,
  type ApiError,
} from '@/lib/api/work-order-templates';

/**
 * Dialog xác nhận chuyển trạng thái mẫu công việc (DRAFT → Hoạt động →
 * Ngừng hoạt động → Kích hoạt lại).
 * - reason: textarea tùy chọn (tối đa 500, lưu vào audit log).
 * - Kích hoạt mẫu rỗng (không kỹ năng, không checklist) bị API chặn 400 —
 *   lỗi hiển thị theo field `status` với hướng dẫn bổ sung.
 * - alreadyInState: true → thông tin 'đã ở trạng thái này', không báo lỗi.
 */
export function WorkOrderTemplateStatusDialog({
  template,
  open,
  onClose,
  onChanged,
}: {
  template: WorkOrderTemplate;
  open: boolean;
  onClose: () => void;
  onChanged: (updated: WorkOrderTemplate) => void;
}) {
  const next = template.status === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE';
  const nextLabel = next === 'ACTIVATE'
    ? (template.status === 'DRAFT' ? 'Hoạt động (kích hoạt)' : 'Hoạt động (kích hoạt lại)')
    : 'Ngừng hoạt động';
  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setNotice(null);
    const trimmed = reason.trim();
    if (trimmed.length > 500) {
      setReasonError('Lý do tối đa 500 ký tự');
      return;
    }
    setReasonError(null);
    setLoading(true);
    try {
      const updated = await changeWorkOrderTemplateStatus(template.id, {
        action: next,
        reason: trimmed || undefined,
      });
      if (updated.alreadyInState) {
        setNotice('Mẫu công việc đã ở trạng thái này — không có thay đổi.');
      }
      onChanged(updated);
      onClose();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.fieldErrors?.reason?.length) setReasonError(e2.fieldErrors.reason.join(' '));
      else if (e2.fieldErrors?.status?.length) setSubmitError(e2.fieldErrors.status.join(' '));
      else if (e2.status === 401) setSubmitError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setSubmitError('Không có quyền — cần ADMIN hoặc Điều phối.');
      else setSubmitError(e2.message || 'Chuyển trạng thái thất bại');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  return (
    <Dialog
      title={next === 'ACTIVATE' ? 'Kích hoạt mẫu công việc' : 'Ngừng hoạt động mẫu công việc'}
      open
      onClose={onClose}
    >
      {next === 'ACTIVATE' ? (
        <Alert tone="info">
          Mẫu kích hoạt phải có ít nhất một kỹ năng yêu cầu hoặc một mục checklist —
          mẫu rỗng sẽ bị từ chối (publish guard).
        </Alert>
      ) : (
        <Alert tone="info">
          Sau khi ngừng hoạt động, mẫu không chọn được cho work order mới; work order
          đã tạo từ mẫu này giữ nguyên snapshot.
        </Alert>
      )}
      <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>
        Xác nhận chuyển <strong>{template.code} — {template.name}</strong> từ{' '}
        <strong>{WORK_ORDER_TEMPLATE_STATUS_LABELS[template.status] ?? template.status}</strong>{' '}
        sang <strong>{nextLabel}</strong>?
      </p>
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
        <div className="bf-field">
          <label className="bf-label" htmlFor="wot-status-reason">Lý do (tùy chọn)</label>
          <textarea
            id="wot-status-reason"
            className="bf-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={reasonError ? { borderColor: 'var(--bf-risk)' } : undefined}
            placeholder="Thí dụ: Đã rà soát xong định mức, đưa vào dùng"
          />
          {reasonError ? <p className="bf-field-error" role="alert">{reasonError}</p> : null}
        </div>
        {submitError ? <Alert tone="error">{submitError}</Alert> : null}
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="submit" loading={loading} aria-busy={loading}>Xác nhận</Button>
        </div>
      </form>
    </Dialog>
  );
}
