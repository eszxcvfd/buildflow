/**
 * Export the NestJS OpenAPI document to `apps/api/openapi.json`.
 *
 * Run with:
 *   pnpm --filter @buildflow/api openapi:export
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function main(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
  const app = await NestFactory.create(AppModule, { logger: false });
  const prefix = (process.env.API_GLOBAL_PREFIX ?? '/api/v1').replace(/^\//, '');
  app.setGlobalPrefix(prefix);

  const config = new DocumentBuilder()
    .setTitle('BuildFlow API')
    .setDescription('BuildFlow REST API — technical foundation document.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const out = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(out, JSON.stringify(document, null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out}`);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('OpenAPI export failed:', err);
  process.exit(1);
});
