import * as api from '@/lib/api/trades';
import type { ApiError } from '@/lib/api/trades';

export async function fetchTradesWithRetry(params: api.ListTradesParams): Promise<api.ListTradesResult> {
  return api.listTrades(params);
}

export async function createTradeWithFeedback(payload: api.CreateTradePayload): Promise<{ trade: api.Trade | null; error: ApiError | null }> {
  try {
    const trade = await api.createTrade(payload);
    return { trade, error: null };
  } catch (e) {
    return { trade: null, error: e as ApiError };
  }
}

export function mapApiErrorToMessage(err: unknown): string {
  const e = err as ApiError;
  if (e?.message) return e.message;
  return 'Yêu cầu thất bại';
}
