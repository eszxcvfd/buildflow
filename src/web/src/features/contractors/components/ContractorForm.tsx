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
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700 }}>{mode === 'create' ? 'Tạo nhà thầu' : 'Cập nhật nhà thầu'}</h1>
      <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.9rem' }}>
        {mode === 'create' ? 'Nhập định danh, contact, scope và trạng thái. Thiếu contact/scope sẽ bị từ chối (400). INACTIVE không cho phân công mới.' : `Đang sửa: ${initial?.code ?? ''} · ${initial?.status ?? ''}`}
      </p>

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}

      {initial && !initial.eligible ? <div style={{ marginTop: '0.75rem' }}><Alert tone="info">Nhà thầu hiện không đủ điều kiện phân công (INACTIVE). Lịch sử cũ vẫn xem được; phân công mới sẽ bị chặn.</Alert></div> : null}

      {showStatusConfirm ? (
        <div style={{ marginTop: '0.75rem', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
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
          <div>
            <label htmlFor="code" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Mã nhà thầu *</label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} hasError={Boolean(fieldErrors.code)} placeholder="CTR-001" />
            {fieldErrors.code ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="status" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Trạng thái</label>
            <select id="status" value={status} onChange={(e) => handleStatusChange(e.target.value)} style={{ width: '100%', border: `1px solid ${fieldErrors.status ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, padding: '0.6rem 0.75rem', background: '#fff' }}>
              <option value="ACTIVE">Hoạt động (đủ điều kiện)</option>
              <option value="INACTIVE">Ngừng hoạt động (chặn phân công mới)</option>
            </select>
            {fieldErrors.status ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.status.join(' ')}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="name" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Tên nhà thầu *</label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} hasError={Boolean(fieldErrors.name)} />
          {fieldErrors.name ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.name.join(' ')}</p> : null}
        </div>

        <div>
          <label htmlFor="contactName" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Thông tin liên hệ *</label>
          <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} hasError={Boolean(fieldErrors.contactName)} placeholder="Nguyễn Văn A" />
          {fieldErrors.contactName ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.contactName.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label htmlFor="phone" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>SĐT</label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} hasError={Boolean(fieldErrors.phone)} />
            {fieldErrors.phone ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Email</label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} hasError={Boolean(fieldErrors.email)} />
            {fieldErrors.email ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.email.join(' ')}</p> : null}
          </div>
        </div>

        <div>
          <label htmlFor="scope" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>Phạm vi công việc *</label>
          <textarea id="scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={3} style={{ width: '100%', border: `1px solid ${fieldErrors.scope ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, padding: '0.6rem 0.75rem', fontFamily: 'inherit' }} placeholder="Thí dụ: Thi công phần thô, cốt thép, hoàn thiện" />
          {fieldErrors.scope ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.scope.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <Button type="submit" loading={loading} aria-busy={loading}>{mode === 'create' ? 'Tạo nhà thầu' : 'Lưu thay đổi'}</Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/contractors')}>Hủy</Button>
          <Button type="button" variant="ghost" onClick={() => router.refresh()} disabled={loading}>Tải lại</Button>
        </div>

        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>Lỗi thiếu định danh/contact/scope (400) sẽ nêu nguyên nhân cụ thể; lỗi trùng mã (409) không tạo bản ghi một phần; lỗi quyền (403) yêu cầu ADMIN.</p>
      </form>
    </Card>
  );
}
