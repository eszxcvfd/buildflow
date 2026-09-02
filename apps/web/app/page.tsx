import { ApiHealthBadge } from '../components/api-health-badge';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">BuildFlow</h1>
      <p className="text-neutral-600 dark:text-neutral-300 max-w-prose text-center">
        Technical foundation is online. Business modules land in subsequent phases per
        <code className="mx-1 px-1 rounded bg-neutral-200 dark:bg-neutral-800">docs/foundation/modules/</code>.
      </p>
      <ApiHealthBadge />
    </main>
  );
}
