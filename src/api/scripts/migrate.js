#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

const MIGRATION_FILE = /^\d+_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 'buildflow.schema_migrations';

function migrationDirectory() {
  return path.resolve(
    process.env.MIGRATIONS_DIR || path.resolve(__dirname, '..', 'migrations'),
  );
}

async function migrationFiles() {
  const directory = migrationDirectory();
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && MIGRATION_FILE.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (files.length === 0) {
    throw new Error(`No migration files found in ${directory}`);
  }

  return files.map((name) => ({
    name,
    path: path.join(directory, name),
  }));
}

function checksum(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run database migrations');
  }

  const files = await migrationFiles();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let lockHeld = false;
  try {
    await client.query("SET TIME ZONE 'UTC'");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version varchar(255) PRIMARY KEY,
        checksum varchar(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_KEY]);
    lockHeld = true;

    const appliedResult = await client.query(
      'SELECT version, checksum FROM public.schema_migrations ORDER BY version',
    );
    const applied = new Map(
      appliedResult.rows.map((row) => [row.version, row.checksum]),
    );

    for (const file of files) {
      const sql = await readFile(file.path, 'utf8');
      const fileChecksum = checksum(sql);
      const recordedChecksum = applied.get(file.name);

      if (recordedChecksum) {
        if (recordedChecksum !== fileChecksum) {
          throw new Error(
            `Migration checksum mismatch for ${file.name}: ` +
              `recorded=${recordedChecksum} current=${fileChecksum}`,
          );
        }
        console.log(`skip ${file.name}`);
        continue;
      }

      console.log(`apply ${file.name}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.schema_migrations (version, checksum)
           VALUES ($1, $2)`,
          [file.name, fileChecksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log(`database migration complete (${files.length} file(s))`);
  } finally {
    if (lockHeld) {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_KEY]);
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
