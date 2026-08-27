import { loginRequest, logoutRequest, type LoginError } from '@/lib/api/auth';
import { saveAuth, getAuth, clearAuth, type StoredAuth } from '@/lib/auth/storage';

export async function loginAndPersist(email: string, password: string): Promise<StoredAuth> {
  try {
    const result = await loginRequest({ email: email.trim(), password });
    // Normalize: ensure expiresAt is ISO string
    const expiresAt = new Date(result.expiresAt).toISOString();
    const toSave: StoredAuth = { ...result, expiresAt };
    saveAuth(toSave);
    return toSave;
  } catch (e) {
    throw e as LoginError;
  }
}

/**
 * Logout idempotent per IAM-SRS-002: POST /api/v1/auth/logout với Bearer token,
 * dù server trả 200 hay 401 ("Phiên hết hạn..."), phía web đều clearAuth.
 * Không tự xử lý thu hồi phiên phía web – thu hồi là trách nhiệm producer (in-memory denylist).
 */
export async function logoutAndClear(): Promise<void> {
  const auth = getAuth();
  const token = auth?.accessToken ?? '';
  try {
    if (token) {
      await logoutRequest(token);
    }
  } catch {
    // Idempotent: even 401/expired/revoked should still clear local session
    // Do not rethrow – logout UI is always local clear + redirect
  } finally {
    clearAuth();
  }
}
