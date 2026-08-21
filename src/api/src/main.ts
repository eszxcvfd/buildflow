import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = loadConfig();
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on port ${config.port}`);
}

void bootstrap();
