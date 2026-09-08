'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createCrew, updateCrew, type Crew, type UpdateCrewPayload } from '@/lib/api/crews';
import type { ApiError } from '@/lib/api/crews';
import { listWorkers, type Worker } from '@/lib/api/workers';
import { listContractors, type Contractor } from '@/lib/api/contractors';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { Select } from '@/components/ui/select/Select';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  mode: 'create' | 'edit';
  initial?: Crew | null;
  /**
   * Dùng trong dialog (vd: CrewCreateDialog trên /crews): submit thành công
   * gọi onSuccess thay vì tự điều hướng; nút Hủy gọi onCancel (đóng dialog)
   * thay vì router.back(). Route standalone (/crews/new) giữ hành vi cũ khi
   * omit cả hai.
   */
  onSuccess?: () => void;
  onCancel?: () => void;
}

function workerLabel(w: Worker): string {
  return `${w.fullName} · ${w.employeeCode ?? w.id.slice(0, 8)}`;
}

/**
 * ORG-SRS-006 (issue #29) — form tạo/sửa đội thi công.
 * Code chỉ nhập khi tạo (edit không đổi code). Trưởng nhóm chọn từ worker
 * ACTIVE (listWorkers limit 100 + lọc text phía client); edit giữ leader hiện
 * tại làm default (kể cả khi leader đã INACTIVE — hiển thị cảnh báo giữ nguyên
 * trừ khi thật sự đổi). Đổi leader ở edit cần xác nhận nhẹ (confirm inline).
 * Nhà thầu chọn optional từ contractors ACTIVE.
 */
export function CrewForm({ mode, initial, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState(initial?.code ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [leaderUserId, setLeaderUserId] = React.useState(initial?.leaderUserId ?? '');
  const [leaderSearch, setLeaderSearch] = React.useState('');
  const [contractorId, setContractorId] = React.useState(initial?.contractorId ?? '');
  const [leaders, setLeaders] = React.useState<Worker[]>([]);
  const [leadersLoading, setLeadersLoading] = React.useState(true);
  const [contractors, setContractors] = React.useState<Contractor[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirmLeadChange, setConfirmLeadChange] = React.useState(false);

  // Nạp ứng viên trưởng nhóm: worker ACTIVE (limit 100 cho selector).
  React.useEffect(() => {
    let cancelled = false;
    async function loadLeaders() {
      setLeadersLoading(true);
      try {
        const res = await listWorkers({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (!cancelled) setLeaders(res.data);
      } catch {
        if (!cancelled) setLeaders([]);
      } finally {
        if (!cancelled) setLeadersLoading(false);
      }
    }
    void loadLeaders();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nạp nhà thầu ACTIVE cho select optional.
  React.useEffect(() => {
    let cancelled = false;
    async function loadContractors() {
      try {
        const res = await listContractors({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (!cancelled) setContractors(res.data);
      } catch {
        if (!cancelled) setContractors([]);
      }
    }
    void loadContractors();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLeaders = React.useMemo(() => {
    const q = leaderSearch.trim().toLowerCase();
    if (!q) return leaders;
    return leaders.filter(
      (w) =>
        w.fullName.toLowerCase().includes(q) ||
        (w.employeeCode ?? '').toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q),
    );
  }, [leaders, leaderSearch]);

  const initialLeaderInList = initial?.leaderUserId
    ? leaders.some((w) => w.id === initial.leaderUserId)
    : true;
  const leadChanged = mode === 'edit' && initial?.leaderUserId && leaderUserId !== initial.leaderUserId;

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
      else if (err.status === 403) setGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER');
      else if (err.status === 409) setGlobalError(err.message);
      else setGlobalError(err.message || 'Yêu cầu thất bại');
    }
  }

  function validateLocal(): boolean {
    const fe: Record<string, string[]> = {};
    if (mode === 'create' && !code.trim()) fe.code = ['Mã đội là bắt buộc'];
    if (!name.trim()) fe.name = ['Tên đội là bắt buộc'];
    if (!leaderUserId) fe.leaderUserId = ['Trưởng nhóm là bắt buộc — chọn một công nhân đang hoạt động'];
    if (description.trim().length > 500) fe.description = ['Mô tả tối đa 500 ký tự'];
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  }

  function buildUpdatePayload(): UpdateCrewPayload {
    const payload: UpdateCrewPayload = {};
    if (name.trim() !== (initial?.name ?? '')) payload.name = name.trim();
    const desc = description.trim() || null;
    if (desc !== (initial?.description ?? null)) payload.description = desc;
    if (leaderUserId && leaderUserId !== (initial?.leaderUserId ?? '')) payload.leaderUserId = leaderUserId;
    const ctr = contractorId || null;
    if (ctr !== (initial?.contractorId ?? null)) payload.contractorId = ctr;
    return payload;
  }

  async function save() {
    setLoading(true);
    try {
      if (mode === 'create') {
        await createCrew({
          code: code.trim(),
          name: name.trim(),
          leaderUserId,
          contractorId: contractorId || null,
          description: description.trim() || null,
        });
        setGlobalSuccess('Tạo đội thi công thành công');
        toast.success({ title: 'Tạo đội thi công thành công' });
        if (onSuccess) onSuccess();
        else setTimeout(() => router.push('/crews'), 800);
      } else if (initial) {
        await updateCrew(initial.id, buildUpdatePayload());
        setGlobalSuccess('Cập nhật đội thi công thành công');
        toast.success({ title: 'Cập nhật đội thi công thành công' });
        setTimeout(() => router.push(`/crews/${initial.id}`), 800);
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
    if (!validateLocal()) return;
    // Edit đổi trưởng nhóm → xác nhận nhẹ trước khi gửi (lead swap ghi audit riêng).
    if (leadChanged && !confirmLeadChange) {
      setConfirmLeadChange(true);
      return;
    }
    setFieldErrors({});
    await save();
  }

  return (
    <Card style={{ maxWidth: 720 }}>
      {mode === 'edit' ? (
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          Đang sửa: {initial?.code ?? ''} · mã đội không thay đổi sau khi tạo
        </p>
      ) : null}

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <div className="bf-form-grid">
          <div className="bf-field">
            <label className="bf-label" htmlFor="crew-code">Mã đội *</label>
            <Input
              id="crew-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              hasError={Boolean(fieldErrors.code)}
              placeholder="TEAM-001"
              disabled={mode === 'edit'}
            />
            {fieldErrors.code ? <p className="bf-field-error" role="alert">{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="crew-name">Tên đội *</label>
            <Input
              id="crew-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hasError={Boolean(fieldErrors.name)}
              placeholder="Đội thi công kết cấu"
            />
            {fieldErrors.name ? <p className="bf-field-error" role="alert">{fieldErrors.name.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="crew-description">Mô tả</label>
          <textarea
            id="crew-description"
            className="bf-input"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={fieldErrors.description ? true : undefined}
            placeholder="Phạm vi, khu vực thi công của đội…"
          />
          {fieldErrors.description ? <p className="bf-field-error" role="alert">{fieldErrors.description.join(' ')}</p> : null}
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="crew-leader-search">Tìm trưởng nhóm</label>
          <Input
            id="crew-leader-search"
            value={leaderSearch}
            onChange={(e) => setLeaderSearch(e.target.value)}
            placeholder="Nhập tên hoặc mã NV để lọc…"
          />
        </div>

        <div className="bf-field">
          {leadersLoading ? (
            <p style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }} aria-busy="true">
              Đang tải danh sách công nhân đang hoạt động…
            </p>
          ) : (
            <Select
              id="crew-leader"
              label="Trưởng nhóm *"
              value={leaderUserId}
              options={[
                { value: '', label: '— Chọn trưởng nhóm (công nhân ACTIVE) —' },
                ...filteredLeaders.map((w) => ({ value: w.id, label: workerLabel(w) })),
              ]}
              onChange={(v) => { setLeaderUserId(v); setConfirmLeadChange(false); }}
              aria-invalid={fieldErrors.leaderUserId ? true : undefined}
            />
          )}
          {fieldErrors.leaderUserId ? <p className="bf-field-error" role="alert">{fieldErrors.leaderUserId.join(' ')}</p> : null}
          {mode === 'edit' && initial?.leaderUserId && !initialLeaderInList && !leadersLoading ? (
            <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Trưởng nhóm hiện tại không còn hoạt động — giữ nguyên nếu không đổi; chọn người mới
              chỉ khi thật sự thay trưởng nhóm.
            </p>
          ) : null}
        </div>

        <div className="bf-field">
          <Select
            id="crew-contractor"
            label="Nhà thầu (tùy chọn)"
            value={contractorId}
            options={[
              { value: '', label: '— Không thuộc nhà thầu —' },
              ...contractors.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
            ]}
            onChange={setContractorId}
            aria-invalid={fieldErrors.contractorId ? true : undefined}
          />
          {fieldErrors.contractorId ? <p className="bf-field-error" role="alert">{fieldErrors.contractorId.join(' ')}</p> : null}
        </div>

        {confirmLeadChange && leadChanged ? (
          <Alert tone="info">
            Xác nhận đổi trưởng nhóm của đội? Trưởng nhóm cũ sẽ ngừng hiệu lực từ hôm nay và
            thao tác được ghi nhật ký riêng.
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="submit" loading={loading}>Xác nhận đổi trưởng nhóm</Button>
              <Button type="button" variant="secondary" onClick={() => { setConfirmLeadChange(false); setLeaderUserId(initial?.leaderUserId ?? ''); }}>
                Giữ trưởng nhóm cũ
              </Button>
            </div>
          </Alert>
        ) : null}

        <div className="bf-form-actions">
          <Button type="submit" loading={loading} aria-busy={loading}>
            {mode === 'create' ? 'Tạo đội' : 'Lưu thay đổi'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => (onCancel ? onCancel() : router.back())}>
            Hủy
          </Button>
        </div>
      </form>
    </Card>
  );
}
