# @buildflow/web

Next.js 16 (App Router) technical foundation only.

No login, no dashboards, no business screens yet. The home page calls the
`@buildflow/api` health endpoint through `@tanstack/react-query` to prove
the API client pipeline end to end.

Run locally:

```sh
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @buildflow/web dev   # http://localhost:3001
```

`NEXT_PUBLIC_API_URL` is required and intentionally has no source-code fallback.

See [`docs/architecture/adr/ADR-004-web-platform.md`](../../docs/architecture/adr/ADR-004-web-platform.md).
