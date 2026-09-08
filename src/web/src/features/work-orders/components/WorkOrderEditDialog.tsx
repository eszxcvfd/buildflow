'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';
import { toast } from '@/components/ui/toast/Toaster';
import {
  updateWorkOrder,
  type ApiError,
  type UpdateWorkOrderPayload,
  type WorkOrder,
  type WorkOrderPriority,
} from '@/lib/api/work-orders';
import { listActiveWorkTypes, type WorkType } from '@/lib/api/work-types';
import { listTrades, type Trade } from '@/lib/api/trades';
import { WORK_TYPE_PRIORITY_LABELS } from '@/features/work-types';
import { WORK_ORDER_PRIORITIES } from '../schemas/work-order.schema';

export type WorkOrderEditableField =
  | 'description'
  | 'instructions'
  | 'priority'
  | 'dueAt'
  | 'plannedStartAt'
  | 'plannedEndAt'
  | 'requiredTradeId'
  | 'workTypeId';

const ALL_FIELDS: WorkOrderEditableField[] = [
  'description',
  'instructions',
  'priority',
  'dueAt',
  'plannedStartAt',
  'plannedEndAt',
  'requiredTradeId',
  'workTypeId',
];

/** Lịch/skill/work-type đổi → workflow-impacting (reason + notification). */
export const WORKFLOW_FIELDS: WorkOrderEditableField[] = [
  'plannedStartAt',
  'plannedEndAt',
  'requiredTradeId',
  'workTypeId',
];

const TERMINAL_STATUSES = new Set(['WORK_DONE', 'CLOSED', 'CANCELLED']);

/**
 * Ma trận khóa phía client — mirror server policy
 * (`work-order-update.policy.ts`, ENDPOINTS §17 J7). Server là source of truth;
 * client chỉ ẩn/lock để UX rõ, FIELD_LOCKED server vẫn hiển thị đầy đủ.
 */
export function editableFieldsForStatus(status: string, isAdmin: boolean): Set<WorkOrderEditableField> {
  const s = status.toUpperCase();
  if (s === 'DRAFT' || s === 'READY') return new Set(ALL_FIELDS);
  if (s === 'OPEN') return new Set<WorkOrderEditableField>(['description', 'instructions', 'dueAt']);
  if (s === 'ASSIGNED' || s === 'IN_PROGRESS') {
    return new Set<WorkOrderEditableField>([
      'description',
      'instructions',
      'plannedStartAt',
      'plannedEndAt',
      'requiredTradeId',
      'workTypeId',
    ]);
  }
  if (TERMINAL_STATUSES.has(s)) {
    return isAdmin ? new Set(ALL_FIELDS) : new Set();
  }
  return new Set();
}

export function isExceptionMode(status: string): boolean {
  return TERMINAL_STATUSES.has(status.toUpperCase());
}

function toDatetimeLocal(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoOrNull(datetimeLocal: string): string | null {
  const text = datetimeLocal.trim();
  if (!text) return null;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * JOB-SRS-003 (issue #43) — dialog "Sửa Work Order" trên /work-orders/:id.
 * Form fields theo state matrix server (client chỉ ẩn/lock theo status từ
 * GET :id — server là source of truth, FIELD_LOCKED vẫn hiển thị rõ).
 * 409 → notice tải lại (mirror templates); đổi lịch/skill → notice notification.
 */
export function WorkOrderEditDialog({
  workOrder,
  isAdmin,
  onClose,
  onUpdated,
}: {
  workOrder: WorkOrder;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated?: (workOrder: WorkOrder) => void;
}) {
  const editable = React.useMemo(
    () => editableFieldsForStatus(workOrder.status, isAdmin),
    [workOrder.status, isAdmin],
  );
  const exception = isExceptionMode(workOrder.status);

  const [description, setDescription] = React.useState(workOrder.description ?? '');
  const [instructions, setInstructions] = React.useState(workOrder.instructions ?? '');
  const [priority, setPriority] = React.useState<string>(workOrder.priority);
  const [dueAt, setDueAt] = React.useState(toDatetimeLocal(workOrder.dueAt));
  const [plannedStartAt, setPlannedStartAt] = React.useState(toDatetimeLocal(workOrder.plannedStartAt));
  const [plannedEndAt, setPlannedEndAt] = React.useState(toDatetimeLocal(workOrder.plannedEndAt));
  const [requiredTradeId, setRequiredTradeId] = React.useState(workOrder.requiredTradeId ?? '');
  const [clearTrade, setClearTrade] = React.useState(false);
  const [workTypeId, setWorkTypeId] = React.useState(workOrder.workTypeId);
  const [reason, setReason] = React.useState('');

  const [workTypes, setWorkTypes] = React.useState<WorkType[]>([]);
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [wts, trs] = await Promise.all([
          listActiveWorkTypes().catch(() => null),
          listTrades({ status: 'ACTIVE', limit: 100, offset: 0 }).catch(() => null),
        ]);
        if (cancelled) return;
        if (wts) setWorkTypes(wts.data);
        if (trs) setTrades(trs.data);
      } catch {
        // Select hỗ trợ nhập liệu; lỗi tải không chặn form.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function isLocked(field: WorkOrderEditableField): boolean {
    return !editable.has(field);
  }

  function lockTitle(field: WorkOrderEditableField): string | undefined {
    return isLocked(field) ? `Khóa ở trạng thái ${workOrder.status}` : undefined;
  }

  function fieldError(key: string): string | null {
    const msgs = fieldErrors[key];
    return msgs?.length ? msgs.join(' ') : null;
  }

  /** true khi payload chạm field workflow-impacting (đổi so với hiện tại). */
  function touchesWorkflow(): boolean {
    const startIso = toIsoOrNull(plannedStartAt);
    const endIso = toIsoOrNull(plannedEndAt);
    const tradeNext = clearTrade ? null : requiredTradeId.trim() || workOrder.requiredTradeId;
    const curStart = workOrder.plannedStartAt ? new Date(workOrder.plannedStartAt).getTime() : null;
    const curEnd = workOrder.plannedEndAt ? new Date(workOrder.plannedEndAt).getTime() : null;
    const nextStart = startIso ? new Date(startIso).getTime() : null;
    const nextEnd = endIso ? new Date(endIso).getTime() : null;
    if (editable.has('plannedStartAt') && nextStart !== curStart) return true;
    if (editable.has('plannedEndAt') && nextEnd !== curEnd) return true;
    if (editable.has('requiredTradeId') && (tradeNext ?? null) !== (workOrder.requiredTradeId ?? null)) return true;
    if (editable.has('workTypeId') && workTypeId.trim() && workTypeId.trim() !== workOrder.workTypeId) return true;
    return false;
  }

  const showReasonHint = touchesWorkflow() || exception;
  const workflowTouched = touchesWorkflow();

  function setFormError(e: unknown) {
    const err = e as ApiError;
    if (err.status === 409) {
      const msg =
        err.fieldErrors?.expectedVersion?.join(' ') ?? err.message ?? 'Dữ liệu đã được người khác cập nhật';
      setConflict(msg);
      return;
    }
    if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
      const fe: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(err.fieldErrors)) {
        if (k === '_global' || k === '_locked') continue;
        fe[k] = v;
      }
      setFieldErrors(fe);
      const lockedMsgs = err.fieldErrors._locked;
      const globalMsgs = err.fieldErrors._global;
      if (lockedMsgs?.length || globalMsgs?.length) {
        setGlobalError([...(lockedMsgs ?? []), ...(globalMsgs ?? []), err.message].filter(Boolean).join(' '));
      } else {
        setGlobalError(err.message);
      }
    } else if (err.status === 401) {
      setGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
    } else if (err.status === 403) {
      setGlobalError('Không có quyền — cần quản trị hoặc quản lý/điều phối dự án (403)');
    } else {
      setGlobalError(err.message || 'Cập nhật work order thất bại');
    }
  }

  function buildPayload(): { payload: UpdateWorkOrderPayload; touchedWorkflow: boolean; changed: boolean } {
    const payload: UpdateWorkOrderPayload = {};
    let changed = false;
    const curStart = workOrder.plannedStartAt ? new Date(workOrder.plannedStartAt).getTime() : null;
    const curEnd = workOrder.plannedEndAt ? new Date(workOrder.plannedEndAt).getTime() : null;
    const curDue = workOrder.dueAt ? new Date(workOrder.dueAt).getTime() : null;

    if (editable.has('description') && description.trim() !== (workOrder.description ?? '')) {
      payload.description = description.trim() || null;
      changed = true;
    }
    if (editable.has('instructions') && instructions.trim() !== (workOrder.instructions ?? '')) {
      payload.instructions = instructions.trim() || null;
      changed = true;
    }
    if (editable.has('priority') && priority !== workOrder.priority) {
      payload.priority = priority as WorkOrderPriority;
      changed = true;
    }
    if (editable.has('dueAt')) {
      const nextIso = toIsoOrNull(dueAt);
      const nextTime = nextIso ? new Date(nextIso).getTime() : null;
      if (nextTime !== curDue) {
        payload.dueAt = nextIso;
        changed = true;
      }
    }
    if (editable.has('plannedStartAt')) {
      const nextIso = toIsoOrNull(plannedStartAt);
      const nextTime = nextIso ? new Date(nextIso).getTime() : null;
      if (nextTime !== curStart) {
        payload.plannedStartAt = nextIso;
        changed = true;
      }
    }
    if (editable.has('plannedEndAt')) {
      const nextIso = toIsoOrNull(plannedEndAt);
      const nextTime = nextIso ? new Date(nextIso).getTime() : null;
      if (nextTime !== curEnd) {
        payload.plannedEndAt = nextIso;
        changed = true;
      }
    }
    if (editable.has('requiredTradeId')) {
      if (clearTrade) {
        if (workOrder.requiredTradeId !== null) {
          payload.requiredTradeId = null;
          changed = true;
        }
      } else if (requiredTradeId.trim() && requiredTradeId.trim() !== (workOrder.requiredTradeId ?? '')) {
        payload.requiredTradeId = requiredTradeId.trim();
        changed = true;
      }
    }
    if (editable.has('workTypeId') && workTypeId.trim() && workTypeId.trim() !== workOrder.workTypeId) {
      payload.workTypeId = workTypeId.trim();
      changed = true;
    }

    const touchedWorkflow =
      payload.plannedStartAt !== undefined ||
      payload.plannedEndAt !== undefined ||
      payload.requiredTradeId !== undefined ||
      payload.workTypeId !== undefined;
    const reasonText = reason.trim();
    if (reasonText) payload.reason = reasonText;
    payload.expectedVersion = workOrder.version;
    return { payload, touchedWorkflow, changed };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setGlobalError(null);
    setConflict(null);

    // Client hint sớm (server authoritative): đổi lịch/skill/work-type ở
    // ASSIGNED/IN_PROGRESS bắt buộc reason; exception mode bắt buộc ≥10 ký tự.
    const { payload, touchedWorkflow } = buildPayload();
    const reasonText = reason.trim();
    if (!exception && touchedWorkflow && !reasonText) {
      setFieldErrors({ reason: ['Đổi lịch/ngành nghề/loại công việc bắt buộc kèm lý do (reason)'] });
      return;
    }
    if (exception && reasonText.length < 10) {
      setFieldErrors({
        reason: ['Chế độ ngoại lệ: lý do bắt buộc tối thiểu 10 ký tự'],
      });
      return;
    }
    // Client range check sớm (server authoritative 400 plannedEndAt).
    const s = payload.plannedStartAt !== undefined ? payload.plannedStartAt : workOrder.plannedStartAt;
    const en = payload.plannedEndAt !== undefined ? payload.plannedEndAt : workOrder.plannedEndAt;
    if (s && en && !(new Date(s).getTime() < new Date(en).getTime())) {
      setFieldErrors({ plannedEndAt: ['Thời điểm kết thúc kế hoạch phải sau thời điểm bắt đầu'] });
      return;
    }

    setPending(true);
    try {
      const updated = await updateWorkOrder(workOrder.id, payload);
      toast.success({ title: `Đã cập nhật Work Order ${updated.code}` });
      if (touchedWorkflow) {
        toast.info({ title: 'Đã gửi thông báo cho người liên quan' });
      }
      onClose();
      onUpdated?.(updated);
    } catch (err) {
      setFormError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="Sửa Work Order" open onClose={onClose} className="max-w-2xl">
      <Card>
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          {workOrder.code} · trạng thái {workOrder.status} · phiên bản {workOrder.version}
          {exception ? ' · chế độ ngoại lệ (chỉ ADMIN)' : null}
        </p>
        {exception ? (
          <Alert tone="info">Chế độ ngoại lệ: mọi thay đổi cần lý do tối thiểu 10 ký tự và được ghi audit.</Alert>
        ) : null}
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}
        {conflict ? (
          <Alert tone="error">
            {conflict || 'Work order đã được người khác cập nhật — tải lại để lấy bản mới nhất rồi sửa tiếp.'}
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={onClose}>
                Tải lại
              </Button>
            </div>
          </Alert>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="woedit-description">
              Mô tả{isLocked('description') ? ' (khóa)' : null}
            </label>
            <textarea
              id="woedit-description"
              className="bf-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={pending || isLocked('description')}
              title={lockTitle('description')}
              aria-invalid={Boolean(fieldErrors.description)}
              placeholder="Mô tả ngắn về công việc (tối đa 5000 ký tự)"
            />
            {isLocked('description') ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
            ) : null}
            {fieldError('description') ? <p className="bf-field-error" role="alert">{fieldError('description')}</p> : null}
          </div>

          <div className="bf-field">
            <label className="bf-label" htmlFor="woedit-instructions">
              Hướng dẫn thi công{isLocked('instructions') ? ' (khóa)' : null}
            </label>
            <textarea
              id="woedit-instructions"
              className="bf-input"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              disabled={pending || isLocked('instructions')}
              title={lockTitle('instructions')}
              aria-invalid={Boolean(fieldErrors.instructions)}
              placeholder="Hướng dẫn thi công, an toàn, nghiệm thu (tối đa 5000 ký tự)"
            />
            {isLocked('instructions') ? (
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
            ) : null}
            {fieldError('instructions') ? <p className="bf-field-error" role="alert">{fieldError('instructions')}</p> : null}
          </div>

          <div className="bf-form-grid">
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-priority">
                Ưu tiên{isLocked('priority') ? ' (khóa)' : null}
              </label>
              <select
                id="woedit-priority"
                className="bf-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={pending || isLocked('priority')}
                title={lockTitle('priority')}
                aria-invalid={Boolean(fieldErrors.priority)}
              >
                {WORK_ORDER_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {WORK_TYPE_PRIORITY_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
              {isLocked('priority') ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
              ) : null}
              {fieldError('priority') ? <p className="bf-field-error" role="alert">{fieldError('priority')}</p> : null}
            </div>
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-dueat">
                Hạn hoàn thành{isLocked('dueAt') ? ' (khóa)' : null}
              </label>
              <Input
                id="woedit-dueat"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                hasError={Boolean(fieldErrors.dueAt)}
                disabled={pending || isLocked('dueAt')}
                title={lockTitle('dueAt')}
              />
              {isLocked('dueAt') ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
              ) : null}
              {fieldError('dueAt') ? <p className="bf-field-error" role="alert">{fieldError('dueAt')}</p> : null}
            </div>
          </div>

          <div className="bf-form-grid">
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-start">
                Lịch bắt đầu{isLocked('plannedStartAt') ? ' (khóa)' : null}
              </label>
              <Input
                id="woedit-start"
                type="datetime-local"
                value={plannedStartAt}
                onChange={(e) => setPlannedStartAt(e.target.value)}
                hasError={Boolean(fieldErrors.plannedStartAt)}
                disabled={pending || isLocked('plannedStartAt')}
                title={lockTitle('plannedStartAt')}
              />
              {isLocked('plannedStartAt') ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
              ) : null}
              {fieldError('plannedStartAt') ? (
                <p className="bf-field-error" role="alert">{fieldError('plannedStartAt')}</p>
              ) : null}
            </div>
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-end">
                Lịch kết thúc{isLocked('plannedEndAt') ? ' (khóa)' : null}
              </label>
              <Input
                id="woedit-end"
                type="datetime-local"
                value={plannedEndAt}
                onChange={(e) => setPlannedEndAt(e.target.value)}
                hasError={Boolean(fieldErrors.plannedEndAt)}
                disabled={pending || isLocked('plannedEndAt')}
                title={lockTitle('plannedEndAt')}
              />
              {isLocked('plannedEndAt') ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
              ) : null}
              {fieldError('plannedEndAt') ? (
                <p className="bf-field-error" role="alert">{fieldError('plannedEndAt')}</p>
              ) : null}
            </div>
          </div>

          <div className="bf-form-grid">
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-trade">
                Ngành nghề yêu cầu{isLocked('requiredTradeId') ? ' (khóa)' : null}
              </label>
              <select
                id="woedit-trade"
                className="bf-input"
                value={clearTrade ? '' : requiredTradeId}
                onChange={(e) => {
                  setClearTrade(false);
                  setRequiredTradeId(e.target.value);
                }}
                disabled={pending || isLocked('requiredTradeId')}
                title={lockTitle('requiredTradeId')}
                aria-invalid={Boolean(fieldErrors.requiredTradeId)}
              >
                <option value="">— Không yêu cầu cụ thể —</option>
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
                {requiredTradeId && !trades.some((t) => t.id === requiredTradeId) ? (
                  <option value={requiredTradeId}>Giữ ngành nghề hiện tại</option>
                ) : null}
              </select>
              {!isLocked('requiredTradeId') && workOrder.requiredTradeId ? (
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={clearTrade}
                    onChange={(e) => setClearTrade(e.target.checked)}
                    disabled={pending}
                  />
                  Gỡ ngành nghề yêu cầu
                </label>
              ) : null}
              {isLocked('requiredTradeId') ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
              ) : null}
              {fieldError('requiredTradeId') ? (
                <p className="bf-field-error" role="alert">{fieldError('requiredTradeId')}</p>
              ) : null}
            </div>
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-worktype">
                Loại công việc{isLocked('workTypeId') ? ' (khóa)' : null}
              </label>
              <select
                id="woedit-worktype"
                className="bf-input"
                value={workTypeId}
                onChange={(e) => setWorkTypeId(e.target.value)}
                disabled={pending || isLocked('workTypeId')}
                title={lockTitle('workTypeId')}
                aria-invalid={Boolean(fieldErrors.workTypeId)}
              >
                {workTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
                {!workTypes.some((t) => t.id === workTypeId) ? (
                  <option value={workTypeId}>Giữ loại công việc hiện tại</option>
                ) : null}
              </select>
              {isLocked('workTypeId') ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>Khóa ở trạng thái {workOrder.status}</p>
              ) : null}
              {fieldError('workTypeId') ? (
                <p className="bf-field-error" role="alert">{fieldError('workTypeId')}</p>
              ) : null}
            </div>
          </div>

          {showReasonHint ? (
            <div className="bf-field">
              <label className="bf-label" htmlFor="woedit-reason">
                Lý do thay đổi{exception ? ' * (ngoại lệ, tối thiểu 10 ký tự)' : workflowTouched ? ' * (bắt buộc khi đổi lịch/ngành nghề/loại)' : null}
              </label>
              <textarea
                id="woedit-reason"
                className="bf-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.reason)}
                placeholder={exception ? 'Lý do ngoại lệ (tối thiểu 10 ký tự, ghi audit)' : 'Lý do đổi lịch/ngành nghề/loại công việc'}
              />
              {fieldError('reason') ? <p className="bf-field-error" role="alert">{fieldError('reason')}</p> : null}
            </div>
          ) : null}

          <div className="bf-form-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" loading={pending} aria-busy={pending} disabled={pending}>
              {pending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </Card>
    </Dialog>
  );
}
