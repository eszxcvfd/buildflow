import { ProjectMemberRow } from '../../../../domain/repository/project-repository.port';
import { ProjectMemberDto } from '../dto/project-member.dto';

/**
 * PRJ-SRS-005 (issue #36, M1) — map `ProjectMemberRow` sang `ProjectMemberDto`.
 * `joinedAt`/`leftAt` là timestamptz → ISO string; `createdAt` = `joined_at`
 * (bảng `project_members` không có cột `created_at` riêng).
 */
export function toProjectMemberResponse(row: ProjectMemberRow): ProjectMemberDto {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName ?? null,
    userCode: row.userCode ?? null,
    projectRole: row.projectRole,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt ? row.leftAt.toISOString() : null,
    isActive: row.isActive,
    addedBy: row.addedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toProjectMemberListResponse(rows: ProjectMemberRow[]): ProjectMemberDto[] {
  return rows.map(toProjectMemberResponse);
}
