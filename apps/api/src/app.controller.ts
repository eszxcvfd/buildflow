import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('/')
  root(): { name: string; apiPrefix: string } {
    return { name: 'buildflow-api', apiPrefix: '/api/v1' };
  }
}
