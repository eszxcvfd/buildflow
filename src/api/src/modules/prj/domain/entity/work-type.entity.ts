import {
  RequiredFieldConfig,
  WorkTypePriority,
  normalizeWorkTypeCode,
  normalizeWorkTypeDescription,
  normalizeWorkTypeDuration,
  normalizeWorkTypeGroup,
  normalizeWorkTypeName,
  normalizeWorkTypePriority,
} from '../service/work-type.policy';

export type WorkTypeStatus = 'ACTIVE' | 'INACTIVE';

export interface WorkTypeProps {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** Nhóm công việc (`work_type_group`, migration 0007) — label optional, không CRUD riêng. */
  group: string | null;
  /** Skill/ngành nghề yêu cầu (`required_trade_id`, baseline đã có) — null = không yêu cầu. */
  requiredTradeId: string | null;
  /** Danh sách dữ liệu bắt buộc (`required_fields` jsonb, migration 0007). */
  requiredFields: RequiredFieldConfig[];
  /** Version cấu hình (`config_version`, migration 0007) — optimistic locking. */
  configVersion: number;
  /** Cột baseline 0001 — expose nguyên trạng, không CRUD riêng. */
  defaultDurationMinutes: number | null;
  /** Cột baseline 0001 — expose nguyên trạng, không CRUD riêng. */
  defaultPriority: WorkTypePriority;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class WorkTypeEntity {
  constructor(private props: WorkTypeProps) {
    if (!UUID_RE.test(this.props.id)) {
      throw new Error('ID loại công việc không hợp lệ');
    }
    this.props.code = normalizeWorkTypeCode(this.props.code);
    this.props.name = normalizeWorkTypeName(this.props.name);
    this.props.description = normalizeWorkTypeDescription(this.props.description);
    this.props.group = normalizeWorkTypeGroup(this.props.group);
    if (!Array.isArray(this.props.requiredFields)) {
      throw new Error('Danh sách dữ liệu bắt buộc phải là mảng');
    }
    if (!Number.isInteger(this.props.configVersion) || this.props.configVersion < 1) {
      throw new Error('Version cấu hình không hợp lệ');
    }
    this.props.defaultDurationMinutes = normalizeWorkTypeDuration(this.props.defaultDurationMinutes);
    this.props.defaultPriority = normalizeWorkTypePriority(this.props.defaultPriority);
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get group(): string | null { return this.props.group; }
  get requiredTradeId(): string | null { return this.props.requiredTradeId; }
  get requiredFields(): RequiredFieldConfig[] { return [...this.props.requiredFields]; }
  get configVersion(): number { return this.props.configVersion; }
  get defaultDurationMinutes(): number | null { return this.props.defaultDurationMinutes; }
  get defaultPriority(): WorkTypePriority { return this.props.defaultPriority; }
  get isActive(): boolean { return this.props.isActive === true; }
  get status(): WorkTypeStatus { return this.props.isActive === true ? 'ACTIVE' : 'INACTIVE'; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // PRJ-SRS-004: catalog ngừng hiệu lực không dùng cho Work Order mới
  // (picker chỉ liệt kê active); dữ liệu cũ vẫn đọc được chi tiết.
  isUsableForNewWorkOrder(): boolean { return this.props.isActive === true; }
  isActiveStatus(): boolean { return this.props.isActive === true; }

  /**
   * Cập nhật cấu hình tại chỗ (giữ nguyên id — lịch sử `work_orders.work_type_id`
   * không bị đổi). Trả true khi một field thuộc version bust (code/name/group/
   * requiredTradeId/requiredFields) thật sự đổi — caller quyết định bump version.
   */
  applyConfigUpdate(
    input: {
      code?: string;
      name?: string;
      description?: string | null;
      group?: string | null;
      requiredTradeId?: string | null;
      requiredFields?: RequiredFieldConfig[];
      defaultDurationMinutes?: number | null;
      defaultPriority?: WorkTypePriority;
    },
    now: Date = new Date(),
  ): boolean {
    let versionRelevantChange = false;
    if (input.code !== undefined) {
      const next = normalizeWorkTypeCode(input.code);
      if (next !== this.props.code) {
        this.props.code = next;
        versionRelevantChange = true;
      }
    }
    if (input.name !== undefined) {
      const next = normalizeWorkTypeName(input.name);
      if (next !== this.props.name) {
        this.props.name = next;
        versionRelevantChange = true;
      }
    }
    if (input.description !== undefined) {
      this.props.description = normalizeWorkTypeDescription(input.description);
    }
    if (input.group !== undefined) {
      const next = normalizeWorkTypeGroup(input.group);
      if (next !== this.props.group) {
        this.props.group = next;
        versionRelevantChange = true;
      }
    }
    if (input.requiredTradeId !== undefined) {
      const next = input.requiredTradeId === null ? null : String(input.requiredTradeId).trim() || null;
      if (next !== this.props.requiredTradeId) {
        this.props.requiredTradeId = next;
        versionRelevantChange = true;
      }
    }
    if (input.requiredFields !== undefined) {
      if (JSON.stringify(input.requiredFields) !== JSON.stringify(this.props.requiredFields)) {
        this.props.requiredFields = [...input.requiredFields];
        versionRelevantChange = true;
      }
    }
    if (input.defaultDurationMinutes !== undefined) {
      this.props.defaultDurationMinutes = normalizeWorkTypeDuration(input.defaultDurationMinutes);
    }
    if (input.defaultPriority !== undefined) {
      this.props.defaultPriority = normalizeWorkTypePriority(input.defaultPriority);
    }
    this.props.updatedAt = now;
    if (versionRelevantChange) {
      this.props.configVersion += 1;
    }
    return versionRelevantChange;
  }

  changeStatus(newStatus: WorkTypeStatus, now: Date = new Date()): void {
    if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
      throw new Error('Trạng thái loại công việc không hợp lệ');
    }
    if ((newStatus === 'ACTIVE') === this.isActive) {
      throw new Error(`Loại công việc đã ở trạng thái ${newStatus}`);
    }
    this.props.isActive = newStatus === 'ACTIVE';
    this.props.updatedAt = now;
  }

  getProps(): WorkTypeProps {
    return { ...this.props, requiredFields: [...this.props.requiredFields] };
  }

  toPublic(): {
    id: string;
    code: string;
    name: string;
    description: string | null;
    group: string | null;
    requiredTradeId: string | null;
    requiredFields: RequiredFieldConfig[];
    configVersion: number;
    defaultDurationMinutes: number | null;
    defaultPriority: WorkTypePriority;
    status: WorkTypeStatus;
    usableForNewWorkOrder: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.props.description,
      group: this.props.group,
      requiredTradeId: this.props.requiredTradeId,
      requiredFields: [...this.props.requiredFields],
      configVersion: this.props.configVersion,
      defaultDurationMinutes: this.props.defaultDurationMinutes,
      defaultPriority: this.props.defaultPriority,
      status: this.status,
      usableForNewWorkOrder: this.isUsableForNewWorkOrder(),
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
