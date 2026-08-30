'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createWorker, updateWorker, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { validateWorkerCreate } from '@/features/workers/schemas/worker.schema';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';

interface Props {
  mode: 'create' | 'edit';
  initial?: Worker | null;
}

export function WorkerForm({ mode, initial }: Props) {
  const router = useRouter();
  const [email, setEmail] = React.useState(initial?.email ?? '');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState(initial?.fullName ?? '');
  const [phone, setPhone] = React.useState(initial?.phone ?? '');
  const [employeeCode, setEmployeeCode] = React.useState(initial?.employeeCode ?? '');
  const [tradeId, setTradeId] = React.useState(initial?.trades?.[0]?.tradeId ?? '');
  const [skillLevel, setSkillLevel] = React.useState(initial?.trades?.[0]?.skillLevel ? String(initial.trades[0].skillLevel) : '');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setGlobalSuccess(null);

    if (mode === 'create') {
      const validation = validateWorkerCreate({ email, password, fullName, phone, employeeCode, tradeId, skillLevel });
      if (!validation.valid) {
        setFieldErrors(validation.fieldErrors);
        return;
      }
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const trades = tradeId ? [{ tradeId: tradeId.trim(), skillLevel: Number(skillLevel) }] : [];
      if (mode === 'create') {
        await createWorker({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          employeeCode: employeeCode.trim() || null,
          trades: trades.length ? trades : undefined,
        });
        setGlobalSuccess('Tạo worker thành công');
        setTimeout(() => router.push('/workers'), 800);
      } else if (initial) {
        await updateWorker(initial.id, {
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || null,
          employeeCode: employeeCode.trim() || null,
          trades: tradeId ? trades : undefined,
        });
        setGlobalSuccess('Cập nhật worker thành công');
        setTimeout(() => router.push('/workers'), 800);
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

  return (
    <Card style={{ maxWidth: 640 }}>
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700 }}>{mode === 'create' ? 'Tạo worker' : 'Cập nhật worker'}</h1>
      <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.9rem' }}>
        {mode === 'create'
          ? 'Nhập định danh duy nhất, contact và ngành nghề/kỹ năng. Worker inactive sẽ bị chặn phân công nhưng vẫn giữ lịch sử.'
          : `Đang sửa: ${initial?.email ?? ''} · ${initial?.status ?? ''}`}
      </p>

      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {globalSuccess ? <Alert tone="success">{globalSuccess}</Alert> : null}

      {initial && !initial.eligible ? (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert tone="info">Worker hiện không đủ điều kiện phân công (INACTIVE/LOCKED). Lịch sử cũ vẫn xem được; phân công mới sẽ bị chặn.</Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        {mode === 'create' ? (
          <>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                Email *
              </label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} hasError={Boolean(fieldErrors.email)} />
              {fieldErrors.email ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.email.join(' ')}</p> : null}
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                Mật khẩu *
              </label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hasError={Boolean(fieldErrors.password)} />
              {fieldErrors.password ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.password.join(' ')}</p> : null}
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="fullName" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
            Họ tên *
          </label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} hasError={Boolean(fieldErrors.fullName)} />
          {fieldErrors.fullName ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.fullName.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label htmlFor="phone" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              SĐT
            </label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} hasError={Boolean(fieldErrors.phone)} />
            {fieldErrors.phone ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="employeeCode" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              Mã nhân viên
            </label>
            <Input id="employeeCode" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} hasError={Boolean(fieldErrors.employeeCode)} />
            {fieldErrors.employeeCode ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.employeeCode.join(' ')}</p> : null}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '0.75rem' }}>
          <div>
            <label htmlFor="tradeId" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              Trade ID (UUID)
            </label>
            <Input id="tradeId" placeholder="11111111-1111-4111-8111-111111111111" value={tradeId} onChange={(e) => setTradeId(e.target.value)} hasError={Boolean(fieldErrors.tradeId || fieldErrors.trades)} />
            {fieldErrors.tradeId ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.tradeId.join(' ')}</p> : null}
            {fieldErrors.trades ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.trades.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="skillLevel" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              Skill Lv
            </label>
            <select
              id="skillLevel"
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
              style={{ width: '100%', border: `1px solid ${fieldErrors.skillLevel ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, padding: '0.6rem 0.75rem', background: '#fff' }}
            >
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            {fieldErrors.skillLevel ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.skillLevel.join(' ')}</p> : null}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
          <Button type="submit" loading={loading} aria-busy={loading}>
            {mode === 'create' ? 'Tạo worker' : 'Lưu thay đổi'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/workers')}>
            Hủy
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.refresh()} disabled={loading}>
            Tải lại
          </Button>
        </div>

        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>
          Lỗi trùng định danh (409) không tạo bản ghi một phần; lỗi skill/trade sẽ nêu nguyên nhân cụ thể.
        </p>
      </form>
    </Card>
  );
}
