import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  const config = app.get<ConfigService<AppConfig>>(ConfigService);
  const prefix = config.get('apiPrefix', { infer: true }) ?? '/api/v1';
  app.setGlobalPrefix(prefix.replace(/^\//, ''));

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();

  if (config.get('nodeEnv', { infer: true }) === 'development') {
    const openapi = new DocumentBuilder()
      .setTitle('BuildFlow API')
      .setDescription('Technical foundation. Business endpoints land later.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, openapi);
    SwaggerModule.setup(`${prefix.replace(/^\//, '')}/_docs`, app, document);
  }

  const port = config.get('port', { infer: true }) ?? 3000;
  await app.listen(port);
  logger.log(`BuildFlow API listening on http://localhost:${port}${prefix}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start BuildFlow API:', err);
  process.exit(1);
});
