import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

async function bootstrap() {
  // Load & validate config first: in production a missing/weak JWT_SECRET must
  // abort boot before Nest even starts creating providers.
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:19006', 'http://localhost:19007'],
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on port ${config.port}`);
}

void bootstrap();
