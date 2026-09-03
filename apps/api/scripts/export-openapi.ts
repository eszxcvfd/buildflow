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
import { AuthController } from '../src/modules/iam/api/rest/controller/auth.controller';
import { LoginUseCase } from '../src/modules/iam/application/use-case/login.use-case';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user.repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { TOKEN_PORT } from '../src/modules/iam/application/port/token.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { LOGIN_LIMITER_PORT } from '../src/modules/iam/application/port/login-limiter.port';
import { PrismaService } from '../src/database/prisma.service';
import { API_GLOBAL_PREFIX } from '../src/config/api.constants';

@Module({
  controllers: [AppController, HealthController, AuthController],
  providers: [
    { provide: PrismaService, useValue: {} },
    LoginUseCase,
    { provide: USER_REPOSITORY, useValue: { findByEmail: async () => null } },
    { provide: HASHER_PORT, useValue: { compare: async () => false } },
    { provide: TOKEN_PORT, useValue: { sign: async () => ({ token: '', expiresAt: new Date() }) } },
    { provide: AUDIT_PORT, useValue: { log: async () => {} } },
    { provide: LOGIN_LIMITER_PORT, useValue: { isBlocked: async () => false, recordFailure: async () => {}, reset: async () => {} } },
  ],
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
