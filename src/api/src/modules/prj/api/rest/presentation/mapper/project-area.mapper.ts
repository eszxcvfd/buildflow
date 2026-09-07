import { ProjectAreaRow } from '../../../../domain/repository/project-repository.port';
import { ProjectAreaDto } from '../dto/project-area.dto';

/**
 * PRJ-SRS-003 (issue #34, A1) — map `ProjectAreaRow` sang `ProjectAreaDto`.
 * `createdAt`/`updatedAt` là timestamptz → ISO string.
 */
export function toProjectAreaResponse(row: ProjectAreaRow): ProjectAreaDto {
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProjectAreaListResponse(rows: ProjectAreaRow[]): ProjectAreaDto[] {
  return rows.map(toProjectAreaResponse);
}
