import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { loadEnv } from './config/env';
import { configValidationSchema } from './config/env.schema';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: (rawEnv) => loadEnv(rawEnv),
      validationSchema: configValidationSchema,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [ConfigService],
})
export class AppModule {}
