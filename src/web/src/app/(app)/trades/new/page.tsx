import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { TradeForm } from '@/features/trades';

export default function TradeNewPage() {
  return (
    <>
      <PageHeader
        title="Thêm ngành nghề"
        subtitle="Nhập mã, tên và mô tả cho danh mục ngành nghề/kỹ năng. Danh mục mới mặc định hoạt động (ACTIVE)."
      />
      <TradeForm mode="create" />
    </>
  );
}
