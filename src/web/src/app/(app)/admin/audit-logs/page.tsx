import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Card } from '@/components/ui/card/Card';
import { AuditLogList } from '@/features/audit-logs';

export const dynamic = 'force-dynamic';

/**
 * IAM-SRS-008 (GitHub issue #23): AuditLogList dùng useSearchParams() cho deep-link bộ lọc,
 * nên page bọc feature trong <Suspense> để tránh CSR bailout khi prerender (như (auth)/reset-password).
 */
export default function AdminAuditLogsPage() {
  return (
    <>
      <PageHeader
        title="Nhật ký thao tác"
        subtitle="Truy vết sự kiện đăng nhập, phân quyền và thay đổi tài khoản trong hệ thống."
      />
      <React.Suspense
        fallback={
          <Card>
            <p aria-busy="true">Đang tải…</p>
          </Card>
        }
      >
        <AuditLogList />
      </React.Suspense>
    </>
  );
}
