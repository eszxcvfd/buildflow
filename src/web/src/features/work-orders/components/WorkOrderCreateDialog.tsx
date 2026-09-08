'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';
import { toast } from '@/components/ui/toast/Toaster';
import { createWorkOrder, type ApiError, type WorkOrder } from '@/lib/api/work-orders';
import { listActiveWorkTypes, type WorkType } from '@/lib/api/work-types';
import { listProjectAreas, type ProjectArea } from '@/lib/api/projects';
import { listTrades, type Trade } from '@/lib/api/trades';
import { WORK_TYPE_PRIORITY_LABELS } from '@/features/work-types';
import {
  defaultWorkOrderFormValues,
  validateWorkOrderCreate,
  toCreateWorkOrderPayload,
  WORK_ORDER_PRIORITIES,
  type WorkOrderFormValues,
} from '../schemas/work-order.schema';

function newRequestKey(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fallback bên dưới */
  }
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(Math.random() * 4) + 8) % 16];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

interface PickerState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/**
 * JOB-SRS-001 (issue #41) — dialog "Tạo Work Order nháp" từ context dự án.
 * Mirror WorkTypeCreateDialog (Card layout, field-level errors, aria-live):
 * - 3 picker active-only (loại công việc / khu vực / ngành nghề) với
 *   loading/empty/error+retry states.
 * - `requestKey` sinh MỘT lần mỗi phiên mở, giữ cố định qua các lần retry
 *   trong phiên (replay cùng key → server 200 + notice, không tạo mới).
 * - Thành công → summary inline (mã, id, notice replay) + nút Đóng; KHÔNG tự
 *   đóng để người dùng đọc được kết quả; onCreated báo parent refresh.
 */
export function WorkOrderCreateDialog({
  open,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onCreated?: (workOrder: WorkOrder) => void;
}) {
  const [values, setValues] = React.useState<WorkOrderFormValues>(defaultWorkOrderFormValues);
  const [requestKey, setRequestKey] = React.useState<string>(() => newRequestKey());
  // Khởi false để mount lần đầu với open=true cũng nạp picker (dialog trong
  // ProjectDetail chỉ mount khi mở).
  const prevOpen = React.useRef(false);

  const [workTypes, setWorkTypes] = React.useState<PickerState<WorkType>>({ data: [], loading: false, error: null });
  const [areas, setAreas] = React.useState<PickerState<ProjectArea>>({ data: [], loading: false, error: null });
  const [trades, setTrades] = React.useState<PickerState<Trade>>({ data: [], loading: false, error: null });

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [created, setCreated] = React.useState<{ workOrder: WorkOrder; idempotentReplay: boolean } | null>(null);

  function setValue<K extends keyof WorkOrderFormValues>(key: K, value: WorkOrderFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const loadWorkTypes = React.useCallback(async () => {
    setWorkTypes((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await listActiveWorkTypes();
      setWorkTypes({ data: res.data, loading: false, error: null });
    } catch {
      setWorkTypes((p) => ({ ...p, loading: false, error: 'Không tải được danh sách loại công việc' }));
    }
  }, []);

  const loadAreas = React.useCallback(async () => {
    setAreas((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await listProjectAreas(projectId, { activeOnly: true });
      setAreas({ data: res.data, loading: false, error: null });
    } catch {
      setAreas((p) => ({ ...p, loading: false, error: 'Không tải được danh sách khu vực' }));
    }
  }, [projectId]);

  const loadTrades = React.useCallback(async () => {
    setTrades((p) => ({ ...p, loading: true, error: null }));
    try {
      const res = await listTrades({ status: 'ACTIVE', limit: 100, offset: 0 });
      setTrades({ data: res.data, loading: false, error: null });
    } catch {
      setTrades((p) => ({ ...p, loading: false, error: 'Không tải được danh sách ngành nghề' }));
    }
  }, []);

  // Mỗi phiên mở: requestKey mới + reset form/kết quả + nạp 3 picker.
  React.useEffect(() => {
    if (open && !prevOpen.current) {
      setRequestKey(newRequestKey());
      setValues(defaultWorkOrderFormValues());
      setFieldErrors({});
      setGlobalError(null);
      setForbidden(false);
      setCreated(null);
      void loadWorkTypes();
      void loadAreas();
      void loadTrades();
    }
    prevOpen.current = open;
  }, [open, loadWorkTypes, loadAreas, loadTrades]);

  if (!open) return null;

  function setFormError(e: unknown) {
    const err = e as ApiError;
    if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
      const fe: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(err.fieldErrors)) {
        if (k === '_global') continue;
        fe[k] = v;
      }
      setFieldErrors(fe);
      if (err.fieldErrors._global?.length) setGlobalError(err.fieldErrors._global.join(' '));
      else setGlobalError(err.message);
    } else if (err.status === 401) {
      setGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
    } else if (err.status === 403) {
      setForbidden(true);
      setGlobalError('Không có quyền — cần quản trị hoặc quản lý/điều phối dự án (403)');
    } else {
      setGlobalError(err.message || 'Tạo work order thất bại');
    }
  }

  async function submit() {
    if (pending) return;
    setPending(true);
    setFieldErrors({});
    setGlobalError(null);
    setForbidden(false);
    try {
      const payload = toCreateWorkOrderPayload(projectId, values, requestKey);
      const result = await createWorkOrder(payload);
      setCreated(result);
      toast.success({ title: `Đã tạo Work Order ${result.workOrder.code}` });
      onCreated?.(result.workOrder);
    } catch (e) {
      setFormError(e);
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreated(null);
    const validation = validateWorkOrderCreate(values);
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    await submit();
  }

  function fieldError(key: string): string | null {
    const msgs = fieldErrors[key];
    return msgs?.length ? msgs.join(' ') : null;
  }

  return (
    <Dialog title="Tạo Work Order nháp" open onClose={onClose} className="max-w-2xl">
      <Card>
        {created ? (
          <div aria-live="polite" style={{ display: 'grid', gap: '0.75rem' }}>
            <Alert tone="success">
              Đã tạo Work Order {created.workOrder.code} (id {created.workOrder.id}).
            </Alert>
            {created.idempotentReplay ? (
              <Alert tone="info">Đã tồn tại từ lần gửi trước — không tạo bản ghi mới.</Alert>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={onClose}>
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} noValidate style={{ display: 'grid', gap: '1rem' }}>
            {globalError ? <Alert tone="error">{globalError}</Alert> : null}
            {forbidden ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" type="button" onClick={() => void submit()} disabled={pending}>
                  {pending ? 'Đang tạo…' : 'Thử lại'}
                </Button>
              </div>
            ) : null}

            <div className="bf-field">
              <label className="bf-label" htmlFor="wo-title">Tiêu đề *</label>
              <Input
                id="wo-title"
                value={values.title}
                onChange={(e) => setValue('title', e.target.value)}
                hasError={Boolean(fieldErrors.title)}
                placeholder="Thí dụ: Đổ bê tông cột C1 tầng 2"
                disabled={pending}
              />
              {fieldError('title') ? <p className="bf-field-error" role="alert">{fieldError('title')}</p> : null}
            </div>

            <div className="bf-form-grid">
              <div className="bf-field">
                <label className="bf-label" htmlFor="wo-code">Mã</label>
                <Input
                  id="wo-code"
                  value={values.code}
                  onChange={(e) => setValue('code', e.target.value)}
                  hasError={Boolean(fieldErrors.code)}
                  placeholder="Bỏ trống để hệ thống tự sinh"
                  disabled={pending}
                />
                {fieldError('code') ? <p className="bf-field-error" role="alert">{fieldError('code')}</p> : null}
              </div>
              <div className="bf-field">
                <label className="bf-label" htmlFor="wo-priority">Ưu tiên</label>
                <select
                  id="wo-priority"
                  className="bf-input"
                  value={values.priority}
                  onChange={(e) => setValue('priority', e.target.value as WorkOrderFormValues['priority'])}
                  aria-invalid={Boolean(fieldErrors.priority)}
                  disabled={pending}
                >
                  {WORK_ORDER_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {WORK_TYPE_PRIORITY_LABELS[p] ?? p}
                    </option>
                  ))}
                </select>
                {fieldError('priority') ? <p className="bf-field-error" role="alert">{fieldError('priority')}</p> : null}
              </div>
            </div>

            <div className="bf-field">
              <label className="bf-label" htmlFor="wo-worktype">Loại công việc *</label>
              {workTypes.loading ? (
                <p aria-busy="true" style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải loại công việc…</p>
              ) : workTypes.error ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--bf-risk)' }}>{workTypes.error}</span>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void loadWorkTypes()}>
                    Thử lại
                  </Button>
                </div>
              ) : (
                <select
                  id="wo-worktype"
                  className="bf-input"
                  value={values.workTypeId}
                  onChange={(e) => setValue('workTypeId', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.workTypeId)}
                  disabled={pending}
                >
                  <option value="">
                    {workTypes.data.length === 0 ? 'Chưa có loại công việc đang hoạt động' : '— Chọn loại công việc —'}
                  </option>
                  {workTypes.data.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.name}
                    </option>
                  ))}
                </select>
              )}
              {fieldError('workTypeId') ? <p className="bf-field-error" role="alert">{fieldError('workTypeId')}</p> : null}
            </div>

            <div className="bf-form-grid">
              <div className="bf-field">
                <label className="bf-label" htmlFor="wo-area">Khu vực</label>
                {areas.loading ? (
                  <p aria-busy="true" style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải khu vực…</p>
                ) : areas.error ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--bf-risk)' }}>{areas.error}</span>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void loadAreas()}>
                      Thử lại
                    </Button>
                  </div>
                ) : (
                  <select
                    id="wo-area"
                    className="bf-input"
                    value={values.areaId}
                    onChange={(e) => setValue('areaId', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.areaId)}
                    disabled={pending}
                  >
                    <option value="">
                      {areas.data.length === 0 ? 'Chưa có khu vực đang hoạt động' : '— Không chọn khu vực —'}
                    </option>
                    {areas.data.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code ? `${a.code} — ${a.name}` : a.name}
                      </option>
                    ))}
                  </select>
                )}
                {fieldError('areaId') ? <p className="bf-field-error" role="alert">{fieldError('areaId')}</p> : null}
              </div>
              <div className="bf-field">
                <label className="bf-label" htmlFor="wo-trade">Ngành nghề yêu cầu</label>
                {trades.loading ? (
                  <p aria-busy="true" style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải ngành nghề…</p>
                ) : trades.error ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--bf-risk)' }}>{trades.error}</span>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void loadTrades()}>
                      Thử lại
                    </Button>
                  </div>
                ) : (
                  <select
                    id="wo-trade"
                    className="bf-input"
                    value={values.requiredTradeId}
                    onChange={(e) => setValue('requiredTradeId', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.requiredTradeId)}
                    disabled={pending}
                  >
                    <option value="">
                      {trades.data.length === 0 ? 'Chưa có ngành nghề đang hoạt động' : '— Không yêu cầu cụ thể —'}
                    </option>
                    {trades.data.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {fieldError('requiredTradeId') ? (
                  <p className="bf-field-error" role="alert">{fieldError('requiredTradeId')}</p>
                ) : null}
              </div>
            </div>

            <div className="bf-form-grid">
              <div className="bf-field">
                <label className="bf-label" htmlFor="wo-start">Ngày kế hoạch bắt đầu</label>
                <Input
                  id="wo-start"
                  type="datetime-local"
                  value={values.plannedStartAt}
                  onChange={(e) => setValue('plannedStartAt', e.target.value)}
                  hasError={Boolean(fieldErrors.plannedStartAt)}
                  disabled={pending}
                />
                {fieldError('plannedStartAt') ? (
                  <p className="bf-field-error" role="alert">{fieldError('plannedStartAt')}</p>
                ) : null}
              </div>
              <div className="bf-field">
                <label className="bf-label" htmlFor="wo-end">Ngày kế hoạch kết thúc</label>
                <Input
                  id="wo-end"
                  type="datetime-local"
                  value={values.plannedEndAt}
                  onChange={(e) => setValue('plannedEndAt', e.target.value)}
                  hasError={Boolean(fieldErrors.plannedEndAt)}
                  disabled={pending}
                />
                {fieldError('plannedEndAt') ? (
                  <p className="bf-field-error" role="alert">{fieldError('plannedEndAt')}</p>
                ) : null}
              </div>
            </div>

            <div className="bf-field">
              <label className="bf-label" htmlFor="wo-headcount">Số người dự kiến</label>
              <Input
                id="wo-headcount"
                value={values.plannedHeadcount}
                onChange={(e) => setValue('plannedHeadcount', e.target.value)}
                hasError={Boolean(fieldErrors.plannedHeadcount)}
                placeholder="1 – 99 (bỏ trống nếu chưa xác định)"
                inputMode="numeric"
                disabled={pending}
              />
              {fieldError('plannedHeadcount') ? (
                <p className="bf-field-error" role="alert">{fieldError('plannedHeadcount')}</p>
              ) : null}
            </div>

            <div className="bf-field">
              <label className="bf-label" htmlFor="wo-description">Mô tả</label>
              <textarea
                id="wo-description"
                className="bf-input"
                value={values.description}
                onChange={(e) => setValue('description', e.target.value)}
                rows={3}
                style={fieldErrors.description ? { borderColor: 'var(--bf-risk)' } : undefined}
                placeholder="Mô tả ngắn về công việc (tối đa 5000 ký tự)"
                disabled={pending}
              />
              {fieldError('description') ? <p className="bf-field-error" role="alert">{fieldError('description')}</p> : null}
            </div>

            <div className="bf-field">
              <label className="bf-label" htmlFor="wo-instructions">Hướng dẫn</label>
              <textarea
                id="wo-instructions"
                className="bf-input"
                value={values.instructions}
                onChange={(e) => setValue('instructions', e.target.value)}
                rows={3}
                style={fieldErrors.instructions ? { borderColor: 'var(--bf-risk)' } : undefined}
                placeholder="Hướng dẫn thi công, an toàn, nghiệm thu (tối đa 5000 ký tự)"
                disabled={pending}
              />
              {fieldError('instructions') ? (
                <p className="bf-field-error" role="alert">{fieldError('instructions')}</p>
              ) : null}
            </div>

            <div className="bf-form-actions">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Hủy
              </Button>
              <Button type="submit" loading={pending} aria-busy={pending} disabled={pending}>
                {pending ? 'Đang tạo…' : 'Tạo Work Order'}
              </Button>
            </div>

            <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
              Trường có dấu * là bắt buộc. Bỏ trống Mã để hệ thống tự sinh. Work Order mới
              luôn ở trạng thái Nháp.
            </p>
          </form>
        )}
      </Card>
    </Dialog>
  );
}
