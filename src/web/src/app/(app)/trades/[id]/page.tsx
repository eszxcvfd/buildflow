import { TradeDetail } from '@/features/trades';

export default function TradeDetailPage({ params }: { params: { id: string } }) {
  return <TradeDetail id={params.id} />;
}
