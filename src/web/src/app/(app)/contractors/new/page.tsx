import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { ContractorForm } from '@/features/contractors';

export default function ContractorNewPage() {
  return (
    <>
      <PageHeader
        title="Thêm nhà thầu"
        subtitle="Nhập định danh, liên hệ, phạm vi công việc và trạng thái của nhà thầu."
      />
      <ContractorForm mode="create" />
    </>
  );
}
