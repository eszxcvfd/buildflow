import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';
import { IamModule } from './modules/iam/iam.module';
import { OrgModule } from './modules/org/org.module';

@Module({
  imports: [HealthModule, StatusModule, IamModule, OrgModule],
})
export class AppModule {}
