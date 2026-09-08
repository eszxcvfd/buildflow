'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  createWorkType,
  updateWorkType,
  type RequiredField,
  type WorkType,
  type ApiError,
} from '@/lib/api/work-types';
import { listTrades, type Trade } from '@/lib/api/trades';
import {
  validateWorkTypeCreate,
  REQUIRED_FIELD_TYPES,
  REQUIRED_FIELD_TYPE_LABELS,
  WORK_TYPE_PRIORITIES,
  WORK_TYPE_PRIORITY_LABELS,
} from '@/features/work-types/schemas/work-type.schema';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  mode: 'create' | 'edit';
  initial?: WorkType | null;
  /**
   * Dùng trong dialog: submit thành công gọi onSuccess thay vì tự điều hướng;
   * nút Hủy gọi onCancel (đóng dialog) thay vì push /work-types.
   */
  onSuccess?: () => void;
  onCancel?: () => void;
}

function emptyField(): RequiredField {
  return { key: '', label: '', type: 'TEXT' };
}

function toOptionsText(f: RequiredField): string {
  return (f.options ?? []).join(', ');
}

export function WorkTypeForm({ mode, initial, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState(initial?.code ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [group, setGroup] = React.useState(initial?.group ?? '');
  const [requiredTradeId, setRequiredTradeId] = React.useState(initial?.requiredTradeId ?? '');
  const [duration, setDuration] = React.useState(
    initial?.defaultDurationMinutes != null ? String(initial.defaultDurationMinutes) : '',
  );
  const [priority, setPriority] = React.useState(initial?.defaultPriority || 'NORMAL');
  const [fields, setFields] = React.useState<RequiredField[]>(
    () => initial?.requiredFields.map((f) => ({ ...f })) ?? [],
  );
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [conflict, setConflict] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listTrades({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (!cancelled) setTrades(res.data);
      } catch {
        // Select ngành nghề là hỗ trợ nhập liệu; lỗi tải không chặn form.
        if (!cancelled) setTrades([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function setRow(i: number, patch: Partial<RequiredField>) {
    setFields((prev) => prev.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  }

  function setFormError(e: unknown) {
    const err = e as ApiError;
    if (err.status === 409 && err.fieldErrors?.expectedConfigVersion) {
      setConflict(err.fieldErrors.expectedConfigVersion.join(' '));
      return;
    }
    if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
      const fe: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(err.fieldErrors)) {
        if (k === '_global') continue;
        fe[k] = v;
      }
      setFieldErrors(fe);
      if (err.fieldErrors._global?.length) setGlobalError(err.fieldErrors._global.join(' '));
      else setGlobalError(err.message);
    } else {
      if (err.status === 401) setGlobalError('Phiên hết hạn, vui lòng đăng nhập lại');
      else if (err.status === 403) setGlobalError('Không có quyền — cần ADMIN hoặc Điều phối');
      else if (err.status === 409) setGlobalError(err.message);
      else setGlobalError(err.message || 'Yêu cầu thất bại');
    }
  }

  async function save() {
    setLoading(true);
    try {
      const payload = {
        code: code.trim() || undefined,
        name: name.trim() || undefined,
        description: description.trim() || null,
        group: group.trim() || null,
        requiredTradeId: requiredTradeId || null,
        defaultDurationMinutes: duration.trim() === '' ? null : Number(duration.trim()),
        defaultPriority: priority || undefined,
        requiredFields: fields.map((f) => ({
          key: f.key.trim(),
          label: f.label.trim(),
          type: f.type,
          ...(f.type === 'SELECT'
            ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) }
            : {}),
        })),
      };
      if (mode === 'create') {
        await createWorkType({
          code: code.trim(),
          name: name.trim(),
          description: payload.description,
          group: payload.group,
          requiredTradeId: payload.requiredTradeId,
          defaultDurationMinutes: payload.defaultDurationMinutes,
          defaultPriority: payload.defaultPriority,
          requiredFields: payload.requiredFields,
        });
        setGlobalSuccess('Tạo loại công việc thành công');
        toast.success({ title: 'Tạo loại công việc thành công' });
        if (onSuccess) onSuccess();
        else setTimeout(() => router.push('/work-types'), 800);
      } else if (initial) {
        await updateWorkType(initial.id, { ...payload, expectedConfigVersion: initial.configVersion });
        setGlobalSuccess('Cập nhật loại công việc thành công');
        toast.success({ title: 'Cập nhật loại công việc thành công' });
        if (onSuccess) onSuccess();
        else setTimeout(() => router.push(`/work-types/${initial.id}`), 800);
      }
    } catch (e) {
      setFormError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setGlobalSuccess(null);
    setConflict(null);

    const validation = validateWorkTypeCreate({
      code,
      name,
      description,
      group,
      requiredTradeId,
      defaultDurationMinutes: duration,
      defaultPriority: priority,
      requiredFields: fields,
    });
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    await save();
  }

  const previewTrade = requiredTradeId
    ? (trades.find((t) => t.id === requiredTradeId) ?? null)
    : null;
  const previewTradeLabel = !requiredTradeId
    ? '—'
    : previewTrade
      ? `${previewTrade.code} — ${previewTrade.name}`
      : '—';
  const previewDuration = duration.trim() === '' ? '—' : `${duration.trim()} phút`;
  const previewPriorityLabel = WORK_TYPE_PRIORITY_LABELS[priority] ?? priority ?? '—';
  const previewStatus = mode === 'create'
    ? 'Hoạt động (mặc định khi tạo mới)'
    : initial?.status === 'ACTIVE'
      ? 'Hoạt động'
      : 'Ngừng hoạt động';

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 760 }}>
    <Card>
      {mode === 'edit' ? (
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          Đang sửa: {initial?.code ?? ''} · phiên bản cấu hình {initial?.configVersion ?? '—'}
        </p>
      ) : null}

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}
      {conflict ? (
        <Alert tone="error">
          {conflict || 'Cấu hình đã được người khác cập nhật — tải lại để lấy bản mới nhất rồi sửa tiếp.'}
          <div style={{ marginTop: '0.5rem' }}>
            <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
              Tải lại
            </Button>
          </div>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <div className="bf-form-grid">
          <div className="bf-field">
            <label className="bf-label" htmlFor="worktype-code">Mã loại công việc *</label>
            <Input
              id="worktype-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hasError={Boolean(fieldErrors.code)}
              placeholder="WT-001"
            />
            {fieldErrors.code ? <p className="bf-field-error" role="alert">{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="worktype-name">Tên loại công việc *</label>
            <Input
              id="worktype-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hasError={Boolean(fieldErrors.name)}
              placeholder="Thí dụ: Đổ bê tông cột"
            />
            {fieldErrors.name ? <p className="bf-field-error" role="alert">{fieldErrors.name.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-form-grid">
          <div className="bf-field">
            <label className="bf-label" htmlFor="worktype-group">Nhóm công việc</label>
            <Input
              id="worktype-group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              hasError={Boolean(fieldErrors.group)}
              placeholder="Thí dụ: Kết cấu"
            />
            {fieldErrors.group ? <p className="bf-field-error" role="alert">{fieldErrors.group.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="worktype-trade">Ngành nghề yêu cầu</label>
            <select
              id="worktype-trade"
              className="bf-input"
              value={requiredTradeId}
              onChange={(e) => setRequiredTradeId(e.target.value)}
              aria-invalid={Boolean(fieldErrors.requiredTradeId)}
            >
              <option value="">Không yêu cầu ngành nghề cụ thể</option>
              {initial?.requiredTradeId && !trades.some((t) => t.id === initial.requiredTradeId) ? (
                <option value={initial.requiredTradeId}>
                  Đang dùng (ngừng hoạt động) — giữ nguyên hoặc chọn mới
                </option>
              ) : null}
              {trades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
            {fieldErrors.requiredTradeId ? (
              <p className="bf-field-error" role="alert">{fieldErrors.requiredTradeId.join(' ')}</p>
            ) : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="worktype-description">Mô tả</label>
          <textarea
            id="worktype-description"
            className="bf-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={fieldErrors.description ? { borderColor: 'var(--bf-risk)' } : undefined}
            placeholder="Mô tả ngắn về loại công việc (tối đa 500 ký tự)"
          />
          {fieldErrors.description ? <p className="bf-field-error" role="alert">{fieldErrors.description.join(' ')}</p> : null}
        </div>

        <div className="bf-form-grid">
          <div className="bf-field">
            <label className="bf-label" htmlFor="worktype-duration">Thời lượng mặc định (phút)</label>
            <Input
              id="worktype-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              hasError={Boolean(fieldErrors.defaultDurationMinutes)}
              placeholder="Thí dụ: 120"
              inputMode="numeric"
            />
            {fieldErrors.defaultDurationMinutes ? (
              <p className="bf-field-error" role="alert">{fieldErrors.defaultDurationMinutes.join(' ')}</p>
            ) : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="worktype-priority">Ưu tiên mặc định</label>
            <select
              id="worktype-priority"
              className="bf-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-invalid={Boolean(fieldErrors.defaultPriority)}
            >
              {WORK_TYPE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {WORK_TYPE_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            {fieldErrors.defaultPriority ? (
              <p className="bf-field-error" role="alert">{fieldErrors.defaultPriority.join(' ')}</p>
            ) : null}
          </div>
        </div>

        <fieldset style={{ border: '1px solid var(--bf-line, #e5e7eb)', borderRadius: 8, padding: '0.75rem' }}>
          <legend style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.4rem' }}>
            Dữ liệu bắt buộc khi nghiệm thu ({fields.length})
          </legend>
          {fieldErrors.requiredFields ? (
            <p className="bf-field-error" role="alert" style={{ marginTop: 0 }}>
              {fieldErrors.requiredFields.join(' ')}
            </p>
          ) : null}
          {fields.length === 0 ? (
            <p className="bf-card-meta" style={{ margin: 0 }}>
              Chưa có trường dữ liệu nào. Thêm trường để yêu cầu công nhân nhập khi nghiệm thu
              (thí dụ: ảnh hiện trường, mác bê tông).
            </p>
          ) : null}
          <div style={{ display: 'grid', gap: '0.6rem', marginTop: fields.length ? '0.6rem' : 0 }}>
            {fields.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 9rem auto',
                  gap: '0.5rem',
                  alignItems: 'start',
                }}
              >
                <Input
                  id={`worktype-field-key-${i}`}
                  aria-label={`Dòng ${i + 1}: key`}
                  value={f.key}
                  onChange={(e) => setRow(i, { key: e.target.value })}
                  placeholder="key (vd: photos)"
                />
                <Input
                  id={`worktype-field-label-${i}`}
                  aria-label={`Dòng ${i + 1}: nhãn hiển thị`}
                  value={f.label}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  placeholder="Nhãn (vd: Ảnh hiện trường)"
                />
                <select
                  id={`worktype-field-type-${i}`}
                  aria-label={`Dòng ${i + 1}: kiểu dữ liệu`}
                  className="bf-input"
                  value={f.type}
                  onChange={(e) => setRow(i, { type: e.target.value })}
                >
                  {REQUIRED_FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {REQUIRED_FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="ghost" size="sm" onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}>
                  Xóa
                </Button>
                {f.type === 'SELECT' ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <Input
                      id={`worktype-field-options-${i}`}
                      aria-label={`Dòng ${i + 1}: các lựa chọn, cách nhau bằng dấu phẩy`}
                      value={toOptionsText(f)}
                      onChange={(e) =>
                        setRow(i, { options: e.target.value.split(',').map((o) => o.trim()) })
                      }
                      placeholder="Các lựa chọn, cách nhau bằng dấu phẩy (vd: M200, M250)"
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.6rem' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setFields((prev) => [...prev, emptyField()])}>
              Thêm trường dữ liệu
            </Button>
          </div>
        </fieldset>

        <div className="bf-form-actions">
          <Button type="button" variant="ghost" onClick={() => router.refresh()} disabled={loading}>Tải lại</Button>
          <Button type="button" variant="secondary" onClick={() => (onCancel ? onCancel() : router.push('/work-types'))}>Hủy</Button>
          <Button type="submit" loading={loading} aria-busy={loading}>
            {mode === 'create' ? 'Tạo loại công việc' : 'Lưu thay đổi'}
          </Button>
        </div>

        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
          Trường có dấu * là bắt buộc. Chỉ đổi mã/tên/nhóm/ngành nghề/dữ liệu
          bắt buộc mới tăng phiên bản cấu hình; đổi mô tả/thời lượng/ưu tiên thì không.
          Nếu mã đã tồn tại, hệ thống báo trùng và không tạo bản ghi.
        </p>
      </form>
    </Card>

    <Card>
      <div className="bf-card-head">
        <span className="bf-card-title">Xem trước cấu hình</span>
      </div>
      <p className="bf-card-meta" style={{ marginTop: 0 }}>
        Tóm tắt trực tiếp theo nội dung đang nhập — kiểm tra lại trước khi lưu.
      </p>
      <dl className="bf-def-grid" aria-live="polite">
        <div>
          <dt>Mã / Tên</dt>
          <dd>{[code.trim() || '—', name.trim() || '—'].join(' — ')}</dd>
        </div>
        <div>
          <dt>Nhóm công việc</dt>
          <dd>{group.trim() || '—'}</dd>
        </div>
        <div>
          <dt>Ngành nghề yêu cầu</dt>
          <dd>{previewTradeLabel}</dd>
        </div>
        <div>
          <dt>Thời lượng mặc định</dt>
          <dd>{previewDuration}</dd>
        </div>
        <div>
          <dt>Ưu tiên mặc định</dt>
          <dd>{previewPriorityLabel}</dd>
        </div>
        <div>
          <dt>Trạng thái</dt>
          <dd>{previewStatus}</dd>
        </div>
        <div>
          <dt>Dữ liệu bắt buộc ({fields.length})</dt>
          <dd>
            {fields.length === 0 ? (
              'Chưa có trường dữ liệu nào'
            ) : (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {fields.map((f, i) => (
                  <span key={i} className="bf-chip">
                    {(f.label.trim() || f.key.trim() || `Trường ${i + 1}`)}
                    {' · '}
                    {REQUIRED_FIELD_TYPE_LABELS[f.type] ?? f.type}
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
    </div>
  );
}
