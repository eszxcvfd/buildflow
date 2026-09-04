#!/usr/bin/env node
'use strict';

/**
 * DEV/DEMO/E2E ONLY — IAM-SRS-007 operator helper.
 *
 * Issues a password-reset token for a given email directly in the database and
 * prints the RAW token + reset link. This bypasses the API entirely.
 *
 * Requirements / caveats:
 *  - Needs DIRECT database access (DATABASE_URL) and should never be run in production.
 *  - The API response contract never exposes reset URLs; this script exists only so
 *    demo/E2E environments without a mail provider can complete the reset flow.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/dev-issue-reset-token.js --email user@example.com
 *   (or: npm run dev:reset-token -- --email user@example.com)
 *
 * Env: DATABASE_URL (same contract as scripts/migrate.js), optional RESET_WEB_BASE_URL
 * (defaults to http://localhost:3001), optional RESET_TOKEN_TTL_MINUTES (defaults to 30).
 */

const { createHash, randomBytes } = require('node:crypto');
const { Client } = require('pg');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email') {
      const value = argv[i + 1];
      if (!value) throw new Error('--email requires a value');
      args.email = String(value).trim().toLowerCase();
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.email) {
    console.log('Usage: node scripts/dev-issue-reset-token.js --email <email>');
    process.exitCode = args.help ? 0 : 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required (same contract as scripts/migrate.js)');
  }

  const ttlMinutes = parseInt(process.env.RESET_TOKEN_TTL_MINUTES ?? '30', 10);
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
    throw new Error(`Invalid RESET_TOKEN_TTL_MINUTES: ${process.env.RESET_TOKEN_TTL_MINUTES}`);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");

    const userResult = await client.query(
      'SELECT id, email, status FROM public.users WHERE lower(email) = $1 ORDER BY created_at LIMIT 1',
      [args.email],
    );
    const user = userResult.rows[0];
    if (!user) {
      // Demo tool: unlike the API, here we can be explicit — the operator chose the email.
      throw new Error(`No user found with email ${args.email}`);
    }
    if (user.status !== 'ACTIVE') {
      throw new Error(`User ${args.email} is not ACTIVE (status=${user.status}); reset flow would reject the token.`);
    }

    // 24 bytes = 192 bits of entropy, hex-encoded (48 chars) — identical shape to the API path.
    const rawToken = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const inserted = await client.query(
      `INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, expires_at`,
      [user.id, tokenHash, expiresAt],
    );

    const webBase = (process.env.RESET_WEB_BASE_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
    const resetUrl = `${webBase}/reset-password?token=${rawToken}`;

    console.log('Password reset token issued (DEMO/E2E ONLY):');
    console.log(`  user_id    : ${user.id}`);
    console.log(`  email      : ${user.email}`);
    console.log(`  token id   : ${inserted.rows[0].id}`);
    console.log(`  expires_at : ${new Date(inserted.rows[0].expires_at).toISOString()} (${ttlMinutes} minutes)`);
    console.log(`  raw token  : ${rawToken}`);
    console.log(`  reset link : ${resetUrl}`);
    console.log('The raw token is printed once and stored only as a SHA-256 hash — treat it like a password.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
