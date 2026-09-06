export type CrewStatus = 'ACTIVE' | 'INACTIVE';

export interface CrewProps {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  contractorId?: string | null;
  status: CrewStatus;
  /**
   * ORG-SRS-006 (issue #29) — active LEAD của đội, attach từ `crew_members`
   * (row `is_active` + `member_role='LEAD'`). Không phải cột của `crews`;
   * repository nạp qua LEFT JOIN, use case dùng để phát hiện đổi trưởng nhóm.
   */
  leaderUserId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length === 0) throw new Error('Mã đội không được để trống');
  if (trimmed.length < 2 || trimmed.length > 50) throw new Error('Mã đội phải từ 2 đến 50 ký tự');
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new Error('Mã đội chỉ cho phép chữ, số, _ và -');
  return trimmed;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Tên đội không được để trống');
  if (trimmed.length < 2) throw new Error('Tên đội tối thiểu 2 ký tự');
  if (trimmed.length > 120) throw new Error('Tên đội tối đa 120 ký tự');
  return trimmed;
}

function validateDescription(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const trimmed = String(v).trim();
  if (trimmed.length > 500) throw new Error('Mô tả đội tối đa 500 ký tự');
  return trimmed;
}

function validateContractorId(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const trimmed = String(v).trim();
  if (!UUID_RE.test(trimmed)) throw new Error('Nhà thầu không hợp lệ');
  return trimmed;
}

export class CrewEntity {
  constructor(private props: CrewProps) {
    this.props.code = validateCode(this.props.code);
    this.props.name = validateName(this.props.name);
    this.props.description = validateDescription(this.props.description);
    this.props.contractorId = validateContractorId(this.props.contractorId);
    if (!['ACTIVE', 'INACTIVE'].includes(this.props.status)) {
      throw new Error('Trạng thái đội không hợp lệ');
    }
    if (this.props.leaderUserId !== null && this.props.leaderUserId !== undefined) {
      if (!UUID_RE.test(String(this.props.leaderUserId))) throw new Error('Trưởng nhóm không hợp lệ');
    }
    if (!UUID_RE.test(this.props.id)) {
      throw new Error('ID đội không hợp lệ');
    }
    if (!UUID_RE.test(this.props.createdBy)) {
      throw new Error('Người tạo không hợp lệ');
    }
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null { return (this.props.description as string | null) ?? null; }
  get contractorId(): string | null { return (this.props.contractorId as string | null) ?? null; }
  get status(): CrewStatus { return this.props.status; }
  get leaderUserId(): string | null { return (this.props.leaderUserId as string | null) ?? null; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isActive(): boolean { return this.props.status === 'ACTIVE'; }
  isInactive(): boolean { return this.props.status === 'INACTIVE'; }

  isEligibleForAssignment(): boolean {
    // ORG-SRS-006: đội ngừng hoạt động không nhận phân công mới
    return this.props.status === 'ACTIVE';
  }

  updateDetails(input: {
    name?: string;
    description?: string | null;
    contractorId?: string | null;
  }, now: Date = new Date()): void {
    if (input.name !== undefined) {
      this.props.name = validateName(input.name);
    }
    if (input.description !== undefined) {
      this.props.description = validateDescription(input.description);
    }
    if (input.contractorId !== undefined) {
      this.props.contractorId = validateContractorId(input.contractorId);
    }
    this.props.updatedAt = now;
  }

  /** Đặt lại trưởng nhóm đã attach (sau swap LEAD trong cùng tx). */
  setLeaderUserId(leaderUserId: string | null, now: Date = new Date()): void {
    if (leaderUserId !== null && !UUID_RE.test(leaderUserId)) throw new Error('Trưởng nhóm không hợp lệ');
    this.props.leaderUserId = leaderUserId;
    this.props.updatedAt = now;
  }

  changeStatus(newStatus: CrewStatus, now: Date = new Date()): void {
    if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
      throw new Error('Trạng thái đội không hợp lệ');
    }
    if (this.props.status === newStatus) {
      throw new Error(`Đội đã ở trạng thái ${newStatus}`);
    }
    this.props.status = newStatus;
    this.props.updatedAt = now;
  }

  getProps(): CrewProps {
    return { ...this.props };
  }

  toPublic(): {
    id: string;
    code: string;
    name: string;
    description: string | null;
    contractorId: string | null;
    status: CrewStatus;
    eligible: boolean;
    leaderUserId: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.description,
      contractorId: this.contractorId,
      status: this.props.status,
      eligible: this.isEligibleForAssignment(),
      leaderUserId: this.leaderUserId,
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
