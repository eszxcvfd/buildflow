#!/usr/bin/env node
/**
 * Generate the typed API client from `<repo-root>/apps/api/openapi.json`
 * into `<repo-root>/packages/api-client/src/generated/api.d.ts`.
 *
 * Implementation note: openapi-typescript's JS API currently trips an
 * internal TypeScript AST emitter on Node 24 + TS ≥ 5.6 for some documents,
 * so we wrap its CLI. Path discovery finds the actual `cli.js` inside
 * `node_modules/.pnpm/openapi-typescript@*` so we never shell out to a
 * pnpm shim.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// packages/api-client/scripts → repo root is three `..` levels up.
const repoRoot = resolve(here, '..', '..', '..');
const pkgRoot = resolve(repoRoot, 'packages', 'api-client');
const pnpmStore = resolve(repoRoot, 'node_modules', '.pnpm');
const openapiPath = resolve(repoRoot, 'apps', 'api', 'openapi.json');
const outDir = resolve(pkgRoot, 'src', 'generated');
const outFile = resolve(outDir, 'api.d.ts');

if (!existsSync(openapiPath)) {
  console.error(
    `OpenAPI document not found at ${openapiPath}. Run \`pnpm --filter @buildflow/api openapi:export\` first.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const cliPath = (() => {
  const pkg = JSON.parse(
    readFileSync(resolve(pkgRoot, 'node_modules', 'openapi-typescript', 'package.json'), 'utf8'),
  );
  const matches = readdirSync(pnpmStore).filter((name) =>
    name.startsWith(`openapi-typescript@${pkg.version}_`),
  );
  if (matches.length === 0) {
    throw new Error(`openapi-typescript@${pkg.version} not found in pnpm store`);
  }
  return join(pnpmStore, matches[0], 'node_modules', 'openapi-typescript', 'bin', 'cli.js');
})();

const res = spawnSync(process.execPath, [cliPath, openapiPath, '--output', outFile], {
  stdio: 'inherit',
  cwd: repoRoot,
});
process.exit(res.status ?? 1);
