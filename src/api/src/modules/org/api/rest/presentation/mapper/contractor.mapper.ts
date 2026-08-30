import { ContractorEntity } from '../../../../domain/entity/contractor.entity';
import { ContractorResponseDto } from '../dto/contractor.dto';

export function toContractorResponse(entity: ContractorEntity): ContractorResponseDto {
  const pub = entity.toPublic();
  return {
    id: pub.id,
    code: pub.code,
    name: pub.name,
    contactName: pub.contactName,
    phone: pub.phone,
    email: pub.email,
    status: pub.status,
    scope: pub.scope,
    eligible: pub.eligible,
    createdBy: pub.createdBy,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
}

export function toContractorListResponse(entities: ContractorEntity[]): ContractorResponseDto[] {
  return entities.map(toContractorResponse);
}
