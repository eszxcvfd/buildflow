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
    // Cho phép mọi origin loopback (localhost/127.0.0.1/[::1], mọi port) để
    // tránh lỗi CORS khi truy cập web qua 127.0.0.1 thay vì localhost.
    origin: [/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/],
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on port ${config.port}`);
}

void bootstrap();
