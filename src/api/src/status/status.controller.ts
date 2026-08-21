import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/status')
export class StatusController {
  @Get()
  getStatus() {
    return {
      status: 'ok',
      version: 'v1',
      service: 'buildflow-api',
      timestamp: new Date().toISOString(),
    };
  }
}
