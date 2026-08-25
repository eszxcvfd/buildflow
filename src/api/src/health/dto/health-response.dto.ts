import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthLiveResponseDto {
  @ApiProperty({ example: 'ok', description: 'Liveness status' })
  status!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', format: 'date-time' })
  timestamp!: string;
}

export class HealthChecksDto {
  @ApiProperty({ example: 'up', enum: ['up', 'down'], description: 'Postgres status' })
  postgres!: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down'], description: 'Redis status' })
  redis!: string;
}

export class HealthReadyResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'], description: 'Overall readiness' })
  status!: string;

  @ApiProperty({ type: HealthChecksDto, description: 'Dependency checks' })
  checks!: HealthChecksDto;

  @ApiPropertyOptional({ example: 'postgres unavailable', description: 'Details when not ready' })
  details?: string;
}
