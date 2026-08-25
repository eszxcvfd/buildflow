// Thin fetch client consuming generated OpenAPI types — DO NOT duplicate manual interfaces.
// Generated types are the source of truth; this file wraps fetch with those types.
import type { components } from './generated';

// Re-export generated DTOs with legacy names for HomePage backward compatibility
export type ApiStatus = components['schemas']['StatusResponseDto'];
export type HealthLive = components['schemas']['HealthLiveResponseDto'];
export type HealthReady = components['schemas']['HealthReadyResponseDto'];

// Also re-export full generated namespaces for consumers that need them
export type { components, paths, operations } from './generated';

function getApiBaseUrl(): string {
  // Inside docker network use service name; fallback to env or localhost for local dev
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export async function fetchStatus(): Promise<ApiStatus> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`status fetch failed: ${res.status}`);
  return res.json() as Promise<ApiStatus>;
}

export async function fetchHealthLive(): Promise<HealthLive> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health/live`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`health live failed: ${res.status}`);
  return res.json() as Promise<HealthLive>;
}

export async function fetchHealthReady(): Promise<HealthReady> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health/ready`, { cache: 'no-store' });
  const data = (await res.json()) as HealthReady;
  if (!res.ok) return data;
  return data;
}
