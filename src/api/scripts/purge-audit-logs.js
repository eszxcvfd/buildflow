#!/usr/bin/env node
'use strict';

/**
 * IAM-SRS-008 — owner-approved audit log retention purge (session 2026-09-05).
 *
 * Deletes audit_logs rows OLDER than the retention cutoff (default 365 days,
 * configurable via AUDIT_RETENTION_DAYS or --days). The append-only trigger in
 * migration 0004 only allows DELETE while the session GUC `audit.purge_enabled`
 * is 'on'; this script sets it with SET LOCAL inside its own transaction so the
 * purge DELETE is the ONLY way rows can be removed. UPDATE and TRUNCATE remain
 * blocked. The purge relies on the app DB role also owning the trigger
 * functions — the same trust model already documented as a residual risk in
 * DATA.md; production should run this with the migration/owner role.
 *
 * Usage:
 *   npm run db:purge-audit                     # dry-run: prints count, deletes nothing
 *   npm run db:purge-audit -- --yes            # actually purges (default 365 days)
 *   npm run db:purge-audit -- --yes --days 90  # custom retention
 *
 * Env: DATABASE_URL (same contract as scripts/migrate.js), optional
 * AUDIT_RETENTION_DAYS (defaults to 365; --days overrides).
 */

const { Client } = require('pg');

const DEFAULT_RETENTION_DAYS = 365;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--days') {
      const value = argv[i + 1];
      if (value === undefined) throw new Error('--days requires a value');
      args.days = value;
      i += 1;
    } else if (arg === '--yes') {
      args.yes = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function retentionDays(args) {
  const raw = args.days ?? process.env.AUDIT_RETENTION_DAYS ?? String(DEFAULT_RETENTION_DAYS);
  const days = Number(raw);
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`Invalid retention days: ${raw} (must be a positive integer)`);
  }
  return days;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/purge-audit-logs.js [--days N] [--yes]');
    process.exitCode = 0;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (same contract as scripts/migrate.js)');
  }

  const days = retentionDays(args);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");

    await client.query('BEGIN');
    // Session GUC: required by audit_logs_append_only_guard (migration 0004) to
    // allow ANY row-level DELETE on public.audit_logs. SET LOCAL scopes it to
    // this transaction — rolled back/expired automatically on COMMIT/rollback.
    await client.query("SET LOCAL audit.purge_enabled = 'on'");
    // Cutoff computed on the DB server (now() - days) so the purge boundary is
    // exactly what the DELETE compares against, independent of client clock.
    const cutoffResult = await client.query(
      `SELECT now() - make_interval(days => $1) AS cutoff`,
      [days],
    );
    const cutoff = cutoffResult.rows[0].cutoff;
    // pg returns timestamptz as a Date; format strictly as YYYY-MM-DD (UTC — the
    // session is on SET TIME ZONE 'UTC').
    const cutoffDate = cutoff instanceof Date ? cutoff.toISOString().slice(0, 10) : String(cutoff).slice(0, 10);

    if (args.yes) {
      const deleted = await client.query(
        `DELETE FROM public.audit_logs WHERE created_at < $1 RETURNING id`,
        [cutoff],
      );
      await client.query('COMMIT');
      const noun = deleted.rowCount === 1 ? 'record' : 'records';
      console.log(`purged ${deleted.rowCount} audit ${noun} older than ${cutoffDate} (days=${days})`);
    } else {
      const counted = await client.query(
        `SELECT COUNT(*)::int AS c FROM public.audit_logs WHERE created_at < $1`,
        [cutoff],
      );
      // Dry-run: roll back, nothing is deleted.
      await client.query('ROLLBACK');
      const noun = counted.rows[0].c === 1 ? 'record' : 'records';
      console.log(`dry-run: ${counted.rows[0].c} audit ${noun} would be purged (older than ${cutoffDate}, days=${days}); pass --yes to delete`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});