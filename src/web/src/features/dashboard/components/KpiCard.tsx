import * as React from 'react';
import { Card } from '@/components/ui/card/Card';

/**
 * KPI đơn lẻ — thuần hiển thị. Trạng thái loading/lỗi được page quyết định:
 * loading → value "…", lỗi → value "—" + note nguyên nhân (không alert đỏ).
 */
export function KpiCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <div className="bf-kpi">
        <span className="bf-kpi-label">{label}</span>
        <span className="bf-kpi-value">{value}</span>
        {note ? <span className="bf-kpi-note">{note}</span> : null}
      </div>
    </Card>
  );
}
