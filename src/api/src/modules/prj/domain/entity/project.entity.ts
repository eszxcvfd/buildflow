import {
  assertPlannedDates,
  normalizeProjectAddress,
  normalizeProjectCode,
  normalizeProjectDescription,
  normalizeProjectName,
  normalizeProjectTimezone,
  PROJECT_STATUSES,
  ProjectStatus,
} from '../service/project.policy';

export type { ProjectStatus };

export interface ProjectProps {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  address: string;
  timezone: string;
  plannedStartDate: string;
  plannedEndDate: string;
  managerId: string;
  status: ProjectStatus;
  createdBy: string;
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
 * PRJ-SRS-001 (issue #32) — Project aggregate cho write slice.
 * Invariant nằm ở entity (code format, required fields, planned dates);
 * `code` bất biến sau tạo (không có setter); `status` chỉ đổi qua
 * lifecycle slice #33 (không có transition method ở đây).
 */
export class ProjectEntity {
  constructor(private props: ProjectProps) {
    if (!UUID_RE.test(this.props.id)) throw new Error('ID dự án không hợp lệ');
    this.props.code = normalizeProjectCode(this.props.code);
    this.props.name = normalizeProjectName(this.props.name);
    this.props.description = normalizeProjectDescription(this.props.description);
    this.props.address = normalizeProjectAddress(this.props.address);
    this.props.timezone = normalizeProjectTimezone(this.props.timezone);
    assertPlannedDates(this.props.plannedStartDate, this.props.plannedEndDate);
    this.props.managerId = assertUuid(this.props.managerId, 'Quản lý dự án không hợp lệ');
    if (!PROJECT_STATUSES.includes(this.props.status)) {
      throw new Error('Trạng thái dự án không hợp lệ');
    }
    this.props.createdBy = assertUuid(this.props.createdBy, 'Người tạo không hợp lệ');
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description ?? null; }
  get address(): string { return this.props.address; }
  get timezone(): string { return this.props.timezone; }
  get plannedStartDate(): string { return this.props.plannedStartDate; }
  get plannedEndDate(): string { return this.props.plannedEndDate; }
  get managerId(): string { return this.props.managerId; }
  get status(): ProjectStatus { return this.props.status; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  /**
   * PATCH whitelist (P3): name, description, address, timezone,
   * plannedStartDate, plannedEndDate, managerId. `code`/`status`
   * không bao giờ đổi qua đây (use case chặn trước với 400 fieldErrors).
   */
  updateDetails(
    input: {
      name?: string;
      description?: string | null;
      address?: string;
      timezone?: string;
      plannedStartDate?: string;
      plannedEndDate?: string;
      managerId?: string;
    },
    now: Date = new Date(),
  ): void {
    if (input.name !== undefined) this.props.name = normalizeProjectName(input.name);
    if (input.description !== undefined) this.props.description = normalizeProjectDescription(input.description);
    if (input.address !== undefined) this.props.address = normalizeProjectAddress(input.address);
    if (input.timezone !== undefined) this.props.timezone = normalizeProjectTimezone(input.timezone);
    const nextStart = input.plannedStartDate !== undefined ? input.plannedStartDate : this.props.plannedStartDate;
    const nextEnd = input.plannedEndDate !== undefined ? input.plannedEndDate : this.props.plannedEndDate;
    if (input.plannedStartDate !== undefined || input.plannedEndDate !== undefined) {
      assertPlannedDates(nextStart, nextEnd);
      this.props.plannedStartDate = nextStart;
      this.props.plannedEndDate = nextEnd;
    }
    if (input.managerId !== undefined) {
      this.props.managerId = assertUuid(input.managerId, 'Quản lý dự án không hợp lệ');
    }
    this.props.updatedAt = now;
  }

  getProps(): ProjectProps {
    return { ...this.props };
  }

  toPublic(): {
    id: string;
    code: string;
    name: string;
    description: string | null;
    address: string;
    timezone: string;
    plannedStartDate: string;
    plannedEndDate: string;
    managerId: string;
    status: ProjectStatus;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.description,
      address: this.props.address,
      timezone: this.props.timezone,
      plannedStartDate: this.props.plannedStartDate,
      plannedEndDate: this.props.plannedEndDate,
      managerId: this.props.managerId,
      status: this.props.status,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
