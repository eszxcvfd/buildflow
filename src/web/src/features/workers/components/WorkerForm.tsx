'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createWorker, updateWorker, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { listTrades, type Trade } from '@/lib/api/trades';
import { validateWorkerCreate } from '@/features/workers/schemas/worker.schema';
import { useTradeNames } from '@/features/workers/hooks/useTradeNames';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { Select } from '@/components/ui/select/Select';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  mode: 'create' | 'edit';
  initial?: Worker | null;
}

export function WorkerForm({ mode, initial }: Props) {
  const router = useRouter();
  const tradeNames = useTradeNames();
  const initialTradeId = initial?.trades?.[0]?.tradeId ?? '';
  const initialSkillLevel = initial?.trades?.[0]?.skillLevel ? String(initial.trades[0].skillLevel) : '';
  const [email, setEmail] = React.useState(initial?.email ?? '');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState(initial?.fullName ?? '');
  const [phone, setPhone] = React.useState(initial?.phone ?? '');
  const [employeeCode, setEmployeeCode] = React.useState(initial?.employeeCode ?? '');
  const [tradeId, setTradeId] = React.useState(initialTradeId);
  const [skillLevel, setSkillLevel] = React.useState(initialSkillLevel);
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = React.useState(true);
  const [tradesLoadFailed, setTradesLoadFailed] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Chỉ load danh mục ĐANG HOẠT ĐỘNG (ORG-SRS-003: trade inactive không dùng
  // cho assignment mới). API phân trang limit 100 tối đa.
  React.useEffect(() => {
    let cancelled = false;
    async function loadTrades() {
      setTradesLoading(true);
      setTradesLoadFailed(false);
      try {
        const res = await listTrades({ status: 'ACTIVE', limit: 100 });
        if (!cancelled) setTrades(res.data);
      } catch {
        if (!cancelled) setTradesLoadFailed(true);
      } finally {
        if (!cancelled) setTradesLoading(false);
      }
    }
    void loadTrades();
    return () => { cancelled = true; };
  }, []);

  const currentTradeActive = mode === 'edit' && !!initialTradeId && trades.some((t) => t.id === initialTradeId);
  const selectedTrade = trades.find((t) => t.id === tradeId) ?? null;
  // Label option "giữ nguyên" khi edit: dùng map id → 'code — name' từ useTradeNames
  // (danh mục ACTIVE + INACTIVE). Trade đã ngừng hoạt động thì hiện tên chung chung.
  const currentTradeName = initialTradeId ? (tradeNames.names.get(initialTradeId) ?? '') : '';
  const currentTradeLabel = mode === 'edit' && initialTradeId
    ? currentTradeName
      ? `${currentTradeName} (hiện tại)`
      : 'Ngành nghề hiện tại (đã ngừng hoạt động)'
    : '';

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
      else if (err.status === 403) setGlobalError('Không có quyền — cần ADMIN');
      else if (err.status === 409) setGlobalError(err.message);
      else setGlobalError(err.message || 'Yêu cầu thất bại');
    }
  }

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
    } else if (tradeId && !skillLevel) {
      // edit: chọn trade mới bắt buộc kèm skill level 1-5
      setFieldErrors({ skillLevel: ['Skill level bắt buộc khi chọn ngành nghề'] });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      // OMIT trades khi KHÔNG đổi gì: tradeId khớp giá trị trade hiện tại VÀ skill
      // level giữ nguyên → payload không chứa key trades → backend PATCH bỏ qua,
      // không vô tình gửi trade đã INACTIVE (backend reject 400). Chỉ gửi khi admin
      // thật sự chọn trade ACTIVE khác hoặc đổi skill level.
      const tradesUnchanged = mode === 'edit'
        && !!initialTradeId
        && tradeId.trim() === initialTradeId
        && skillLevel === initialSkillLevel;
      const tradesPayload = mode === 'create'
        ? (tradeId ? [{ tradeId: tradeId.trim(), skillLevel: Number(skillLevel) }] : undefined)
        : tradesUnchanged
          ? undefined
          : tradeId
            ? [{ tradeId: tradeId.trim(), skillLevel: Number(skillLevel) }]
            : undefined;

      if (mode === 'create') {
        await createWorker({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          employeeCode: employeeCode.trim() || null,
          ...(tradesPayload ? { trades: tradesPayload } : {}),
        });
        setGlobalSuccess('Tạo worker thành công');
        toast.success({ title: 'Tạo worker thành công' });
        setTimeout(() => router.push('/workers'), 800);
      } else if (initial) {
        await updateWorker(initial.id, {
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || null,
          employeeCode: employeeCode.trim() || null,
          ...(tradesPayload ? { trades: tradesPayload } : {}),
        });
        setGlobalSuccess('Cập nhật worker thành công');
        toast.success({ title: 'Cập nhật worker thành công' });
        setTimeout(() => router.push('/workers'), 800);
      }
    } catch (err) {
      setFormError(err);
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

      {mode === 'edit' && initialTradeId && !currentTradeActive && !tradesLoadFailed && !tradesLoading ? (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert tone="info">
            Ngành nghề hiện tại của worker đã ngừng hoạt động nên không còn trong danh sách chọn.
            Giữ nguyên (không sửa phần ngành nghề) sẽ không gửi thay đổi; muốn gán ngành nghề mới,
            hãy chọn danh mục đang hoạt động bên dưới.
          </Alert>
        </div>
      ) : null}

      {tradesLoadFailed ? (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert tone="info">
            Không tải được danh sách ngành nghề hoạt động — nhập tay UUID nếu cần. Lưu ý: danh mục
            ngừng hoạt động sẽ bị hệ thống từ chối cho phân công mới.
          </Alert>
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

        <div className="bf-form-grid">
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
            {tradesLoadFailed ? (
              <>
                <Input id="tradeId" placeholder="11111111-1111-4111-8111-111111111111" value={tradeId} onChange={(e) => setTradeId(e.target.value)} hasError={Boolean(fieldErrors.tradeId || fieldErrors.trades)} />
                {fieldErrors.tradeId ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.tradeId.join(' ')}</p> : null}
                {fieldErrors.trades ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.trades.join(' ')}</p> : null}
              </>
            ) : (
              <>
                <Select
                  id="tradeId"
                  label={mode === 'create' ? 'Ngành nghề ' : 'Ngành nghề (đang hoạt động)'}
                  value={tradesLoading && !currentTradeActive && !tradeId ? '' : tradeId}
                  options={[
                    ...(mode === 'edit' && initialTradeId
                      ? [{ value: initialTradeId, label: currentTradeLabel }]
                      : [{ value: '', label: tradesLoading ? 'Đang tải danh mục…' : '— Không gán ngành nghề —' }]),
                    ...trades
                      .filter((t) => !(mode === 'edit' && t.id === initialTradeId))
                      .map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` })),
                  ]}
                  onChange={(v) => {
                    setTradeId(v);
                    if (!v) setSkillLevel('');
                  }}
                  disabled={tradesLoading}
                  placeholder={tradesLoading ? 'Đang tải danh mục…' : '— Không gán ngành nghề —'}
                  aria-invalid={fieldErrors.tradeId || fieldErrors.trades ? true : undefined}
                />
                {fieldErrors.tradeId ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.tradeId.join(' ')}</p> : null}
                {fieldErrors.trades ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.trades.join(' ')}</p> : null}
              </>
            )}
          </div>
          <div>
            <Select
              id="skillLevel"
              label="Skill Lv"
              value={skillLevel}
              options={[
                { value: '', label: '—' },
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
              ]}
              onChange={setSkillLevel}
              disabled={!selectedTrade}
              placeholder="—"
              aria-invalid={fieldErrors.skillLevel ? true : undefined}
            />
            {fieldErrors.skillLevel ? <p role="alert" style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>{fieldErrors.skillLevel.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-form-actions">
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
          Chỉ chọn được ngành nghề đang hoạt động (ACTIVE) cho phân công mới; danh mục ngừng hiệu
          lực sẽ bị hệ thống từ chối. Lỗi trùng định danh (409) không tạo bản ghi một phần.
        </p>
      </form>
    </Card>
  );
}
