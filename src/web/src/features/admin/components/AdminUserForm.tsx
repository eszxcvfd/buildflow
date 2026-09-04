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
    <Card style={{ maxWidth: 720 }}>
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem' }}>
        {success ? (
          <Alert tone="success">
            Đã tạo tài khoản <strong>{success.email}</strong> ({success.fullName}).{' '}
            <a href="/admin/users" style={{ color: '#14532d', textDecoration: 'underline' }}>Về danh sách</a>
          </Alert>
        ) : null}
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}
        <div className="bf-field">
          <label className="bf-label" htmlFor="au-email">Email *</label>
          <Input id="au-email" type="email" value={values.email} onChange={(ev) => set('email', ev.target.value)} hasError={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'au-email-err' : undefined} autoComplete="off" />
          {fieldErrors.email ? <p id="au-email-err" className="bf-field-error" role="alert">{fieldErrors.email.join(' ')}</p> : null}
        </div>
        <div className="bf-field">
          <label className="bf-label" htmlFor="au-password">Mật khẩu * (tối thiểu 8 ký tự)</label>
          <Input id="au-password" type="password" value={values.password} onChange={(ev) => set('password', ev.target.value)} hasError={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'au-password-err' : undefined} autoComplete="new-password" />
          {fieldErrors.password ? <p id="au-password-err" className="bf-field-error" role="alert">{fieldErrors.password.join(' ')}</p> : null}
        </div>
        <div className="bf-field">
          <label className="bf-label" htmlFor="au-fullname">Họ tên *</label>
          <Input id="au-fullname" value={values.fullName} onChange={(ev) => set('fullName', ev.target.value)} hasError={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'au-fullname-err' : undefined} />
          {fieldErrors.fullName ? <p id="au-fullname-err" className="bf-field-error" role="alert">{fieldErrors.fullName.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="au-phone">Số điện thoại</label>
            <Input id="au-phone" value={values.phone} onChange={(ev) => set('phone', ev.target.value)} hasError={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'au-phone-err' : undefined} />
            {fieldErrors.phone ? <p id="au-phone-err" className="bf-field-error" role="alert">{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="au-employee-code">Mã nhân viên</label>
            <Input id="au-employee-code" value={values.employeeCode} onChange={(ev) => set('employeeCode', ev.target.value)} hasError={Boolean(fieldErrors.employeeCode)} />
            {fieldErrors.employeeCode ? <p className="bf-field-error" role="alert">{fieldErrors.employeeCode.join(' ')}</p> : null}
          </div>
        </div>
        <div className="bf-field">
          <label className="bf-label" htmlFor="au-user-type">Loại tài khoản *</label>
          <select id="au-user-type" className="bf-input" value={values.userType} onChange={(ev) => set('userType', ev.target.value)}>
            <option value="STAFF">STAFF — Nhân viên</option>
            <option value="WORKER">WORKER — Công nhân</option>
          </select>
          {fieldErrors.userType ? <p className="bf-field-error" role="alert">{fieldErrors.userType.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button type="submit" loading={saving} aria-busy={saving}>Tạo tài khoản</Button>
          <a href="/admin/users">Hủy</a>
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
    return <Card style={{ maxWidth: 720 }}><p aria-busy="true">Đang tải…</p></Card>;
  }

  if (loadError) {
    return (
      <Card style={{ maxWidth: 720 }}>
        <Alert tone="error">{loadError.status === 403 ? 'Không có quyền truy cập (403)' : loadError.message}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <a href="/admin/users">Về danh sách</a>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ maxWidth: 720 }}>
      {initial ? (
        <p className="bf-card-meta" style={{ marginTop: 0 }}>
          Trạng thái hiện tại: <strong>{initial.status}</strong> — thay đổi trạng thái thực hiện từ danh sách tài khoản.
        </p>
      ) : null}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem' }}>
        {success ? <Alert tone="success">Đã cập nhật tài khoản</Alert> : null}
        {globalError ? <Alert tone="error">{globalError}</Alert> : null}
        <div className="bf-field">
          <label className="bf-label" htmlFor="aue-email">Email *</label>
          <Input id="aue-email" type="email" value={values.email} onChange={(ev) => set('email', ev.target.value)} hasError={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'aue-email-err' : undefined} />
          {fieldErrors.email ? <p id="aue-email-err" className="bf-field-error" role="alert">{fieldErrors.email.join(' ')}</p> : null}
        </div>
        <div className="bf-field">
          <label className="bf-label" htmlFor="aue-fullname">Họ tên *</label>
          <Input id="aue-fullname" value={values.fullName} onChange={(ev) => set('fullName', ev.target.value)} hasError={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'aue-fullname-err' : undefined} />
          {fieldErrors.fullName ? <p id="aue-fullname-err" className="bf-field-error" role="alert">{fieldErrors.fullName.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="bf-field">
            <label className="bf-label" htmlFor="aue-phone">Số điện thoại</label>
            <Input id="aue-phone" value={values.phone} onChange={(ev) => set('phone', ev.target.value)} hasError={Boolean(fieldErrors.phone)} />
            {fieldErrors.phone ? <p className="bf-field-error" role="alert">{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="aue-employee-code">Mã nhân viên</label>
            <Input id="aue-employee-code" value={values.employeeCode} onChange={(ev) => set('employeeCode', ev.target.value)} hasError={Boolean(fieldErrors.employeeCode)} />
            {fieldErrors.employeeCode ? <p className="bf-field-error" role="alert">{fieldErrors.employeeCode.join(' ')}</p> : null}
          </div>
        </div>
        <div className="bf-field">
          <label className="bf-label" htmlFor="aue-user-type">Loại tài khoản *</label>
          <select id="aue-user-type" className="bf-input" value={values.userType} onChange={(ev) => set('userType', ev.target.value)}>
            <option value="STAFF">STAFF — Nhân viên</option>
            <option value="WORKER">WORKER — Công nhân</option>
          </select>
          {fieldErrors.userType ? <p className="bf-field-error" role="alert">{fieldErrors.userType.join(' ')}</p> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Button type="submit" loading={saving} aria-busy={saving}>Lưu thay đổi</Button>
          <a href="/admin/users">Hủy</a>
        </div>
      </form>
    </Card>
  );
}
