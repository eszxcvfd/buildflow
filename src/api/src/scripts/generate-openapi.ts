import './env';
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../main';
import { PrismaService } from '../prisma/prisma.service';

async function main() {
  // Avoid DB connection during generation — PrismaService.onModuleInit would try to $connect
  PrismaService.prototype.onModuleInit = async () => {};
  PrismaService.prototype.onModuleDestroy = async () => {};

  const app = await NestFactory.create(AppModule, { logger: false });
  const document = createOpenApiDocument(app);
  await app.close();

  const outputPath = path.resolve(__dirname, '../../openapi.json');
  const json = JSON.stringify(document, null, 2) + '\n';
  fs.writeFileSync(outputPath, json, 'utf8');
  console.log(`OpenAPI document written to ${outputPath}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
