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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function fetchStatus(): Promise<ApiStatus> {
  const res = await fetch(`${API_URL}/api/v1/status`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function fetchHealthLive(): Promise<HealthLive> {
  const res = await fetch(`${API_URL}/health/live`);
  if (!res.ok) throw new Error(`live ${res.status}`);
  return res.json();
}
