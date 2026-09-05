import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { TradeList } from '@/features/trades';

export const dynamic = 'force-dynamic';

export default function TradesPage() {
  return (
    <>
      <PageHeader
        title="Ngành nghề"
        subtitle="Danh mục ngành nghề/kỹ năng dùng khi phân công công việc — nguồn chọn cho worker, loại công việc và work order."
        actions={
          <a className="bf-btn bf-btn-primary" href="/trades/new">
            Thêm ngành nghề
          </a>
        }
      />
      <TradeList />
    </>
  );
}
