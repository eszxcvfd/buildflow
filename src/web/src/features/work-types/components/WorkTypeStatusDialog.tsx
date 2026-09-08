'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { changeWorkTypeStatus, type WorkType, type ApiError } from '@/lib/api/work-types';

/**
 * Dialog xác nhận Ngừng hoạt động / Kích hoạt lại loại công việc.
 * - reason: textarea bắt buộc (1–500).
 * - Cảnh báo khi usage.workOrders > 0: cấu hình đổi trong khi đang được
 *   tham chiếu — lịch sử giữ nguyên.
 * - alreadyInState: true → thông tin 'đã ở trạng thái này', không báo lỗi.
 */
export function WorkTypeStatusDialog({
  workType,
  open,
  onClose,
  onChanged,
}: {
  workType: WorkType;
  open: boolean;
  onClose: () => void;
  onChanged: (updated: WorkType) => void;
}) {
  const isActive = workType.status === 'ACTIVE';
  const next = isActive ? 'DEACTIVATE' : 'ACTIVATE';
  const [reason, setReason] = React.useState('');
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const openWorkOrders = workType.usage?.workOrders ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setNotice(null);
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Vui lòng nhập lý do chuyển trạng thái');
      return;
    }
    if (trimmed.length > 500) {
      setReasonError('Lý do tối đa 500 ký tự');
      return;
    }
    setReasonError(null);
    setLoading(true);
    try {
      const updated = await changeWorkTypeStatus(workType.id, { action: next, reason: trimmed });
      if (updated.alreadyInState) {
        setNotice('Loại công việc đã ở trạng thái này — không có thay đổi.');
      }
      onChanged(updated);
      onClose();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.fieldErrors?.reason?.length) setReasonError(e2.fieldErrors.reason.join(' '));
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
      title={isActive ? 'Ngừng hoạt động loại công việc' : 'Kích hoạt lại loại công việc'}
      open
      onClose={onClose}
    >
      {openWorkOrders > 0 && isActive ? (
        <Alert tone="info">
          Loại công việc đang được dùng bởi {openWorkOrders} work order — sau khi ngừng hoạt
          động, work order mới không chọn được loại này, lịch sử cũ giữ nguyên.
        </Alert>
      ) : null}
      <p style={{ color: '#4b5563', fontSize: '0.9rem' }}>
        Xác nhận chuyển <strong>{workType.code} — {workType.name}</strong> sang{' '}
        <strong>{isActive ? 'Ngừng hoạt động' : 'Hoạt động'}</strong>?
      </p>
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
        <div className="bf-field">
          <label className="bf-label" htmlFor="worktype-status-reason">Lý do *</label>
          <textarea
            id="worktype-status-reason"
            className="bf-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={reasonError ? { borderColor: 'var(--bf-risk)' } : undefined}
            placeholder="Thí dụ: Tạm dừng để rà soát định mức"
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
