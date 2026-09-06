import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { ResourceDirectory } from '@/features/resource-directory';

export const dynamic = 'force-dynamic';

/**
 * ORG-SRS-005 (issue #28) — tra cứu nguồn lực cho ADMIN + PROJECT_MANAGER
 * (read-only directory: filter/sort/pagination; write/lifecycle vẫn admin-only
 * ở các màn chi tiết). useSearchParams cần Suspense boundary khi build.
 */
export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        title="Tra cứu nguồn lực"
        subtitle="Tìm kiếm công nhân, nhà thầu theo trạng thái, ngành nghề, kỹ năng — dữ liệu hiện hành phục vụ phân công."
      />
      <React.Suspense fallback={<p>Đang tải tra cứu nguồn lực…</p>}>
        <ResourceDirectory />
      </React.Suspense>
    </>
  );
}
