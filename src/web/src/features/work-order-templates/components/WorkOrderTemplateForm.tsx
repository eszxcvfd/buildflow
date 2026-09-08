'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  createWorkOrderTemplate,
  updateWorkOrderTemplate,
  type RequiredSkill,
  type ChecklistSnapshotItem,
  type WorkOrderTemplate,
  type ApiError,
} from '@/lib/api/work-order-templates';
import { listActiveWorkTypes, type WorkType } from '@/lib/api/work-types';
import { listTrades, type Trade } from '@/lib/api/trades';
import {
  validateWorkOrderTemplateCreate,
  CHECKLIST_ANSWER_TYPES,
  CHECKLIST_ANSWER_TYPE_LABELS,
  WORK_ORDER_TEMPLATE_PRIORITIES,
  WORK_ORDER_TEMPLATE_PRIORITY_LABELS,
} from '@/features/work-order-templates/schemas/work-order-template.schema';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  mode: 'create' | 'edit';
  initial?: WorkOrderTemplate | null;
  /**
   * Dùng trong dialog: submit thành công gọi onSuccess thay vì tự điều hướng;
   * nút Hủy gọi onCancel (đóng dialog) thay vì push /work-order-templates.
   */
  onSuccess?: () => void;
  onCancel?: () => void;
}

function emptySkill(): RequiredSkill {
  return { code: '', label: '' };
}

function emptyChecklistItem(sequenceNo: number): ChecklistSnapshotItem {
  return { title: '', answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: false, sequenceNo };
}

export function WorkOrderTemplateForm({ mode, initial, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState(initial?.code ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [workTypeId, setWorkTypeId] = React.useState(initial?.workTypeId ?? '');
  const [requiredTradeId, setRequiredTradeId] = React.useState(initial?.requiredTradeId ?? '');
  const [duration, setDuration] = React.useState(
    initial?.defaultDurationMinutes != null ? String(initial.defaultDurationMinutes) : '',
  );
  const [priority, setPriority] = React.useState(initial?.defaultPriority || 'NORMAL');
  const [skills, setSkills] = React.useState<RequiredSkill[]>(
    () => initial?.requiredSkills.map((s) => ({ ...s })) ?? [],
  );
  const [checklist, setChecklist] = React.useState<ChecklistSnapshotItem[]>(
    () => initial?.checklistSnapshot.map((c) => ({ ...c })) ?? [],
  );
  const [workTypes, setWorkTypes] = React.useState<WorkType[]>([]);
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
    return () => { cancelled = true; };
  }, []);

  function setSkillRow(i: number, patch: Partial<RequiredSkill>) {
    setSkills((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function setChecklistRow(i: number, patch: Partial<ChecklistSnapshotItem>) {
    setChecklist((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  function moveChecklistRow(i: number, dir: -1 | 1) {
    setChecklist((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [row] = next.splice(i, 1);
      next.splice(j, 0, row);
      return next.map((c, k) => ({ ...c, sequenceNo: k + 1 }));
    });
  }

  function setFormError(e: unknown) {
    const err = e as ApiError;
    if (err.status === 409 && err.fieldErrors?.expectedVersion) {
      setConflict(err.fieldErrors.expectedVersion.join(' '));
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
        workTypeId: workTypeId || null,
        requiredTradeId: requiredTradeId || null,
        defaultDurationMinutes: duration.trim() === '' ? null : Number(duration.trim()),
        defaultPriority: priority || undefined,
        requiredSkills: skills.map((s) => ({ code: s.code.trim(), label: s.label.trim() })),
        checklistSnapshot: checklist.map((c, k) => ({
          title: c.title.trim(),
          answerType: c.answerType,
          isRequired: c.isRequired,
          isBlocking: c.isBlocking,
          requiresPhoto: c.requiresPhoto ?? false,
          sequenceNo: k + 1,
        })),
      };
      if (mode === 'create') {
        await createWorkOrderTemplate({
          code: code.trim(),
          name: name.trim(),
          description: payload.description,
          workTypeId: payload.workTypeId,
          requiredTradeId: payload.requiredTradeId,
          defaultDurationMinutes: payload.defaultDurationMinutes,
          defaultPriority: payload.defaultPriority,
          requiredSkills: payload.requiredSkills,
          checklistSnapshot: payload.checklistSnapshot,
        });
        setGlobalSuccess('Tạo mẫu công việc thành công');
        toast.success({ title: 'Tạo mẫu công việc thành công' });
        if (onSuccess) onSuccess();
        else setTimeout(() => router.push('/work-order-templates'), 800);
      } else if (initial) {
        await updateWorkOrderTemplate(initial.id, { ...payload, expectedVersion: initial.version });
        setGlobalSuccess('Cập nhật mẫu công việc thành công');
        toast.success({ title: 'Cập nhật mẫu công việc thành công' });
        if (onSuccess) onSuccess();
        else setTimeout(() => router.push(`/work-order-templates/${initial.id}`), 800);
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

    const validation = validateWorkOrderTemplateCreate({
      code,
      name,
      description,
      workTypeId,
      requiredTradeId,
      defaultDurationMinutes: duration,
      defaultPriority: priority,
      requiredSkills: skills,
      checklistSnapshot: checklist,
    });
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    await save();
  }

  const previewWorkType = workTypeId ? (workTypes.find((w) => w.id === workTypeId) ?? null) : null;
  const previewTrade = requiredTradeId ? (trades.find((t) => t.id === requiredTradeId) ?? null) : null;
  const previewDuration = duration.trim() === '' ? '—' : `${duration.trim()} phút`;
  const previewPriorityLabel = WORK_ORDER_TEMPLATE_PRIORITY_LABELS[priority] ?? priority ?? '—';
  const previewStatus = mode === 'create'
    ? 'Nháp (mặc định khi tạo mới)'
    : initial?.status === 'DRAFT'
      ? 'Nháp'
      : initial?.status === 'ACTIVE'
        ? 'Hoạt động'
        : 'Ngừng hoạt động';

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 760 }}>
    <Card>
      {mode === 'edit' ? (
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          Đang sửa: {initial?.code ?? ''} · phiên bản {initial?.version ?? '—'}
        </p>
      ) : null}

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}
      {conflict ? (
        <Alert tone="error">
          {conflict || 'Mẫu đã được người khác cập nhật — tải lại để lấy bản mới nhất rồi sửa tiếp.'}
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
            <label className="bf-label" htmlFor="wot-code">Mã mẫu công việc *</label>
            <Input
              id="wot-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hasError={Boolean(fieldErrors.code)}
              placeholder="WOT-001"
            />
            {fieldErrors.code ? <p className="bf-field-error" role="alert">{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="wot-name">Tên mẫu công việc *</label>
            <Input
              id="wot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hasError={Boolean(fieldErrors.name)}
              placeholder="Thí dụ: Đổ bê tông cột chuẩn"
            />
            {fieldErrors.name ? <p className="bf-field-error" role="alert">{fieldErrors.name.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-form-grid">
          <div className="bf-field">
            <label className="bf-label" htmlFor="wot-worktype">Loại công việc</label>
            <select
              id="wot-worktype"
              className="bf-input"
              value={workTypeId}
              onChange={(e) => setWorkTypeId(e.target.value)}
              aria-invalid={Boolean(fieldErrors.workTypeId)}
            >
              <option value="">Không gắn loại công việc cụ thể</option>
              {initial?.workTypeId && !workTypes.some((w) => w.id === initial.workTypeId) ? (
                <option value={initial.workTypeId}>
                  Đang dùng (ngừng hoạt động) — giữ nguyên hoặc chọn mới
                </option>
              ) : null}
              {workTypes.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
            {fieldErrors.workTypeId ? (
              <p className="bf-field-error" role="alert">{fieldErrors.workTypeId.join(' ')}</p>
            ) : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="wot-trade">Ngành nghề yêu cầu</label>
            <select
              id="wot-trade"
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
          <label className="bf-label" htmlFor="wot-description">Mô tả</label>
          <textarea
            id="wot-description"
            className="bf-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={fieldErrors.description ? { borderColor: 'var(--bf-risk)' } : undefined}
            placeholder="Mô tả ngắn về mẫu công việc (tối đa 500 ký tự)"
          />
          {fieldErrors.description ? <p className="bf-field-error" role="alert">{fieldErrors.description.join(' ')}</p> : null}
        </div>

        <div className="bf-form-grid">
          <div className="bf-field">
            <label className="bf-label" htmlFor="wot-duration">Thời lượng mặc định (phút)</label>
            <Input
              id="wot-duration"
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
            <label className="bf-label" htmlFor="wot-priority">Ưu tiên mặc định</label>
            <select
              id="wot-priority"
              className="bf-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-invalid={Boolean(fieldErrors.defaultPriority)}
            >
              {WORK_ORDER_TEMPLATE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {WORK_ORDER_TEMPLATE_PRIORITY_LABELS[p]}
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
            Kỹ năng yêu cầu ({skills.length})
          </legend>
          {fieldErrors.requiredSkills ? (
            <p className="bf-field-error" role="alert" style={{ marginTop: 0 }}>
              {fieldErrors.requiredSkills.join(' ')}
            </p>
          ) : null}
          {skills.length === 0 ? (
            <p className="bf-card-meta" style={{ margin: 0 }}>
              Chưa có kỹ năng nào. Code kỹ năng phải là mã ngành nghề đang hoạt động
              (thí dụ: code của “Thợ xây”).
            </p>
          ) : null}
          <div style={{ display: 'grid', gap: '0.6rem', marginTop: skills.length ? '0.6rem' : 0 }}>
            {skills.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto',
                  gap: '0.5rem',
                  alignItems: 'start',
                }}
              >
                <Input
                  id={`wot-skill-code-${i}`}
                  aria-label={`Kỹ năng ${i + 1}: code`}
                  value={s.code}
                  onChange={(e) => setSkillRow(i, { code: e.target.value })}
                  placeholder="code (vd: THO-XAY)"
                />
                <Input
                  id={`wot-skill-label-${i}`}
                  aria-label={`Kỹ năng ${i + 1}: nhãn hiển thị`}
                  value={s.label}
                  onChange={(e) => setSkillRow(i, { label: e.target.value })}
                  placeholder="Nhãn (vd: Thợ xây bậc 3)"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setSkills((prev) => prev.filter((_, j) => j !== i))}>
                  Xóa
                </Button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.6rem' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSkills((prev) => [...prev, emptySkill()])}>
              Thêm kỹ năng
            </Button>
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid var(--bf-line, #e5e7eb)', borderRadius: 8, padding: '0.75rem' }}>
          <legend style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0 0.4rem' }}>
            Checklist mẫu ({checklist.length})
          </legend>
          {fieldErrors.checklistSnapshot ? (
            <p className="bf-field-error" role="alert" style={{ marginTop: 0 }}>
              {fieldErrors.checklistSnapshot.join(' ')}
            </p>
          ) : null}
          {checklist.length === 0 ? (
            <p className="bf-card-meta" style={{ margin: 0 }}>
              Chưa có mục checklist nào. Lưu ý: mẫu không có kỹ năng lẫn checklist
              sẽ không kích hoạt được (publish guard).
            </p>
          ) : null}
          <div style={{ display: 'grid', gap: '0.6rem', marginTop: checklist.length ? '0.6rem' : 0 }}>
            {checklist.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2rem 1fr 9rem',
                  gap: '0.5rem',
                  alignItems: 'start',
                  border: '1px dashed var(--bf-line, #e5e7eb)',
                  borderRadius: 6,
                  padding: '0.5rem',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ fontWeight: 700, color: 'var(--bf-muted)', paddingTop: '0.55rem', textAlign: 'center' }}
                >
                  {i + 1}
                </span>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <Input
                    id={`wot-checklist-title-${i}`}
                    aria-label={`Checklist mục ${i + 1}: tiêu đề`}
                    value={c.title}
                    onChange={(e) => setChecklistRow(i, { title: e.target.value })}
                    placeholder="Tiêu đề mục (vd: Kiểm tra cốp pha)"
                  />
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={c.isRequired}
                        onChange={(e) => setChecklistRow(i, { isRequired: e.target.checked })}
                        aria-label={`Checklist mục ${i + 1}: bắt buộc`}
                      />
                      Bắt buộc
                    </label>
                    <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={c.isBlocking}
                        onChange={(e) => setChecklistRow(i, { isBlocking: e.target.checked })}
                        aria-label={`Checklist mục ${i + 1}: chặn nghiệm thu`}
                      />
                      Chặn nghiệm thu
                    </label>
                    <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={c.requiresPhoto ?? false}
                        onChange={(e) => setChecklistRow(i, { requiresPhoto: e.target.checked })}
                        aria-label={`Checklist mục ${i + 1}: yêu cầu ảnh`}
                      />
                      Yêu cầu ảnh
                    </label>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  <select
                    id={`wot-checklist-type-${i}`}
                    aria-label={`Checklist mục ${i + 1}: kiểu trả lời`}
                    className="bf-input"
                    value={c.answerType}
                    onChange={(e) => setChecklistRow(i, { answerType: e.target.value })}
                  >
                    {CHECKLIST_ANSWER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CHECKLIST_ANSWER_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => moveChecklistRow(i, -1)} aria-label={`Đưa mục ${i + 1} lên trên`}>
                      ↑
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={i === checklist.length - 1} onClick={() => moveChecklistRow(i, 1)} aria-label={`Đưa mục ${i + 1} xuống dưới`}>
                      ↓
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setChecklist((prev) => prev.filter((_, j) => j !== i).map((row, k) => ({ ...row, sequenceNo: k + 1 })))}>
                      Xóa
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.6rem' }}>
            <Button type="button" variant="secondary" size="sm" onClick={() => setChecklist((prev) => [...prev, emptyChecklistItem(prev.length + 1)])}>
              Thêm mục checklist
            </Button>
          </div>
        </fieldset>

        <div className="bf-form-actions">
          <Button type="button" variant="ghost" onClick={() => router.refresh()} disabled={loading}>Tải lại</Button>
          <Button type="button" variant="secondary" onClick={() => (onCancel ? onCancel() : router.push('/work-order-templates'))}>Hủy</Button>
          <Button type="submit" loading={loading} aria-busy={loading}>
            {mode === 'create' ? 'Tạo mẫu công việc' : 'Lưu thay đổi'}
          </Button>
        </div>

        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
          Trường có dấu * là bắt buộc. Đổi nội dung nghiệp vụ (mã/tên/mô tả/loại/ngành
          nghề/thời lượng/ưu tiên/kỹ năng/checklist) tăng phiên bản mẫu; nếu mã đã tồn
          tại, hệ thống báo trùng và không tạo bản ghi.
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
          <dt>Loại công việc</dt>
          <dd>
            {!workTypeId
              ? '—'
              : previewWorkType
                ? `${previewWorkType.code} — ${previewWorkType.name}`
                : '—'}
          </dd>
        </div>
        <div>
          <dt>Ngành nghề yêu cầu</dt>
          <dd>
            {!requiredTradeId
              ? '—'
              : previewTrade
                ? `${previewTrade.code} — ${previewTrade.name}`
                : '—'}
          </dd>
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
          <dt>Kỹ năng yêu cầu ({skills.length})</dt>
          <dd>
            {skills.length === 0 ? (
              'Chưa có kỹ năng nào'
            ) : (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {skills.map((s, i) => (
                  <span key={i} className="bf-chip">
                    {s.label.trim() || s.code.trim() || `Kỹ năng ${i + 1}`}
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Checklist mẫu ({checklist.length})</dt>
          <dd>
            {checklist.length === 0 ? (
              'Chưa có mục checklist nào'
            ) : (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {checklist.map((c, i) => (
                  <span key={i} className="bf-chip">
                    {`${i + 1}. ${c.title.trim() || `Mục ${i + 1}`} · ${CHECKLIST_ANSWER_TYPE_LABELS[c.answerType] ?? c.answerType}`}
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
