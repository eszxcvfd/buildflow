import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';

@Module({
  imports: [HealthModule, StatusModule],
})
export class AppModule {}
