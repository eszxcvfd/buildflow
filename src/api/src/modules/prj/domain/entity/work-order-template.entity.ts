import {
  ChecklistSnapshotItem,
  RequiredSkillRef,
  WoTemplatePriority,
  WoTemplateStatus,
  normalizeWoTemplateCode,
  normalizeWoTemplateDescription,
  normalizeWoTemplateDuration,
  normalizeWoTemplateName,
  normalizeWoTemplatePriority,
} from '../service/work-order-template.policy';

export interface WorkOrderTemplateProps {
  id: string;
  code: string;
  name: string;
  description: string | null;
  workTypeId: string | null;
  requiredTradeId: string | null;
  defaultDurationMinutes: number | null;
  defaultPriority: WoTemplatePriority;
  requiredSkills: RequiredSkillRef[];
  checklistSnapshot: ChecklistSnapshotItem[];
  sourceChecklistTemplateId: string | null;
  status: WoTemplateStatus;
  /** Version cấu hình (cột `version`, migration 0008) — optimistic locking. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class WorkOrderTemplateEntity {
  constructor(private props: WorkOrderTemplateProps) {
    if (!UUID_RE.test(this.props.id)) {
      throw new Error('ID mẫu công việc không hợp lệ');
    }
    this.props.code = normalizeWoTemplateCode(this.props.code);
    this.props.name = normalizeWoTemplateName(this.props.name);
    this.props.description = normalizeWoTemplateDescription(this.props.description);
    if (!Array.isArray(this.props.requiredSkills)) {
      throw new Error('Danh sách kỹ năng phải là mảng');
    }
    if (!Array.isArray(this.props.checklistSnapshot)) {
      throw new Error('Checklist phải là mảng');
    }
    if (!['DRAFT', 'ACTIVE', 'INACTIVE'].includes(this.props.status)) {
      throw new Error('Trạng thái mẫu công việc không hợp lệ');
    }
    if (!Number.isInteger(this.props.version) || this.props.version < 1) {
      throw new Error('Version mẫu công việc không hợp lệ');
    }
    this.props.defaultDurationMinutes = normalizeWoTemplateDuration(this.props.defaultDurationMinutes);
    this.props.defaultPriority = normalizeWoTemplatePriority(this.props.defaultPriority);
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get workTypeId(): string | null { return this.props.workTypeId; }
  get requiredTradeId(): string | null { return this.props.requiredTradeId; }
  get defaultDurationMinutes(): number | null { return this.props.defaultDurationMinutes; }
  get defaultPriority(): WoTemplatePriority { return this.props.defaultPriority; }
  get requiredSkills(): RequiredSkillRef[] { return this.props.requiredSkills.map((s) => ({ ...s })); }
  get checklistSnapshot(): ChecklistSnapshotItem[] {
    return this.props.checklistSnapshot.map((c) => ({ ...c }));
  }
  get sourceChecklistTemplateId(): string | null { return this.props.sourceChecklistTemplateId; }
  get status(): WoTemplateStatus { return this.props.status; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // PRJ-SRS-008: chỉ mẫu ACTIVE dùng cho Work Order mới (picker `/active`).
  isUsableForNewWorkOrder(): boolean { return this.props.status === 'ACTIVE'; }

  /**
   * Cập nhật nội dung tại chỗ (giữ nguyên id — Work Order đã tạo giữ
   * snapshot-copy, không hồi tố). Trả true khi một field nghiệp vụ thật sự
   * đổi (code/name/description/workTypeId/requiredTradeId/duration/priority/
   * skills/checklist) — caller quyết định bump version.
   */
  applyTemplateUpdate(
    input: {
      code?: string;
      name?: string;
      description?: string | null;
      workTypeId?: string | null;
      requiredTradeId?: string | null;
      defaultDurationMinutes?: number | null;
      defaultPriority?: WoTemplatePriority;
      requiredSkills?: RequiredSkillRef[];
      checklistSnapshot?: ChecklistSnapshotItem[];
      sourceChecklistTemplateId?: string | null;
    },
    now: Date = new Date(),
  ): boolean {
    let versionRelevantChange = false;
    if (input.code !== undefined) {
      const next = normalizeWoTemplateCode(input.code);
      if (next !== this.props.code) {
        this.props.code = next;
        versionRelevantChange = true;
      }
    }
    if (input.name !== undefined) {
      const next = normalizeWoTemplateName(input.name);
      if (next !== this.props.name) {
        this.props.name = next;
        versionRelevantChange = true;
      }
    }
    if (input.description !== undefined) {
      const next = normalizeWoTemplateDescription(input.description);
      if (next !== this.props.description) {
        this.props.description = next;
        versionRelevantChange = true;
      }
    }
    if (input.workTypeId !== undefined) {
      const next = input.workTypeId === null ? null : String(input.workTypeId).trim() || null;
      if (next !== this.props.workTypeId) {
        this.props.workTypeId = next;
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
    if (input.defaultDurationMinutes !== undefined) {
      const next = normalizeWoTemplateDuration(input.defaultDurationMinutes);
      if (next !== this.props.defaultDurationMinutes) {
        this.props.defaultDurationMinutes = next;
        versionRelevantChange = true;
      }
    }
    if (input.defaultPriority !== undefined) {
      const next = normalizeWoTemplatePriority(input.defaultPriority);
      if (next !== this.props.defaultPriority) {
        this.props.defaultPriority = next;
        versionRelevantChange = true;
      }
    }
    if (input.requiredSkills !== undefined) {
      if (JSON.stringify(input.requiredSkills) !== JSON.stringify(this.props.requiredSkills)) {
        this.props.requiredSkills = input.requiredSkills.map((s) => ({ ...s }));
        versionRelevantChange = true;
      }
    }
    if (input.checklistSnapshot !== undefined) {
      if (JSON.stringify(input.checklistSnapshot) !== JSON.stringify(this.props.checklistSnapshot)) {
        this.props.checklistSnapshot = input.checklistSnapshot.map((c) => ({ ...c }));
        versionRelevantChange = true;
      }
    }
    if (input.sourceChecklistTemplateId !== undefined) {
      const next =
        input.sourceChecklistTemplateId === null
          ? null
          : String(input.sourceChecklistTemplateId).trim() || null;
      if (next !== this.props.sourceChecklistTemplateId) {
        // Provenance-only: đổi nguồn tham chiếu không bump version vì nội dung
        // snapshot giữ nguyên cho đến khi checklist thật sự đổi.
        this.props.sourceChecklistTemplateId = next;
      }
    }
    this.props.updatedAt = now;
    if (versionRelevantChange) {
      this.props.version += 1;
    }
    return versionRelevantChange;
  }

  /**
   * Vòng đời DRAFT --ACTIVATE--> ACTIVE --DEACTIVATE--> INACTIVE
   * (--ACTIVATE--> ACTIVE tái phát hành). DEACTIVATE trực tiếp từ DRAFT
   * không cho phép (mẫu nháp chưa publish thì giữ DRAFT).
   */
  changeStatus(newStatus: WoTemplateStatus, now: Date = new Date()): void {
    if (!['DRAFT', 'ACTIVE', 'INACTIVE'].includes(newStatus)) {
      throw new Error('Trạng thái mẫu công việc không hợp lệ');
    }
    if (newStatus === this.props.status) {
      throw new Error(`Mẫu công việc đã ở trạng thái ${newStatus}`);
    }
    if (this.props.status === 'DRAFT' && newStatus === 'INACTIVE') {
      throw new Error('Mẫu nháp chưa phát hành không thể ngừng trực tiếp');
    }
    this.props.status = newStatus;
    this.props.updatedAt = now;
  }

  getProps(): WorkOrderTemplateProps {
    return {
      ...this.props,
      requiredSkills: this.props.requiredSkills.map((s) => ({ ...s })),
      checklistSnapshot: this.props.checklistSnapshot.map((c) => ({ ...c })),
    };
  }

  toPublic(): {
    id: string;
    code: string;
    name: string;
    description: string | null;
    workTypeId: string | null;
    requiredTradeId: string | null;
    defaultDurationMinutes: number | null;
    defaultPriority: WoTemplatePriority;
    requiredSkills: RequiredSkillRef[];
    checklistSnapshot: ChecklistSnapshotItem[];
    sourceChecklistTemplateId: string | null;
    status: WoTemplateStatus;
    version: number;
    usableForNewWorkOrder: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.props.description,
      workTypeId: this.props.workTypeId,
      requiredTradeId: this.props.requiredTradeId,
      defaultDurationMinutes: this.props.defaultDurationMinutes,
      defaultPriority: this.props.defaultPriority,
      requiredSkills: this.props.requiredSkills.map((s) => ({ ...s })),
      checklistSnapshot: this.props.checklistSnapshot.map((c) => ({ ...c })),
      sourceChecklistTemplateId: this.props.sourceChecklistTemplateId,
      status: this.props.status,
      version: this.props.version,
      usableForNewWorkOrder: this.isUsableForNewWorkOrder(),
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
