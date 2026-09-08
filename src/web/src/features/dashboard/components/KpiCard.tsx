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
 * DashCode stat-card: icon chip 48px soft-tone + label 14px slate-500
 * + value 24-28px/700 + sub delta màu success. `note` là số liệu phụ
 * tích cực (vd "3 đang chạy", bắt đầu bằng chữ số) thì render delta xanh;
 * note lỗi/quyền (chữ) giữ màu faint. `icon`/`tone` optional để tương thích caller cũ.
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
  const isDelta = Boolean(note && /^\d/.test(note.trim()));
  return (
    <Card>
      <div className="bf-kpi">
        <div className="flex items-center gap-3">
          {icon ? (
            <span
              aria-hidden="true"
              className={cn(
                'grid h-12 w-12 flex-none place-items-center rounded-md text-xl',
                TONE_CHIP[tone],
              )}
            >
              {icon}
            </span>
          ) : null}
          <span className="bf-kpi-label">{label}</span>
        </div>
        <span className="bf-kpi-value text-2xl font-bold">{value}</span>
        {note ? (
          <span className={isDelta ? 'bf-kpi-delta' : 'bf-kpi-note'}>{note}</span>
        ) : null}
      </div>
    </Card>
  );
}
