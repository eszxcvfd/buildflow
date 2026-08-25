import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { StatusResponseDto } from './dto/status-response.dto';

@ApiTags('status')
@Controller('api/v1/status')
export class StatusController {
  @Get()
  @ApiOperation({ summary: 'Get API status', description: 'Returns service status and version' })
  @ApiResponse({ status: 200, description: 'API status', type: StatusResponseDto })
  getStatus(): StatusResponseDto {
    return {
      status: 'ok',
      version: 'v1',
      service: 'buildflow-api',
      timestamp: new Date().toISOString(),
    };
  }
}
