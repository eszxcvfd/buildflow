# DBD V2.1 baseline migration

Creates the initial 34-table PostgreSQL 18 baseline: 26 business tables and 8
system-support tables. Prisma creates `_prisma_migrations` separately; it is
not part of the DBD count.

## Preconditions

- Target database is empty except for Prisma migration history.
- PostgreSQL major version is 18.x.
- A backup exists before applying to any shared environment.

## Recovery

This migration is forward-only and intentionally has no automated down
migration. If it fails on a new local database, fix the migration before it is
shared, recreate that empty local database, and run `prisma migrate deploy`
again. For any shared or populated environment, restore the pre-migration
backup instead of dropping tables manually.

## Verification

- Confirm migration status is up to date.
- Confirm exactly 34 non-framework tables exist in the `public` schema.
- Run the API integration suite, including Assignment and Blocker constraint
  proofs.
