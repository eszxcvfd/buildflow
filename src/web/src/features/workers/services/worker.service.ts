import * as api from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';

export async function fetchWorkersWithRetry(params: api.ListWorkersParams): Promise<api.ListWorkersResult> {
  return api.listWorkers(params);
}

export async function createWorkerWithFeedback(payload: api.CreateWorkerPayload): Promise<{ worker: api.Worker | null; error: ApiError | null }> {
  try {
    const worker = await api.createWorker(payload);
    return { worker, error: null };
  } catch (e) {
    return { worker: null, error: e as ApiError };
  }
}

export function mapApiErrorToMessage(err: unknown): string {
  const e = err as ApiError;
  if (e?.message) return e.message;
  return 'Yêu cầu thất bại';
}
