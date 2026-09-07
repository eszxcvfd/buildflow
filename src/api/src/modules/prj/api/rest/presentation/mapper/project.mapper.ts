import { ProjectEntity } from '../../../../domain/entity/project.entity';
import { ProjectProfileDto } from '../dto/project.dto';

/**
 * PRJ-SRS-001 (issue #32) — map entity sang ProjectProfileDto (P8).
 * `projects` không có cột `updated_by` (DDL migration 0001, P7 không migration
 * mới) nên `updatedBy` = actor của write hiện tại (PATCH) hoặc `createdBy`
 * (CREATE) — xem ENDPOINTS.md §10 P6.
 */
export function toProjectProfileResponse(
  entity: ProjectEntity,
  managerName: string | null,
  updatedBy: string,
): ProjectProfileDto {
  const pub = entity.toPublic();
  return {
    id: pub.id,
    code: pub.code,
    name: pub.name,
    description: pub.description,
    address: pub.address,
    timezone: pub.timezone,
    plannedStartDate: pub.plannedStartDate,
    plannedEndDate: pub.plannedEndDate,
    managerId: pub.managerId,
    managerName,
    status: pub.status,
    createdBy: pub.createdBy,
    createdAt: pub.createdAt.toISOString(),
    updatedBy,
    updatedAt: pub.updatedAt.toISOString(),
  };
}
