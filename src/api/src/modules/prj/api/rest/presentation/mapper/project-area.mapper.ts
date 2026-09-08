import { ProjectAreaRow } from '../../../../domain/repository/project-repository.port';
import { ProjectAreaDto } from '../dto/project-area.dto';

export interface ProjectAreaResponseOptions {
  warning?: string;
  usage?: { workOrders: number };
  alreadyInactive?: boolean;
}

/**
 * PRJ-SRS-003 (issue #34, A1) — map `ProjectAreaRow` sang `ProjectAreaDto`.
 * `createdAt`/`updatedAt` là timestamptz → ISO string.
 * PRJ-SRS-007 (issue #38) — kèm `usage`/`warning` khi retire (mirror
 * work-types #35) + `alreadyInactive` idempotent flag.
 */
export function toProjectAreaResponse(
  row: ProjectAreaRow,
  options?: ProjectAreaResponseOptions,
): ProjectAreaDto {
  const response: ProjectAreaDto = {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (options?.usage) response.usage = options.usage;
  if (options?.warning) response.warning = options.warning;
  if (options?.alreadyInactive !== undefined) response.alreadyInactive = options.alreadyInactive;
  return response;
}

export function toProjectAreaListResponse(rows: ProjectAreaRow[]): ProjectAreaDto[] {
  return rows.map((row) => toProjectAreaResponse(row));
}
