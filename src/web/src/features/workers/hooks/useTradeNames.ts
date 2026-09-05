'use client';

import * as React from 'react';
import { listTrades, type Trade } from '@/lib/api/trades';

export interface TradeNameMap {
  /** tradeId → 'code — name'; rỗng khi chưa load xong hoặc load lỗi */
  names: Map<string, string>;
  loading: boolean;
  failed: boolean;
}

/**
 * Tải một lần danh sách trade (ACTIVE + INACTIVE, phân trang limit 100 tối đa —
 * chưa chứng minh được >100 danh mục tồn tại trong DB hiện tại) để map id → 'code — name'
 * hiển thị thay UUID thô trong UI worker. Khi load lỗi, caller fallback về UUID rút gọn.
 */
export function useTradeNames(): TradeNameMap {
  const [trades, setTrades] = React.useState<Trade[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const res = await listTrades({ status: 'ALL', limit: 100 });
        if (!cancelled) setTrades(res.data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const names = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of trades) map.set(t.id, `${t.code} — ${t.name}`);
    return map;
  }, [trades]);

  return { names, loading, failed };
}
