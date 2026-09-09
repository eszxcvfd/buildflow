'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';
import { toast } from '@/components/ui/toast/Toaster';
import { openJobBoard } from '@/lib/api/work-order-board';
import type { ApiError, WorkOrder } from '@/lib/api/work-orders';

/**
 * F004 — format ISO UTC về `datetime-local` (giờ local, mất offset) để
 * prefill dialog. Đối ngẫu với `toIsoOrNull` (round-trip giữ nguyên instant
 * ở độ chính xác phút — export để unit test).
 */
export function toDatetimeLocal(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Chuyển chuỗi `datetime-local` (naive, không offset — R6) thành ISO-8601 UTC
 * instant trước khi gửi (`new Date(v).toISOString()` bắt buộc).
 */
export function toIsoOrNull(datetimeLocal: string): string | null {
  const text = datetimeLocal.trim();
  if (!text) return null;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export interface WorkOrderJobBoardDialogProps {
  workOrder: WorkOrder;
  onClose: () => void;
  /** Gọi sau khi mở thành công (parent re-fetch GET :id). */
  onOpened: () => void;
  /**
   * F011 — refetch `GET :id` giữ dialog mở. Dùng cho `409
   * JOB_BOARD_ALREADY_OPEN`: tự refetch TRƯỚC khi hiện Alert (không đóng
   * dialog như `onOpened`).
   */
  onRefetch?: () => void;
}

/**
 * JOB-SRS-004 (issue #44) — dialog "Mở Job Board": 2 ô `datetime-local`
 * (đến optional) → client bắt buộc `toISOString()` (R6), client-validate
 * `until > from` + `until` tương lai; `fieldErrors` (`JOB_BOARD_WINDOW_INVALID`)
 * render đúng dưới từng input; 409 `WORK_ORDER_CONFLICT` → Alert + nút Tải lại.
 */
export function WorkOrderJobBoardDialog({ workOrder, onClose, onOpened, onRefetch }: WorkOrderJobBoardDialogProps) {
  const [from, setFrom] = React.useState(() => toDatetimeLocal(workOrder.jobBoard?.openFrom ?? null));
  const [until, setUntil] = React.useState(() => toDatetimeLocal(workOrder.jobBoard?.openUntil ?? null));
  const [pending, setPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<ApiError | null>(null);

  function fieldError(key: string): string | null {
    const msgs = fieldErrors[key];
    return msgs && msgs.length > 0 ? msgs.join(' ') : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isoFrom = toIsoOrNull(from);
    if (!isoFrom) {
      setFieldErrors({ jobBoardOpenFrom: ['Thời điểm bắt đầu không hợp lệ'] });
      return;
    }
    const isoUntil = toIsoOrNull(until);
    // Client-validate sớm (server authoritative 400 fieldErrors).
    if (isoUntil) {
      if (!(new Date(isoUntil).getTime() > new Date(isoFrom).getTime())) {
        setFieldErrors({ jobBoardOpenUntil: ['Thời điểm kết thúc phải sau thời điểm bắt đầu'] });
        return;
      }
      if (!(new Date(isoUntil).getTime() > Date.now())) {
        setFieldErrors({ jobBoardOpenUntil: ['Thời điểm kết thúc phải trong tương lai'] });
        return;
      }
    }
    setPending(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const res = await openJobBoard(workOrder.id, {
        jobBoardOpenFrom: isoFrom,
        jobBoardOpenUntil: isoUntil,
        expectedVersion: workOrder.version,
      });
      toast.success({ title: res.alreadyOpen ? 'Job Board đã mở trước đó' : `Đã mở Job Board ${workOrder.code}` });
      onClose();
      onOpened();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.fieldErrors && Object.keys(apiErr.fieldErrors).length > 0) {
        setFieldErrors(apiErr.fieldErrors);
      }
      // F011 — 409 ALREADY_OPEN: tự refetch GET :id TRƯỚC khi hiện Alert
      // (dialog giữ mở để user đọc hướng dẫn "đóng trước khi mở lại").
      if (apiErr.code === 'JOB_BOARD_ALREADY_OPEN') {
        onRefetch?.();
      }
      setFormError(apiErr);
    } finally {
      setPending(false);
    }
  }

  const conflict = formError?.code === 'WORK_ORDER_CONFLICT';

  return (
    <Dialog title={workOrder.status === 'OPEN' ? 'Mở lại Job Board' : 'Mở Job Board'} open onClose={onClose}>
      <Card>
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          {workOrder.code} · trạng thái {workOrder.status} · phiên bản {workOrder.version}
        </p>
        {formError && !conflict ? (
          formError.code === 'JOB_BOARD_HAS_ASSIGNEE' ? (
            <Alert tone="error">Work order đã có người nhận — không thể mở Job Board.</Alert>
          ) : formError.code === 'JOB_BOARD_ALREADY_OPEN' ? (
            <Alert tone="error">Job Board đang mở với cửa sổ khác — đóng Job Board trước khi mở lại.</Alert>
          ) : formError.code === 'WORK_ORDER_NOT_PUBLISHABLE' ? (
            <Alert tone="error">Work order chưa đủ điều kiện công bố — kiểm tra panel điều kiện công bố.</Alert>
          ) : formError.code === 'WORK_ORDER_STATUS_NOT_OPENABLE' ? (
            <Alert tone="error">Trạng thái hiện tại không mở được Job Board.</Alert>
          ) : formError.status === 403 ? (
            <Alert tone="error">Không có quyền thao tác Job Board — cần quyền quản lý dự án (403)</Alert>
          ) : (
            <Alert tone="error">{formError.message || 'Mở Job Board thất bại'}</Alert>
          )
        ) : null}
        {conflict && formError ? (
          <Alert tone="error">
            Work order đã bị thay đổi — tải lại để lấy bản mới nhất rồi thử tiếp.
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={onOpened}>
                Tải lại
              </Button>
            </div>
          </Alert>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="wojb-from">
              Mở từ
            </label>
            <Input
              id="wojb-from"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={pending}
              hasError={Boolean(fieldErrors.jobBoardOpenFrom)}
              aria-invalid={Boolean(fieldErrors.jobBoardOpenFrom)}
            />
            {fieldError('jobBoardOpenFrom') ? <p className="bf-field-error" role="alert">{fieldError('jobBoardOpenFrom')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="wojb-until">
              Đến (để trống = không hạn)
            </label>
            <Input
              id="wojb-until"
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              disabled={pending}
              hasError={Boolean(fieldErrors.jobBoardOpenUntil)}
              aria-invalid={Boolean(fieldErrors.jobBoardOpenUntil)}
            />
            {fieldError('jobBoardOpenUntil') ? <p className="bf-field-error" role="alert">{fieldError('jobBoardOpenUntil')}</p> : null}
          </div>
          <div className="bf-form-actions">
            <Button variant="secondary" type="button" onClick={onClose} disabled={pending}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={pending}>
              Xác nhận mở
            </Button>
          </div>
        </form>
      </Card>
    </Dialog>
  );
}
