import { ProjectEntity } from '../../../../domain/entity/project.entity';
import { ProjectResponseDto } from '../dto/project.dto';

export function toProjectResponse(entity: ProjectEntity): ProjectResponseDto {
  const p = entity.getProps();
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    status: p.status,
    managerId: p.managerId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toProjectListResponse(entities: ProjectEntity[]): ProjectResponseDto[] {
  return entities.map(toProjectResponse);
}
