'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { ProfileForm, ChangePasswordForm } from '@/features/profile';
import { getAuth } from '@/lib/auth/storage';

/**
 * Route (app)/profile đã được AppShell bọc (guard + sidebar) — page không tự
 * check auth/redirect nữa, chỉ đọc getAuth() để hiển thị thông tin người dùng.
 */
export default function ProfilePage() {
  const [subtitle, setSubtitle] = React.useState('');

  React.useEffect(() => {
    const auth = getAuth();
    setSubtitle(auth?.user.fullName || auth?.user.email || '');
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader title="Hồ sơ cá nhân" subtitle={subtitle || undefined} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <ProfileForm />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
