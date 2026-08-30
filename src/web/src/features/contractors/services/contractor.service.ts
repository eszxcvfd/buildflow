import * as api from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';

export async function fetchContractorsWithRetry(params: api.ListContractorsParams): Promise<api.ListContractorsResult> {
  return api.listContractors(params);
}

export async function createContractorWithFeedback(payload: api.CreateContractorPayload): Promise<{ contractor: api.Contractor | null; error: ApiError | null }> {
  try {
    const contractor = await api.createContractor(payload);
    return { contractor, error: null };
  } catch (e) {
    return { contractor: null, error: e as ApiError };
  }
}

export function mapApiErrorToMessage(err: unknown): string {
  const e = err as ApiError;
  if (e?.message) return e.message;
  return 'Yêu cầu thất bại';
}
