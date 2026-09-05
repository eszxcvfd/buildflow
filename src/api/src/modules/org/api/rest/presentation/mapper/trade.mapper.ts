import { TradeEntity } from '../../../../domain/entity/trade.entity';
import { TradeResponseDto } from '../dto/trade.dto';

export function toTradeResponse(entity: TradeEntity, warning?: string): TradeResponseDto {
  const pub = entity.toPublic();
  const response: TradeResponseDto = {
    id: pub.id,
    code: pub.code,
    name: pub.name,
    description: pub.description,
    status: pub.status,
    assignable: pub.assignable,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
  if (warning) response.warning = warning;
  return response;
}

export function toTradeListResponse(entities: TradeEntity[]): TradeResponseDto[] {
  return entities.map((entity) => toTradeResponse(entity));
}
