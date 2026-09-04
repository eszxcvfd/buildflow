import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:19006', 'http://localhost:19007'],
    credentials: true,
  });
  const config = loadConfig();
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on port ${config.port}`);
}

void bootstrap();
