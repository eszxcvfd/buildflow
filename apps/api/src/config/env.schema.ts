/**
 * Zod-based request schema mirror used by NestJS ConfigModule for environment
 * validation. Kept separate from `loadEnv` so the @nestjs/config `validationSchema`
 * hook can use plain Joi-like shape while `loadEnv` returns a fully typed object.
 */
import { z } from 'zod';

const numString = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .pipe(z.number().int().positive());

export const configValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: numString(3000),
  API_GLOBAL_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().optional().default(''),
  MINIO_PORT: numString(9000),
  MINIO_ACCESS_KEY: z.string().optional().default(''),
  MINIO_SECRET_KEY: z.string().optional().default(''),
});
