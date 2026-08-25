import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { Client } from 'pg';

/**
 * E2E test database provisioning.
 *
 * Requires the Docker Compose data services from infra/docker to be running
 * (postgres + redis). Creates an isolated test database, applies Prisma
 * migrations to it, and drops it again on teardown. The admin URL defaults to
 * the compose PostgreSQL loopback binding and can be overridden with
 * DATABASE_URL.
 */
const TEST_DATABASE_NAME = 'buildflow_e2e';
const DEFAULT_ADMIN_URL = 'postgres://buildflow:buildflow@127.0.0.1:5432/buildflow';

// Captured at module load, before the e2e spec overrides DATABASE_URL with the
// test database URL.
const ADMIN_URL = process.env.DATABASE_URL ?? DEFAULT_ADMIN_URL;

function testDatabaseUrl(): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

async function withAdminClient(fn: (client: Client) => Promise<void>): Promise<void> {
  const client = new Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}

function runPrisma(args: string[], databaseUrl: string): void {
  const apiRoot = path.resolve(__dirname, '../..');
  const prismaCli = path.join(apiRoot, 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(process.execPath, [prismaCli, ...args, '--schema', 'prisma/schema.prisma'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

/** Drops any leftover test database, recreates it and applies migrations. */
export async function createTestDatabase(): Promise<string> {
  await dropTestDatabase(); // clear leftovers from a crashed run
  await withAdminClient(async (client) => {
    await client.query(`CREATE DATABASE "${TEST_DATABASE_NAME}"`);
  });
  const url = testDatabaseUrl();
  runPrisma(['migrate', 'deploy'], url);
  return url;
}

/** Drops the test database (also used to clear leftovers from a crashed run). */
export async function dropTestDatabase(): Promise<void> {
  await withAdminClient(async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${TEST_DATABASE_NAME}" WITH (FORCE)`);
  });
}
