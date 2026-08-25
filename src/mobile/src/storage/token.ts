/**
 * Mobile token storage.
 * Uses in-memory fallback for test / web without SecureStore.
 * For Expo native, would use expo-secure-store if available.
 */
let memoryToken: string | null = null;

export function storeToken(token: string): void {
  memoryToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('buildflow_token', token);
    }
  } catch {
    // ignore
  }
}

export function getStoredToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('buildflow_token');
    }
  } catch {
    // ignore
  }
  return memoryToken;
}

export function clearStoredToken(): void {
  memoryToken = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('buildflow_token');
    }
  } catch {
    // ignore
  }
}
