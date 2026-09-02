import { Controller, Get } from '@nestjs/common';
import { API_GLOBAL_PREFIX } from './config/api.constants';

@Controller()
export class AppController {
  @Get('/')
  root(): { name: string; apiPrefix: string } {
    return { name: 'buildflow-api', apiPrefix: API_GLOBAL_PREFIX };
  }
}
