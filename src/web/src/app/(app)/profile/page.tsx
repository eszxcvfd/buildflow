import { ProfileForm, ChangePasswordForm } from '@/features/profile';

export const metadata = { title: 'Hồ sơ cá nhân — Buildflow' };

export default function ProfilePage() {
  return (
    <div style={{ display: 'grid', gap: '1rem', padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <ProfileForm />
      <ChangePasswordForm />
    </div>
  );
}
