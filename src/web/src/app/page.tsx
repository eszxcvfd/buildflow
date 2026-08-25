import { fetchStatus, fetchHealthLive, fetchHealthReady } from '@/lib/api/client';
import type { ApiStatus, HealthLive, HealthReady } from '@/lib/api/client';
import { LogoutButton } from '@/features/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let status: ApiStatus | null = null;
  let live: HealthLive | null = null;
  let ready: HealthReady | null = null;
  let error: string | null = null;

  try {
    [status, live, ready] = await Promise.all([fetchStatus(), fetchHealthLive(), fetchHealthReady()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Buildflow Status</h1>
        <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link href="/login" style={{ color: '#111', fontWeight: 600 }}>
            Sign in
          </Link>
          <LogoutButton />
        </nav>
      </header>
      {error ? (
        <div role="alert" style={{ color: 'red' }}>
          <p>API unavailable: {error}</p>
          <p>Check that the API service is running at the configured URL.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="api-status">
            <h2 id="api-status">API v1 Status</h2>
            <pre>{JSON.stringify(status, null, 2)}</pre>
          </section>
          <section aria-labelledby="health-live">
            <h2 id="health-live">Liveness</h2>
            <pre>{JSON.stringify(live, null, 2)}</pre>
          </section>
          <section aria-labelledby="health-ready">
            <h2 id="health-ready">Readiness</h2>
            <pre>{JSON.stringify(ready, null, 2)}</pre>
          </section>
        </>
      )}
    </main>
  );
}
