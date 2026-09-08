import { WorkOrdersView } from '@/features/work-orders';

export const dynamic = 'force-dynamic';

/**
 * `/work-orders` — danh sách công việc (mọi user đã đăng nhập; scope
 * server-side theo membership). Deep-link filter `?projectId=&status=`
 * từ section `Công việc` ở ProjectDetail.
 */
export default function WorkOrdersPage({
  searchParams,
}: {
  searchParams?: { projectId?: string; status?: string };
}) {
  return (
    <WorkOrdersView
      initialProjectId={searchParams?.projectId}
      initialStatus={searchParams?.status}
    />
  );
}
