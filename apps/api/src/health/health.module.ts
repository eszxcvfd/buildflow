import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaHealthController } from './prisma-health.controller';

@Module({
  controllers: [HealthController, PrismaHealthController],
})
export class HealthModule {}
