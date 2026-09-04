import * as React from 'react';
import { ResetPasswordForm } from '@/features/auth';

export const metadata = { title: 'Đặt lại mật khẩu — Buildflow' };

/**
 * IAM-SRS-007: useSearchParams() must live inside a Suspense boundary,
 * otherwise `next build` fails prerendering with a CSR bailout.
 */
export default function ResetPasswordPage() {
  return (
    <main style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem', background: '#f9fafb' }}>
      <React.Suspense fallback={<p role="status">Đang tải biểu mẫu…</p>}>
        <ResetPasswordForm />
      </React.Suspense>
    </main>
  );
}
