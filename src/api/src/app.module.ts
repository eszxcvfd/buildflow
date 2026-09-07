import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';
import { IamModule } from './modules/iam/iam.module';
import { OrgModule } from './modules/org/org.module';
import { PrjModule } from './modules/prj/prj.module';
import { TokenRevocationModule } from './modules/iam/infrastructure/security/token-revocation.module';

@Module({
  // TokenRevocationModule is @Global(): one shared InMemoryTokenRevocationService
  // instance for both IamModule and OrgModule (IAM-SRS-007).
  imports: [HealthModule, StatusModule, TokenRevocationModule, IamModule, OrgModule, PrjModule],
})
export class AppModule {}
