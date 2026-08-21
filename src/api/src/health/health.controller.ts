import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async readiness(@Res() res: Response) {
    const result = await this.healthService.checkReadiness();
    if (result.status === 'ok') {
      return res.status(200).json(result);
    }
    return res.status(503).json(result);
  }
}
