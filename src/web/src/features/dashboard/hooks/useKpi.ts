'use client';

import * as React from 'react';
import { apiErrorMessage, apiErrorStatus } from '../lib/api-error';

/** Dữ liệu KPI khi tải thành công. */
export interface KpiData {
  value: string;
  note?: string;
}

/** Trạng thái của một KPI: loading → ok | error, mỗi KPI độc lập nhau. */
export interface KpiState {
  loading: boolean;
  data: KpiData | null;
  errorNote: string | null;
}

export const KPI_LOADING: KpiState = { loading: true, data: null, errorNote: null };

/**
 * Map lỗi API → note ngắn gọn (không hiện alert đỏ trên KPI).
 * 401 → hết hạn; 403 → không đủ quyền (có thể override từng KPI);
 * còn lại dùng message từ server nếu có.
 */
export function kpiErrorNote(e: unknown, forbiddenNote = 'Không có quyền truy cập'): string {
  const status = apiErrorStatus(e);
  if (status === 401) return 'Phiên hết hạn';
  if (status === 403) return forbiddenNote;
  return apiErrorMessage(e, 'Lỗi tải dữ liệu');
}

/** Chuyển KpiState → props của KpiCard: loading "…", lỗi "—", ok thì giá trị thật. */
export function kpiCardProps(state: KpiState): { value: string; note?: string } {
  if (state.loading) return { value: '…' };
  if (state.errorNote) return { value: '—', note: state.errorNote };
  return { value: state.data?.value ?? '—', note: state.data?.note };
}

/**
 * Hook chạy MỘT fetch độc lập cho một KPI. `load` nên là hàm module-scope
 * hoặc useCallback để không kích hoạt lại effect.
 */
export function useKpi(load: () => Promise<KpiData>, forbiddenNote?: string): KpiState {
  const [state, setState] = React.useState<KpiState>(KPI_LOADING);

  React.useEffect(() => {
    let alive = true;
    setState(KPI_LOADING);
    load().then(
      (data) => {
        if (alive) setState({ loading: false, data, errorNote: null });
      },
      (e: unknown) => {
        if (alive) setState({ loading: false, data: null, errorNote: kpiErrorNote(e, forbiddenNote) });
      },
    );
    return () => {
      alive = false;
    };
  }, [load, forbiddenNote]);

  return state;
}
