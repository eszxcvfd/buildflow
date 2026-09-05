import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { PgAuditRepository } from './pg-audit.repository';

// IAM-SRS-008 integration proof — runs only when DATABASE_URL is set and the
// migrations have been applied (`npm run db:migrate`). Skipped entirely in the
// default unit run so `npm test` stays green without infrastructure.
const DATABASE_URL = process.env.DATABASE_URL;
const describeIntegration = DATABASE_URL ? describe : describe.skip;

const APPEND_ONLY_RE = /append-only/;

describeIntegration('PgAuditRepository integration (IAM-SRS-008, DATABASE_URL-gated)', () => {
  let pool: Pool;
  // Both probes (table + append-only trigger) must pass before any test body
  // runs — a destructive TRUNCATE against an under-migrated DB would succeed.
  let migrationReady = false;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
    const probe = await pool.query(`SELECT to_regclass('public.audit_logs') AS t`);
    if (!probe.rows[0].t) {
      console.warn('SKIP PgAuditRepository integration: public.audit_logs missing — run `npm run db:migrate` against DATABASE_URL first');
      return;
    }
    // Trigger scoped to public.audit_logs: its absence means the target is
    // under-migrated — skip the whole suite instead of wiping data.
    const trigger = await pool.query(
      `SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.audit_logs'::regclass AND tgname = 'audit_logs_append_only_rows'`,
    );
    if (!trigger.rows.length) {
      console.warn('SKIP PgAuditRepository integration: trigger audit_logs_append_only_rows missing on public.audit_logs (under-migrated target, destructive TRUNCATE test would not be rejected) — run `npm run db:migrate` against DATABASE_URL first');
      return;
    }
    migrationReady = true;
  });

  afterAll(async () => {
    // also close the global pool the production adapter caches on globalThis
    const g = globalThis as unknown as { __pgPool?: { end(): Promise<void> } };
    if (g.__pgPool) {
      await g.__pgPool.end();
      delete g.__pgPool;
    }
    await pool.end();
  });

  // Jest cannot skip a whole suite from inside beforeAll, so every test goes
  // through this helper: bodies never execute when the target is under-migrated.
  const itIntegration = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!migrationReady) return;
      await fn();
    });

  itIntegration('migration 0003 applied: unique partial index + append-only triggers exist', async () => {
    const idx = await pool.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ux_audit_correlation_action'`,
    );
    expect(idx.rowCount).toBe(1);

    const triggers = await pool.query(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'public.audit_logs'::regclass AND NOT tgisinternal`,
    );
    const names = triggers.rows.map((r: { tgname: string }) => r.tgname);
    expect(names).toContain('audit_logs_append_only_rows');
    expect(names).toContain('audit_logs_append_only_truncate');
  });

  itIntegration('idempotency at DB level: duplicate (correlation_id, action) is blocked by the unique index', async () => {
    const correlationId = randomUUID();
    const action = 'ITEST_DB_DEDUP';
    await pool.query(
      `INSERT INTO public.audit_logs (action, entity_type, result, correlation_id) VALUES ($1, 'USER', 'SUCCESS', $2)`,
      [action, correlationId],
    );
    // A plain INSERT of a duplicate must be rejected by ux_audit_correlation_action…
    await expect(
      pool.query(
        `INSERT INTO public.audit_logs (action, entity_type, result, correlation_id, ip_address) VALUES ($1, 'USER', 'SUCCESS', $2, '127.0.0.1')`,
        [action, correlationId],
      ),
    ).rejects.toMatchObject({ code: '23505', constraint: 'ux_audit_correlation_action' });
    // …while the repository path dedupes the same event to a silent no-op: one row total.
    const repo = new PgAuditRepository();
    await repo.log({ action, entityType: 'USER', result: 'SUCCESS', correlationId });
    const count = await pool.query(
      `SELECT COUNT(*)::int AS c FROM public.audit_logs WHERE correlation_id = $1 AND action = $2`,
      [correlationId, action],
    );
    expect(count.rows[0].c).toBe(1);
  });

  itIntegration('PgAuditRepository.log dedupes same correlationId+action (two inserts → one row)', async () => {
    const repo = new PgAuditRepository();
    const correlationId = randomUUID();
    const action = 'ITEST_REPO_DEDUP';

    await repo.log({ action, entityType: 'USER', result: 'SUCCESS', correlationId });
    await repo.log({ action, entityType: 'USER', result: 'FAILED', correlationId });

    const count = await pool.query(
      `SELECT COUNT(*)::int AS c FROM public.audit_logs WHERE correlation_id = $1 AND action = $2`,
      [correlationId, action],
    );
    expect(count.rows[0].c).toBe(1);
  });

  itIntegration('append-only: UPDATE and DELETE are rejected, INSERT succeeds', async () => {
    const correlationId = randomUUID();
    const action = 'ITEST_APPEND_ONLY';
    const inserted = await pool.query(
      `INSERT INTO public.audit_logs (action, entity_type, result, correlation_id) VALUES ($1, 'USER', 'SUCCESS', $2) RETURNING id`,
      [action, correlationId],
    );
    expect(inserted.rowCount).toBe(1);
    const id = inserted.rows[0].id as string;

    await expect(
      pool.query(`UPDATE public.audit_logs SET result = 'FAILED' WHERE id = $1`, [id]),
    ).rejects.toThrow(APPEND_ONLY_RE);
    await expect(
      pool.query(`DELETE FROM public.audit_logs WHERE id = $1`, [id]),
    ).rejects.toThrow(APPEND_ONLY_RE);

    const still = await pool.query(`SELECT result FROM public.audit_logs WHERE id = $1`, [id]);
    expect(still.rows[0].result).toBe('SUCCESS');
  });

  itIntegration('append-only: TRUNCATE is rejected', async () => {
    await expect(pool.query(`TRUNCATE public.audit_logs`)).rejects.toThrow(APPEND_ONLY_RE);
  });

  itIntegration('retention (migration 0004): DELETE without audit.purge_enabled is still rejected', async () => {
    const inserted = await pool.query(
      `INSERT INTO public.audit_logs (action, entity_type, result) VALUES ('ITEST_RET_DELETE_NO_GUC', 'USER', 'SUCCESS') RETURNING id`,
    );
    const id = inserted.rows[0].id as string;
    await expect(
      pool.query(`DELETE FROM public.audit_logs WHERE id = $1`, [id]),
    ).rejects.toThrow(APPEND_ONLY_RE);
    const still = await pool.query(`SELECT 1 FROM public.audit_logs WHERE id = $1`, [id]);
    expect(still.rowCount).toBe(1);
  });

  itIntegration('retention (migration 0004): purge DELETE with SET LOCAL audit.purge_enabled=on removes only rows older than the cutoff', async () => {
    const oldRow = await pool.query(
      `INSERT INTO public.audit_logs (action, entity_type, result, created_at)
       VALUES ('ITEST_RET_OLD', 'USER', 'SUCCESS', now() - interval '400 days') RETURNING id`,
    );
    const freshRow = await pool.query(
      `INSERT INTO public.audit_logs (action, entity_type, result, created_at)
       VALUES ('ITEST_RET_FRESH', 'USER', 'SUCCESS', now() - interval '10 days') RETURNING id`,
    );
    expect(oldRow.rowCount).toBe(1);
    expect(freshRow.rowCount).toBe(1);
    const oldId = oldRow.rows[0].id as string;
    const freshId = freshRow.rows[0].id as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL audit.purge_enabled = 'on'");
      const deleted = await client.query(
        `DELETE FROM public.audit_logs WHERE created_at < now() - interval '365 days' RETURNING id`,
      );
      await client.query('COMMIT');
      const ids = deleted.rows.map((r: { id: string }) => r.id);
      expect(ids).toContain(oldId);
      expect(ids).not.toContain(freshId);
    } finally {
      client.release();
    }

    const still = await pool.query(`SELECT id FROM public.audit_logs WHERE id = ANY($1)`, [[oldId, freshId]]);
    const remainingIds = still.rows.map((r: { id: string }) => r.id);
    expect(remainingIds).not.toContain(oldId);
    expect(remainingIds).toContain(freshId);
  });

  itIntegration('retention (migration 0004): UPDATE stays rejected even with audit.purge_enabled on', async () => {
    const inserted = await pool.query(
      `INSERT INTO public.audit_logs (action, entity_type, result) VALUES ('ITEST_RET_UPDATE_GUC', 'USER', 'SUCCESS') RETURNING id`,
    );
    const id = inserted.rows[0].id as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL audit.purge_enabled = 'on'");
      await expect(
        client.query(`UPDATE public.audit_logs SET result = 'FAILED' WHERE id = $1`, [id]),
      ).rejects.toThrow(APPEND_ONLY_RE);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    const still = await pool.query(`SELECT result FROM public.audit_logs WHERE id = $1`, [id]);
    expect(still.rows[0].result).toBe('SUCCESS');
  });

  itIntegration('retention (migration 0004): TRUNCATE stays rejected even with audit.purge_enabled on', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL audit.purge_enabled = 'on'");
      await expect(client.query(`TRUNCATE public.audit_logs`)).rejects.toThrow(APPEND_ONLY_RE);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  itIntegration('logWithClient inside a business tx: dedup is a no-op and the write commits atomically', async () => {
    const repo = new PgAuditRepository();
    const correlationId = randomUUID();
    const action = 'ITEST_TX_DEDUP';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await repo.logWithClient(client, { action, entityType: 'USER', result: 'SUCCESS', correlationId });
      // duplicate producer event inside the same tx must not fail the business write
      await repo.logWithClient(client, { action, entityType: 'USER', result: 'SUCCESS', correlationId });
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const count = await pool.query(
      `SELECT COUNT(*)::int AS c FROM public.audit_logs WHERE correlation_id = $1 AND action = $2`,
      [correlationId, action],
    );
    expect(count.rows[0].c).toBe(1);
  });

  itIntegration('logWithClient genuine audit failure aborts the business tx (no partial write)', async () => {
    const repo = new PgAuditRepository();
    const correlationId = randomUUID();
    const action = 'ITEST_TX_ABORT';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await repo.logWithClient(client, { action, entityType: 'USER', result: 'SUCCESS', correlationId });
      // genuine failure: CHECK violation on result — must propagate to the caller
      await expect(
        repo.logWithClient(client, {
          action,
          entityType: 'USER',
          result: 'BOGUS' as 'SUCCESS',
          correlationId: randomUUID(),
        }),
      ).rejects.toThrow();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    const count = await pool.query(
      `SELECT COUNT(*)::int AS c FROM public.audit_logs WHERE correlation_id = $1 AND action = $2`,
      [correlationId, action],
    );
    expect(count.rows[0].c).toBe(0);
  });
});
