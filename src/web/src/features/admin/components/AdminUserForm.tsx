'use client';

import * as React from 'react';
import {
  createAdminUser,
  getAdminUser,
  updateAdminUser,
  type AdminUser,
  type AdminUserError,
} from '@/lib/api/admin-users';
import { validateAdminUserCreate, validateAdminUserUpdate, type AdminUserFormValues } from '@/features/admin/schemas/admin-user.schema';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Input } from '@/components/ui/input/Input';

const EMPTY: AdminUserFormValues = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  employeeCode: '',
  userType: 'STAFF',
};

export function AdminUserCreateForm() {
  const [values, setValues] = React.useState<AdminUserFormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<AdminUser | null>(null);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof AdminUserFormValues>(key: K, value: AdminUserFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setSuccess(null);
    const v = validateAdminUserCreate(values);
    setFieldErrors(v.fieldErrors);
    if (!v.valid) return;
    setSaving(true);
    try {
      const created = await createAdminUser({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || null,
        employeeCode: values.employeeCode.trim() || null,
        userType: values.userType as 'STAFF' | 'WORKER',
      });
      setSuccess(created);
      setValues(EMPTY);
      setFieldErrors({});
    } catch (err) {
      const e2 = err as AdminUserError;
      if (e2.fieldErrors) setFieldErrors(e2.fieldErrors);
      setGlobalError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem' }}>
        {success ? (
          <Alert tone="success">
            Đã tạo tài khoản <strong>{success.email}</strong> ({success.fullName}).{' '}
            <a href="/admin/users" style={{ color: '#14532d', textDecoration: 'underline' }}>Về danh sách</a>
          </Alert>
        ) : null}
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}
        <div>
          <label htmlFor="au-email" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email *</label>
          <Input id="au-email" type="email" value={values.email} onChange={(ev) => set('email', ev.target.value)} hasError={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'au-email-err' : undefined} autoComplete="off" />
          {fieldErrors.email ? <p id="au-email-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.email.join(' ')}</p> : null}
        </div>
        <div>
          <label htmlFor="au-password" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Mật khẩu * (tối thiểu 8 ký tự)</label>
          <Input id="au-password" type="password" value={values.password} onChange={(ev) => set('password', ev.target.value)} hasError={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'au-password-err' : undefined} autoComplete="new-password" />
          {fieldErrors.password ? <p id="au-password-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.password.join(' ')}</p> : null}
        </div>
        <div>
          <label htmlFor="au-fullname" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Họ tên *</label>
          <Input id="au-fullname" value={values.fullName} onChange={(ev) => set('fullName', ev.target.value)} hasError={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'au-fullname-err' : undefined} />
          {fieldErrors.fullName ? <p id="au-fullname-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.fullName.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="au-phone" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Số điện thoại</label>
            <Input id="au-phone" value={values.phone} onChange={(ev) => set('phone', ev.target.value)} hasError={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'au-phone-err' : undefined} />
            {fieldErrors.phone ? <p id="au-phone-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="au-employee-code" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Mã nhân viên</label>
            <Input id="au-employee-code" value={values.employeeCode} onChange={(ev) => set('employeeCode', ev.target.value)} hasError={Boolean(fieldErrors.employeeCode)} />
            {fieldErrors.employeeCode ? <p role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.employeeCode.join(' ')}</p> : null}
          </div>
        </div>
        <div>
          <label htmlFor="au-user-type" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Loại tài khoản *</label>
          <select id="au-user-type" value={values.userType} onChange={(ev) => set('userType', ev.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', background: '#fff' }}>
            <option value="STAFF">STAFF — Nhân viên</option>
            <option value="WORKER">WORKER — Công nhân</option>
          </select>
          {fieldErrors.userType ? <p role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.userType.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button type="submit" loading={saving} aria-busy={saving}>Tạo tài khoản</Button>
          <a href="/admin/users" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Hủy</a>
        </div>
      </form>
    </Card>
  );
}

export function AdminUserEditForm({ userId }: { userId: string }) {
  const [initial, setInitial] = React.useState<AdminUser | null>(null);
  const [values, setValues] = React.useState({ email: '', fullName: '', phone: '', employeeCode: '', userType: 'STAFF' });
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<AdminUserError | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await getAdminUser(userId);
        if (cancelled) return;
        setInitial(u);
        setValues({
          email: u.email,
          fullName: u.fullName ?? '',
          phone: u.phone ?? '',
          employeeCode: u.employeeCode ?? '',
          userType: u.userType === 'WORKER' ? 'WORKER' : 'STAFF',
        });
      } catch (e) {
        if (!cancelled) setLoadError(e as AdminUserError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  function set(key: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setSuccess(false);
    const v = validateAdminUserUpdate(values);
    setFieldErrors(v.fieldErrors);
    if (!v.valid) return;
    setSaving(true);
    try {
      await updateAdminUser(userId, {
        email: values.email.trim().toLowerCase(),
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || null,
        employeeCode: values.employeeCode.trim() || null,
        userType: values.userType as 'STAFF' | 'WORKER',
      });
      setSuccess(true);
    } catch (err) {
      const e2 = err as AdminUserError;
      if (e2.fieldErrors) setFieldErrors(e2.fieldErrors);
      setGlobalError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Card><p aria-busy="true">Đang tải hồ sơ tài khoản…</p></Card>;
  }

  if (loadError) {
    return (
      <Card>
        <Alert tone="error">{loadError.status === 403 ? 'Không có quyền truy cập (403)' : loadError.message}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <a href="/admin/users" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Về danh sách</a>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      {initial ? (
        <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.9rem' }}>
          Trạng thái hiện tại: <strong>{initial.status}</strong> — thay đổi trạng thái thực hiện từ danh sách tài khoản.
        </p>
      ) : null}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem' }}>
        {success ? <Alert tone="success">Đã cập nhật tài khoản</Alert> : null}
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}
        <div>
          <label htmlFor="aue-email" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email *</label>
          <Input id="aue-email" type="email" value={values.email} onChange={(ev) => set('email', ev.target.value)} hasError={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'aue-email-err' : undefined} />
          {fieldErrors.email ? <p id="aue-email-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.email.join(' ')}</p> : null}
        </div>
        <div>
          <label htmlFor="aue-fullname" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Họ tên *</label>
          <Input id="aue-fullname" value={values.fullName} onChange={(ev) => set('fullName', ev.target.value)} hasError={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'aue-fullname-err' : undefined} />
          {fieldErrors.fullName ? <p id="aue-fullname-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.fullName.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="aue-phone" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Số điện thoại</label>
            <Input id="aue-phone" value={values.phone} onChange={(ev) => set('phone', ev.target.value)} hasError={Boolean(fieldErrors.phone)} />
            {fieldErrors.phone ? <p role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="aue-employee-code" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Mã nhân viên</label>
            <Input id="aue-employee-code" value={values.employeeCode} onChange={(ev) => set('employeeCode', ev.target.value)} hasError={Boolean(fieldErrors.employeeCode)} />
            {fieldErrors.employeeCode ? <p role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.employeeCode.join(' ')}</p> : null}
          </div>
        </div>
        <div>
          <label htmlFor="aue-user-type" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Loại tài khoản *</label>
          <select id="aue-user-type" value={values.userType} onChange={(ev) => set('userType', ev.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', background: '#fff' }}>
            <option value="STAFF">STAFF — Nhân viên</option>
            <option value="WORKER">WORKER — Công nhân</option>
          </select>
          {fieldErrors.userType ? <p role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.userType.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button type="submit" loading={saving} aria-busy={saving}>Lưu thay đổi</Button>
          <a href="/admin/users" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Hủy</a>
        </div>
      </form>
    </Card>
  );
}
