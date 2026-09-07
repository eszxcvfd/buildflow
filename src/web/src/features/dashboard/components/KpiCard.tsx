import * as React from 'react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card/Card';

export type KpiTone = 'primary' | 'danger' | 'success' | 'info';

const TONE_CHIP: Record<KpiTone, string> = {
  primary: 'bg-primary-50 text-primary-600',
  danger: 'bg-danger-50 text-danger-600',
  success: 'bg-success-50 text-success-600',
  info: 'bg-info-50 text-info-600',
};

/**
 * KPI đơn lẻ — thuần hiển thị. Trạng thái loading/lỗi được page quyết định:
 * loading → value "…", lỗi → value "—" + note nguyên nhân (không alert đỏ).
 *
 * DashCode stage 3 — stat-card: icon chip mềm (soft tone bg) + title nhỏ
 * + value lớn. `icon`/`tone` optional để tương thích caller cũ.
 */
export function KpiCard({
  label,
  value,
  note,
  icon,
  tone = 'primary',
}: {
  label: string;
  value: string;
  note?: string;
  icon?: React.ReactNode;
  tone?: KpiTone;
}) {
  return (
    <Card>
      <div className="bf-kpi">
        <div className="flex items-center gap-3">
          {icon ? (
            <span
              aria-hidden="true"
              className={cn(
                'grid h-10 w-10 flex-none place-items-center rounded-md text-xl',
                TONE_CHIP[tone],
              )}
            >
              {icon}
            </span>
          ) : null}
          <span className="bf-kpi-label">{label}</span>
        </div>
        <span className="bf-kpi-value text-2xl font-semibold">{value}</span>
        {note ? <span className="bf-kpi-note">{note}</span> : null}
      </div>
    </Card>
  );
}
