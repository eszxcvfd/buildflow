'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createContractor, updateContractor, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import { validateContractorCreate } from '@/features/contractors/schemas/contractor.schema';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';

interface Props {
  mode: 'create' | 'edit';
  initial?: Contractor | null;
}

export function ContractorForm({ mode, initial }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState(initial?.code ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [contactName, setContactName] = React.useState(initial?.contactName ?? '');
  const [phone, setPhone] = React.useState(initial?.phone ?? '');
  const [email, setEmail] = React.useState(initial?.email ?? '');
  const [scope, setScope] = React.useState(initial?.scope ?? '');
  const [status, setStatus] = React.useState(initial?.status ?? 'ACTIVE');
  const [showStatusConfirm, setShowStatusConfirm] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<'ACTIVE' | 'INACTIVE' | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setGlobalSuccess(null);

    const validation = validateContractorCreate({ code, name, contactName, phone, email, scope, status });
    // For edit, allow partial but we still validate required fields
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      if (mode === 'create') {
        await createContractor({
          code: code.trim(),
          name: name.trim(),
          contactName: contactName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          scope: scope.trim(),
          status: status as 'ACTIVE' | 'INACTIVE',
        });
        setGlobalSuccess('Tạo nhà thầu thành công');
        setTimeout(() => router.push('/contractors'), 800);
      } else if (initial) {
        // Status transition requires confirmation if changing to INACTIVE
        const isStatusChange = status !== initial.status;
        if (isStatusChange && status === 'INACTIVE' && !showStatusConfirm) {
          setPendingStatus(status as 'ACTIVE' | 'INACTIVE');
          setShowStatusConfirm(true);
          setLoading(false);
          return;
        }
        await updateContractor(initial.id, {
          code: code.trim() || undefined,
          name: name.trim() || undefined,
          contactName: contactName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          scope: scope.trim(),
          status: status as 'ACTIVE' | 'INACTIVE',
        });
        setGlobalSuccess('Cập nhật nhà thầu thành công');
        setShowStatusConfirm(false);
        setPendingStatus(null);
        setTimeout(() => router.push(`/contractors/${initial.id}`), 800);
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        const fe: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(e.fieldErrors)) {
          if (k === '_global') continue;
          fe[k] = v;
        }
        setFieldErrors(fe);
        if (e.fieldErrors._global?.length) setGlobalError(e.fieldErrors._global.join(' '));
        else if (Object.keys(fe).length === 0) setGlobalError(e.message);
        else setGlobalError(e.message);
      } else {
        if (e.status === 401) setGlobalError('Phiên hết hạn, vui lòng đăng nhập lại');
        else if (e.status === 403) setGlobalError('Không có quyền — cần ADMIN');
        else if (e.status === 409) setGlobalError(e.message);
        else setGlobalError(e.message || 'Yêu cầu thất bại');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(newStatus: string) {
    if (mode === 'edit' && initial && newStatus !== initial.status && newStatus === 'INACTIVE') {
      // Show confirmation dialog for ACTIVE -> INACTIVE
      setPendingStatus(newStatus as 'ACTIVE' | 'INACTIVE');
      setShowStatusConfirm(true);
      setStatus(newStatus);
    } else {
      setStatus(newStatus);
      setShowStatusConfirm(false);
      setPendingStatus(null);
    }
  }

  return (
    <Card style={{ maxWidth: 720 }}>
      {mode === 'edit' ? (
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          Đang sửa: {initial?.code ?? ''} · {initial?.status ?? ''}
        </p>
      ) : null}

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}

      {initial && !initial.eligible ? (
        <Alert tone="info">
          Nhà thầu hiện không đủ điều kiện phân công (INACTIVE). Lịch sử cũ vẫn xem được; phân công
          mới sẽ bị chặn.
        </Alert>
      ) : null}

      {showStatusConfirm ? (
        <div style={{ border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>Xác nhận đổi trạng thái sang INACTIVE?</p>
          <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>Nhà thầu ngừng hoạt động sẽ không được chọn cho phân công mới nhưng lịch sử cũ vẫn được giữ. Hành động này sẽ được audit.</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => { setShowStatusConfirm(false); setPendingStatus(null); setStatus(initial?.status ?? 'ACTIVE'); }}>Hủy</Button>
            <Button onClick={() => { setShowStatusConfirm(false); if (pendingStatus) setStatus(pendingStatus); }}>Xác nhận INACTIVE</Button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="code">Mã nhà thầu *</label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} hasError={Boolean(fieldErrors.code)} placeholder="CTR-001" />
            {fieldErrors.code ? <p className="bf-field-error" role="alert">{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="status">Trạng thái</label>
            <select id="status" className="bf-input" value={status} onChange={(e) => handleStatusChange(e.target.value)} style={fieldErrors.status ? { borderColor: 'var(--bf-risk)' } : undefined}>
              <option value="ACTIVE">Hoạt động (đủ điều kiện)</option>
              <option value="INACTIVE">Ngừng hoạt động (chặn phân công mới)</option>
            </select>
            {fieldErrors.status ? <p className="bf-field-error" role="alert">{fieldErrors.status.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="name">Tên nhà thầu *</label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} hasError={Boolean(fieldErrors.name)} />
          {fieldErrors.name ? <p className="bf-field-error" role="alert">{fieldErrors.name.join(' ')}</p> : null}
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="contactName">Thông tin liên hệ *</label>
          <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} hasError={Boolean(fieldErrors.contactName)} placeholder="Nguyễn Văn A" />
          {fieldErrors.contactName ? <p className="bf-field-error" role="alert">{fieldErrors.contactName.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="phone">SĐT</label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} hasError={Boolean(fieldErrors.phone)} />
            {fieldErrors.phone ? <p className="bf-field-error" role="alert">{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="email">Email</label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} hasError={Boolean(fieldErrors.email)} />
            {fieldErrors.email ? <p className="bf-field-error" role="alert">{fieldErrors.email.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="scope">Phạm vi công việc *</label>
          <textarea
            id="scope"
            className="bf-input"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={3}
            style={fieldErrors.scope ? { borderColor: 'var(--bf-risk)' } : undefined}
            placeholder="Thí dụ: Thi công phần thô, cốt thép, hoàn thiện"
          />
          {fieldErrors.scope ? <p className="bf-field-error" role="alert">{fieldErrors.scope.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <Button type="button" variant="ghost" onClick={() => router.refresh()} disabled={loading}>Tải lại</Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/contractors')}>Hủy</Button>
          <Button type="submit" loading={loading} aria-busy={loading}>{mode === 'create' ? 'Tạo nhà thầu' : 'Lưu thay đổi'}</Button>
        </div>

        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.8rem' }}>Trường có dấu * là bắt buộc. Nếu mã nhà thầu đã tồn tại, hệ thống sẽ báo trùng và không tạo bản ghi.</p>
      </form>
    </Card>
  );
}
