import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  CORS_ORIGINS: z.string().min(1),
  DATABASE_URL: z.string().url(),
  MINIO_ENDPOINT: z.string().optional().default(''),
  MINIO_PORT: z.coerce.number().int().positive(),
  MINIO_ACCESS_KEY: z.string().optional().default(''),
  MINIO_SECRET_KEY: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export type ProcessEnv = Record<string, string | undefined>;

export function loadEnv(source: ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${issues}`);
  }
  return parsed.data;
}
