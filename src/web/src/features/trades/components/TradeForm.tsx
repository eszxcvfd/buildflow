'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createTrade, updateTrade, type Trade, type UpdateTradePayload } from '@/lib/api/trades';
import type { ApiError } from '@/lib/api/trades';
import { validateTradeCreate } from '@/features/trades/schemas/trade.schema';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';

interface Props {
  mode: 'create' | 'edit';
  initial?: Trade | null;
}

export function TradeForm({ mode, initial }: Props) {
  const router = useRouter();
  const [code, setCode] = React.useState(initial?.code ?? '');
  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // ORG-SRS-003: status KHÔNG nằm trong form — deactivate/activate là action riêng
  // (PATCH /:id/status có confirm riêng). PATCH /:id chỉ nhận code/name/description.
  function buildPayload(): UpdateTradePayload {
    const payload: UpdateTradePayload = {
      code: code.trim() || undefined,
      name: name.trim() || undefined,
      description: description.trim() || null,
    };
    return payload;
  }

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

  async function save() {
    setLoading(true);
    try {
      if (mode === 'create') {
        await createTrade({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          status: 'ACTIVE',
        });
        setGlobalSuccess('Tạo ngành nghề thành công');
        setTimeout(() => router.push('/trades'), 800);
      } else if (initial) {
        await updateTrade(initial.id, buildPayload());
        setGlobalSuccess('Cập nhật ngành nghề thành công');
        setTimeout(() => router.push(`/trades/${initial.id}`), 800);
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

    const validation = validateTradeCreate({ code, name, description, status: initial?.status ?? 'ACTIVE' });
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      return;
    }
    setFieldErrors({});
    await save();
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

      {initial && !initial.assignable ? (
        <Alert tone="info">
          Danh mục hiện ngừng hoạt động (INACTIVE) nên không được dùng cho phân công mới. Lịch sử
          cũ vẫn giữ; muốn dùng lại cho phân công mới, hãy kích hoạt lại từ màn hình chi tiết.
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="code">Mã ngành nghề *</label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} hasError={Boolean(fieldErrors.code)} placeholder="TR-001" />
            {fieldErrors.code ? <p className="bf-field-error" role="alert">{fieldErrors.code.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="name">Tên ngành nghề *</label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} hasError={Boolean(fieldErrors.name)} placeholder="Thí dụ: Thợ xây" />
            {fieldErrors.name ? <p className="bf-field-error" role="alert">{fieldErrors.name.join(' ')}</p> : null}
          </div>
        </div>

        <div className="bf-field">
          <label className="bf-label" htmlFor="description">Mô tả</label>
          <textarea
            id="description"
            className="bf-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={fieldErrors.description ? { borderColor: 'var(--bf-risk)' } : undefined}
            placeholder="Mô tả ngắn về ngành nghề/kỹ năng (tối đa 500 ký tự)"
          />
          {fieldErrors.description ? <p className="bf-field-error" role="alert">{fieldErrors.description.join(' ')}</p> : null}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <Button type="button" variant="ghost" onClick={() => router.refresh()} disabled={loading}>Tải lại</Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/trades')}>Hủy</Button>
          <Button type="submit" loading={loading} aria-busy={loading}>{mode === 'create' ? 'Tạo ngành nghề' : 'Lưu thay đổi'}</Button>
        </div>

        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
          Trường có dấu * là bắt buộc. Trạng thái hoạt động được quản lý bằng action riêng (Ngừng
          hoạt động/Kích hoạt lại) — không nằm trong form này. Nếu mã đã tồn tại, hệ thống báo
          trùng và không tạo bản ghi.
        </p>
      </form>
    </Card>
  );
}
