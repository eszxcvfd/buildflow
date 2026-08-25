import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';
import { ProblemDetailsFilter } from './shared/filters/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = loadConfig();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  // OpenAPI generation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Buildflow API')
    .setDescription('Buildflow API — Worker self-claim slice')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'opaque' }, 'bearer')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Persist openapi.json for web typed client generation (when running generate:openapi)
  if (process.argv.includes('--generate-openapi')) {
    const outPath = join(__dirname, '..', 'openapi.json');
    try {
      mkdirSync(join(__dirname, '..'), { recursive: true });
      writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');
      console.log(`OpenAPI written to ${outPath}`);
    } catch (e) {
      console.error('Failed to write OpenAPI', e);
    }
    // If invoked purely for generation, exit after write (used by generate:openapi script via ts-node)
    if (process.env.GENERATE_OPENAPI_ONLY === '1') {
      process.exit(0);
    }
  }

  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on port ${config.port}`);
}

void bootstrap();
