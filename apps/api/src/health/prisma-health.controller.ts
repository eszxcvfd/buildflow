import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Tiny health endpoint that proves NestJS → PrismaClient → PostgreSQL 18 works
 * end to end. Used by integration tests and as the bare-minimum OpenAPI payload.
 */
@Controller('health')
export class PrismaHealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up' | 'down' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'ok', database: 'down' };
    }
  }
}
