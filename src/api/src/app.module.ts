import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';
import { IamModule } from './modules/iam/iam.module';

@Module({
  imports: [HealthModule, StatusModule, IamModule],
})
export class AppModule {}
