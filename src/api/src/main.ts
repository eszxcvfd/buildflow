import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

export function createOpenApiDocument(app: Parameters<typeof SwaggerModule.createDocument>[0]) {
  const config = new DocumentBuilder()
    .setTitle('Buildflow API')
    .setDescription('Buildflow modular monolith API')
    .setVersion('v1')
    .build();
  return SwaggerModule.createDocument(app, config);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = loadConfig();
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on port ${config.port}`);
}

if (require.main === module) {
  void bootstrap();
}
