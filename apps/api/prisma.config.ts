import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { PrismaPgAdapter } from '@prisma/adapter-pg';

/**
 * Prisma 7 configuration: connection lives here so it does not need to be
 * hard-coded in `schema.prisma`. The adapter is shared between the Migrate
 * CLI and the runtime `PrismaClient`.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  adapter: () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for Prisma Migrate.');
    }
    return new PrismaPgAdapter({ connectionString: process.env.DATABASE_URL });
  },
});
