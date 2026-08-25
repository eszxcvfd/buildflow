import { ApiProperty } from '@nestjs/swagger';

export class StatusResponseDto {
  @ApiProperty({ example: 'ok', description: 'Service status' })
  status!: string;

  @ApiProperty({ example: 'v1', description: 'API version' })
  version!: string;

  @ApiProperty({ example: 'buildflow-api', description: 'Service name' })
  service!: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', format: 'date-time', description: 'Current timestamp ISO 8601 UTC' })
  timestamp!: string;
}
