/**
 * Zod-based request schema mirror used by NestJS ConfigModule for environment
 * validation. Kept separate from `loadEnv` so the @nestjs/config `validationSchema`
 * hook can use plain Joi-like shape while `loadEnv` returns a fully typed object.
 */
import { z } from 'zod';

const numString = z
  .string()
  .transform(Number)
  .pipe(z.number().int().positive());

export const configValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  HOST: z.string().min(1),
  PORT: numString,
  CORS_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().optional().default(''),
  MINIO_PORT: numString,
  MINIO_ACCESS_KEY: z.string().optional().default(''),
  MINIO_SECRET_KEY: z.string().optional().default(''),
});
