import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { API_GLOBAL_PREFIX } from './config/api.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  const config = app.get<ConfigService<AppConfig>>(ConfigService);
  const prefix = API_GLOBAL_PREFIX;
  app.setGlobalPrefix(prefix.replace(/^\//, ''));
  app.enableCors({
    origin: config.getOrThrow('corsOrigins', { infer: true }),
    credentials: true,
  });

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

  const port = config.getOrThrow('port', { infer: true });
  const host = config.getOrThrow('host', { infer: true });
  await app.listen(port, host);
  logger.log(`BuildFlow API listening on http://${host}:${port}${prefix}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start BuildFlow API:', err);
  process.exit(1);
});
