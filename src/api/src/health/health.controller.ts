import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthLiveResponseDto, HealthReadyResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe', description: 'Returns ok if process is alive' })
  @ApiResponse({ status: 200, description: 'Liveness status', type: HealthLiveResponseDto })
  liveness(): HealthLiveResponseDto {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe', description: 'Checks Postgres and Redis connectivity' })
  @ApiResponse({ status: 200, description: 'Ready', type: HealthReadyResponseDto })
  @ApiResponse({ status: 503, description: 'Not ready', type: HealthReadyResponseDto })
  async readiness(@Res() res: Response) {
    const result = await this.healthService.checkReadiness();
    if (result.status === 'ok') {
      return res.status(200).json(result);
    }
    return res.status(503).json(result);
  }
}
