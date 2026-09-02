'use client';

import { useQuery } from '@tanstack/react-query';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!configuredApiUrl) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is required. Copy apps/web/.env.example to apps/web/.env.local.',
  );
}

const apiUrl = configuredApiUrl.replace(/\/$/, '');

async function fetchHealth(): Promise<unknown> {
  const res = await fetch(`${apiUrl}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health responded ${res.status}`);
  return res.json() as Promise<unknown>;
}

export function ApiHealthBadge() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['api-health'],
    queryFn: fetchHealth,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <span className="text-sm text-neutral-500">checking api…</span>;
  if (error) return <span className="text-sm text-red-600">api unreachable</span>;
  return (
    <span className="text-sm text-emerald-600" data-testid="api-health">
      api ok · {JSON.stringify(data)}
    </span>
  );
}
