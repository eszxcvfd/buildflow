'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createProject, updateProject, type Project, type UpdateProjectPayload } from '@/lib/api/projects';
import type { ApiError } from '@/lib/api/projects';
import { listWorkers, type Worker } from '@/lib/api/workers';
import { validateProjectCreate, validateProjectUpdate } from '@/features/projects/schemas/project.schema';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';

interface Props {
  mode: 'create' | 'edit';
  initial?: Project | null;
}

const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Europe/London',
  'America/New_York',
];

function workerLabel(w: Worker): string {
  return `${w.fullName} · ${w.employeeCode ?? w.id.slice(0, 8)}`;
}

/**
 * PRJ-SRS-001 (issue #32) — form tạo/sửa hồ sơ dự án.
 * Code chỉ nhập khi tạo (edit disable + hint 'Mã dự án không thể đổi',
 * PATCH không bao giờ mang `code`/`status`). Quản lý dự án chọn từ worker
 * ACTIVE (listWorkers limit 100 + lọc text phía client — manager pool slice
 * này = worker profiles). Edit prefill qua GET summary (code/name/managerId;
 * address/dates/description/timezone bắt đầu trống vì reads iam-owned chỉ trả
 * summary — PATCH diff nên field trống không đổi không được gửi).
 */
export function ProjectForm({ mode, initial }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState(initial?.code ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [address, setAddress] = React.useState('');
  const [plannedStartDate, setPlannedStartDate] = React.useState('');
  const [plannedEndDate, setPlannedEndDate] = React.useState('');
  const [managerId, setManagerId] = React.useState(initial?.managerId ?? '');
  const [managerSearch, setManagerSearch] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [timezone, setTimezone] = React.useState(mode === 'create' ? 'Asia/Ho_Chi_Minh' : '');
  const [managers, setManagers] = React.useState<Worker[]>([]);
  const [managersLoading, setManagersLoading] = React.useState(true);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Nạp pool quản lý: worker ACTIVE (limit 100 cho selector).
  React.useEffect(() => {
    let cancelled = false;
    async function loadManagers() {
      setManagersLoading(true);
      try {
        const res = await listWorkers({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (!cancelled) setManagers(res.data);
      } catch {
        if (!cancelled) setManagers([]);
      } finally {
        if (!cancelled) setManagersLoading(false);
      }
    }
    void loadManagers();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredManagers = React.useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return managers;
    return managers.filter(
      (w) =>
        w.fullName.toLowerCase().includes(q) ||
        (w.employeeCode ?? '').toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q),
    );
  }, [managers, managerSearch]);

  const initialManagerInList = initial?.managerId
    ? managers.some((w) => w.id === initial.managerId)
    : true;

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
      else if (Object.keys(fe).length === 0) setGlobalError(err.message);
      else setGlobalError(err.message);
    } else {
      if (err.status === 401) setGlobalError('Phiên hết hạn, vui lòng đăng nhập lại');
      else if (err.status === 403) setGlobalError('Cần ADMIN hoặc PROJECT_MANAGER');
      else if (err.status === 409) {
        // 409 trùng mã không kèm fieldErrors (defensive) → map về field code.
        setFieldErrors({ code: [err.message] });
        setGlobalError(err.message);
      } else setGlobalError(err.message || 'Yêu cầu thất bại');
    }
  }

  /** Edit: chỉ gửi field khác initial (code không bao giờ gửi). */
  function buildUpdatePayload(): UpdateProjectPayload {
    const payload: UpdateProjectPayload = {};
    if (name.trim() !== (initial?.name ?? '')) payload.name = name.trim();
    if (address.trim()) payload.address = address.trim();
    if (plannedStartDate) payload.plannedStartDate = plannedStartDate;
    if (plannedEndDate) payload.plannedEndDate = plannedEndDate;
    if (managerId && managerId !== (initial?.managerId ?? '')) payload.managerId = managerId;
    if (description.trim()) payload.description = description.trim();
    if (timezone.trim()) payload.timezone = timezone.trim();
    return payload;
  }

  async function save() {
    setLoading(true);
    try {
      if (mode === 'create') {
        await createProject({
          code: code.trim(),
          name: name.trim(),
          address: address.trim(),
          plannedStartDate,
          plannedEndDate,
          managerId,
          description: description.trim() || null,
          timezone: timezone.trim() || null,
        });
        setGlobalSuccess('Tạo dự án thành công');
        setTimeout(() => router.push('/projects'), 800);
      } else if (initial) {
        await updateProject(initial.id, buildUpdatePayload());
        setGlobalSuccess('Cập nhật dự án thành công');
        setTimeout(() => router.push(`/projects/${initial.id}`), 800);
      }
    } catch (e) {
      setFormError(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setGlobalError(null);
    setGlobalSuccess(null);
    if (mode === 'create') {
      const validation = validateProjectCreate({
        code,
        name,
        address,
        plannedStartDate,
        plannedEndDate,
        managerId,
        description,
        timezone,
      });
      if (!validation.valid) {
        setFieldErrors(validation.fieldErrors);
        return;
      }
    } else {
      const payload = buildUpdatePayload();
      const validation = validateProjectUpdate({
        name: payload.name,
        address: payload.address,
        plannedStartDate: payload.plannedStartDate,
        plannedEndDate: payload.plannedEndDate,
        managerId: payload.managerId,
        description: payload.description ?? undefined,
        timezone: payload.timezone,
      });
      if (!validation.valid) {
        setFieldErrors(validation.fieldErrors);
        return;
      }
      if (Object.keys(payload).length === 0) {
        setGlobalError('Chưa thay đổi thông tin nào');
        return;
      }
    }
    setFieldErrors({});
    await save();
  }

  return (
    <Card style={{ maxWidth: 720 }}>
      {mode === 'edit' ? (
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          Đang sửa: {initial?.code ?? ''} · Mã dự án không thể đổi
        </p>
      ) : null}

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="project-code">Mã dự án *</label>
            <Input
              id="project-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hasError={Boolean(fieldErrors.code)}
              placeholder="PRJ-001"
              disabled={mode === 'edit'}
            />
            {mode === 'edit' ? (
              <p style={{ color: 'var(--bf-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Mã dự án không thể đổi sau khi tạo.
              </p>
            ) : null}
            {fieldErrors.code ? <p className="bf-field-error" role="alert">{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="project-name">Tên dự án *</label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hasError={Boolean(fieldErrors.name)}
              placeholder="Khu dân cư Bình Minh"
            />
            {fieldErrors.name ? <p className="bf-field-error" role="alert">{fieldErrors.name.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="project-address">Địa chỉ *</label>
          <Input
            id="project-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            hasError={Boolean(fieldErrors.address)}
            placeholder="Số 1, đường …"
          />
          {mode === 'edit' ? (
            <p style={{ color: 'var(--bf-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              Để trống để giữ địa chỉ hiện tại.
            </p>
          ) : null}
          {fieldErrors.address ? <p className="bf-field-error" role="alert">{fieldErrors.address.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="project-start">Ngày bắt đầu kế hoạch *</label>
            <Input
              id="project-start"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              hasError={Boolean(fieldErrors.plannedStartDate)}
            />
            {fieldErrors.plannedStartDate ? <p className="bf-field-error" role="alert">{fieldErrors.plannedStartDate.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="project-end">Ngày kết thúc kế hoạch *</label>
            <Input
              id="project-end"
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
              hasError={Boolean(fieldErrors.plannedEndDate)}
              min={plannedStartDate || undefined}
            />
            {fieldErrors.plannedEndDate ? <p className="bf-field-error" role="alert">{fieldErrors.plannedEndDate.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="project-timezone">Múi giờ</label>
          <select
            id="project-timezone"
            className="bf-input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            aria-invalid={fieldErrors.timezone ? true : undefined}
          >
            {mode === 'edit' ? <option value="">— Giữ nguyên —</option> : null}
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {fieldErrors.timezone ? <p className="bf-field-error" role="alert">{fieldErrors.timezone.join(' ')}</p> : null}
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="project-manager-search">Tìm quản lý dự án</label>
          <Input
            id="project-manager-search"
            value={managerSearch}
            onChange={(e) => setManagerSearch(e.target.value)}
            placeholder="Nhập tên hoặc mã NV để lọc…"
          />
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="project-manager">Quản lý dự án *</label>
          {managersLoading ? (
            <p style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }} aria-busy="true">
              Đang tải danh sách công nhân đang hoạt động…
            </p>
          ) : (
            <select
              id="project-manager"
              className="bf-input"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              aria-invalid={fieldErrors.managerId ? true : undefined}
            >
              <option value="">— Chọn quản lý dự án (hồ sơ công nhân ACTIVE) —</option>
              {initial?.managerId && !initialManagerInList ? (
                <option value={initial.managerId}>
                  {`${initial.managerId.slice(0, 8)}… — ngoài danh sách công nhân ACTIVE`}
                </option>
              ) : null}
              {filteredManagers.map((w) => (
                <option key={w.id} value={w.id}>
                  {workerLabel(w)}
                </option>
              ))}
            </select>
          )}
          <p style={{ color: 'var(--bf-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
            Slice này chọn quản lý từ hồ sơ công nhân đang hoạt động.
          </p>
          {fieldErrors.managerId ? <p className="bf-field-error" role="alert">{fieldErrors.managerId.join(' ')}</p> : null}
          {mode === 'edit' && initial?.managerId && !initialManagerInList && !managersLoading ? (
            <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Quản lý hiện tại không còn trong danh sách công nhân hoạt động — giữ nguyên
              nếu không đổi.
            </p>
          ) : null}
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="project-description">Mô tả</label>
          <textarea
            id="project-description"
            className="bf-input"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={fieldErrors.description ? true : undefined}
            placeholder="Phạm vi, quy mô, ghi chú của dự án…"
          />
          {fieldErrors.description ? <p className="bf-field-error" role="alert">{fieldErrors.description.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button type="submit" loading={loading} aria-busy={loading}>
            {mode === 'create' ? 'Tạo dự án' : 'Lưu thay đổi'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Hủy
          </Button>
        </div>
      </form>
    </Card>
  );
}
