/**
 * Export the NestJS OpenAPI document to `apps/api/openapi.json`.
 *
 * Run with:
 *   pnpm --filter @buildflow/api openapi:export
 *
 * This script boots the app without booting PrismaModule so it can run
 * without a reachable database.
 */
import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { HealthController } from '../src/health/health.controller';
import { AppController } from '../src/app.controller';
import { PrismaService } from '../src/database/prisma.service';
import { API_GLOBAL_PREFIX } from '../src/config/api.constants';

@Module({
  controllers: [AppController, HealthController],
  providers: [{ provide: PrismaService, useValue: {} }],
})
class OpenapiOnlyModule {}

async function main(): Promise<void> {
  const app = await NestFactory.create(OpenapiOnlyModule, { logger: false });
  const prefix = API_GLOBAL_PREFIX.replace(/^\//, '');
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
  console.log(`Wrote ${out}`);
}

main().catch((err: unknown) => {
  console.error('OpenAPI export failed:', err);
  process.exit(1);
});
