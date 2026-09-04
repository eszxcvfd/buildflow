import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { ContractorList } from '@/features/contractors';

export const dynamic = 'force-dynamic';

export default function ContractorsPage() {
  return (
    <>
      <PageHeader
        title="Nhà thầu"
        subtitle="Danh sách nhà thầu của công ty — nguồn chọn khi phân công công việc."
        actions={
          <a className="bf-btn bf-btn-primary" href="/contractors/new">
            Thêm nhà thầu
          </a>
        }
      />
      <ContractorList />
    </>
  );
}
