export interface ApiStatus {
  status: string;
  version: string;
  service: string;
  timestamp: string;
}

export interface HealthLive {
  status: string;
  timestamp: string;
}

export interface HealthReady {
  status: string;
  checks: { postgres: string; redis: string };
  details?: string;
}

function getApiBaseUrl(): string {
  // Inside docker network use service name; fallback to env or localhost for local dev
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export async function fetchStatus(): Promise<ApiStatus> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`status fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchHealthLive(): Promise<HealthLive> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health/live`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`health live failed: ${res.status}`);
  return res.json();
}

export async function fetchHealthReady(): Promise<HealthReady> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health/ready`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) return data;
  return data;
}
