'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input/Input';
import { Button } from '@/components/ui/button/Button';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { getAuth, isTokenExpired } from '@/lib/auth/storage';
import { fetchProfile, updateProfile, type Profile, type ProfileError } from '@/lib/api/profile';

export function ProfileForm() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const auth = getAuth();
    if (!auth || isTokenExpired(auth)) {
      router.replace('/login');
      return;
    }
    try {
      const p = await fetchProfile(auth.accessToken);
      setProfile(p);
      setFullName(p.fullName ?? '');
      setPhone(p.phone ?? '');
    } catch (e) {
      const err = e as ProfileError;
      if (err.status === 401) {
        router.replace('/login');
        return;
      }
      setGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function validate(): boolean {
    const errors: Record<string, string[]> = {};
    if (!fullName.trim()) errors.fullName = ['Họ tên không được để trống'];
    if (phone && !/^[0-9+\-\s().]{6,20}$/.test(phone)) errors.phone = ['Số điện thoại không hợp lệ'];
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    setSuccess(false);
    if (!validate()) return;
    const auth = getAuth();
    if (!auth || isTokenExpired(auth)) {
      router.replace('/login');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile(auth.accessToken, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });
      setProfile(updated);
      setFullName(updated.fullName ?? '');
      setPhone(updated.phone ?? '');
      setSuccess(true);
    } catch (err) {
      const e2 = err as ProfileError;
      if (e2.status === 401) {
        router.replace('/login');
        return;
      }
      if (e2.fieldErrors) setFieldErrors(e2.fieldErrors);
      setGlobalError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
        <p role="status">Đang tải hồ sơ…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>Hồ sơ cá nhân</h1>
      {globalError ? <Alert tone="error">{globalError}</Alert> : null}
      {success ? <Alert tone="success">Đã cập nhật hồ sơ thành công</Alert> : null}
      <Card style={{ marginTop: '1rem' }}>
        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label htmlFor="pf-email" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email (read-only)</label>
            <Input id="pf-email" value={profile?.email ?? ''} readOnly aria-readonly="true" />
          </div>
          <div>
            <label htmlFor="pf-role" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Vai trò (read-only)</label>
            <Input id="pf-role" value={profile?.userType ?? ''} readOnly aria-readonly="true" />
          </div>
          <div>
            <label htmlFor="pf-status" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Trạng thái (read-only)</label>
            <Input id="pf-status" value={profile?.status ?? ''} readOnly aria-readonly="true" />
          </div>
          <div>
            <label htmlFor="pf-name" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Họ tên</label>
            <Input
              id="pf-name" value={fullName} onChange={(ev) => setFullName(ev.target.value)}
              hasError={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'pf-name-err' : undefined}
            />
            {fieldErrors.fullName ? <p id="pf-name-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.fullName.join(' ')}</p> : null}
          </div>
          <div>
            <label htmlFor="pf-phone" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Số điện thoại</label>
            <Input
              id="pf-phone" value={phone} onChange={(ev) => setPhone(ev.target.value)}
              hasError={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'pf-phone-err' : undefined}
            />
            {fieldErrors.phone ? <p id="pf-phone-err" role="alert" style={{ color: '#ef4444', margin: '0.4rem 0 0' }}>{fieldErrors.phone.join(' ')}</p> : null}
          </div>
          <Button type="submit" loading={saving} aria-busy={saving}>Lưu thay đổi</Button>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>
            Các trường định danh và quyền (email, vai trò, trạng thái) chỉ đọc — không thể tự thay đổi (IAM-SRS-003).
          </p>
        </form>
      </Card>
    </main>
  );
}
