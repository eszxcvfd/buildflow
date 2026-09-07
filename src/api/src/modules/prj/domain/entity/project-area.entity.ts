import {
  normalizeProjectAreaCode,
  normalizeProjectAreaName,
} from '../service/project-area.policy';

export interface ProjectAreaProps {
  id: string;
  projectId: string;
  code: string | null;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, message: string): string {
  const trimmed = String(value).trim();
  if (!UUID_RE.test(trimmed)) throw new Error(message);
  return trimmed;
}

/**
 * PRJ-SRS-003 (issue #34) — ProjectArea aggregate (một cấp duy nhất).
 * Không có parent/không có setter đổi project — rename đổi tên tại chỗ
 * (giữ lịch sử work order tham chiếu `area_id`), toggle active là đường
 * retire duy nhất (không hard delete).
 */
export class ProjectAreaEntity {
  constructor(private props: ProjectAreaProps) {
    if (!UUID_RE.test(String(this.props.id))) throw new Error('ID khu vực không hợp lệ');
    this.props.projectId = assertUuid(this.props.projectId, 'ID dự án không hợp lệ');
    this.props.code = normalizeProjectAreaCode(this.props.code);
    this.props.name = normalizeProjectAreaName(this.props.name);
  }

  get id(): string { return this.props.id; }
  get projectId(): string { return this.props.projectId; }
  get code(): string | null { return this.props.code; }
  get name(): string { return this.props.name; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /** Rename tại chỗ (không đụng `area_id` history của work order tương lai). */
  rename(name: string, now: Date = new Date()): void {
    this.props.name = normalizeProjectAreaName(name);
    this.props.updatedAt = now;
  }

  /** Đổi mã tại chỗ (null = gỡ mã). */
  changeCode(code: string | null, now: Date = new Date()): void {
    this.props.code = normalizeProjectAreaCode(code);
    this.props.updatedAt = now;
  }

  /** Bật/tắt hoạt động (retire/mở lại). Deactivate khi đã inactive do use case xử lý idempotent. */
  changeActive(isActive: boolean, now: Date = new Date()): void {
    this.props.isActive = isActive;
    this.props.updatedAt = now;
  }

  getProps(): ProjectAreaProps {
    return { ...this.props };
  }

  toPublic(): {
    id: string;
    projectId: string;
    code: string | null;
    name: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      code: this.props.code,
      name: this.props.name,
      isActive: this.props.isActive,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
