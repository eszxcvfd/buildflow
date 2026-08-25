import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { StatusModule } from './status/status.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProblemDetailsFilter } from './shared/filters/problem-details.filter';

@Module({
  imports: [PrismaModule, HealthModule, StatusModule, AuthModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
