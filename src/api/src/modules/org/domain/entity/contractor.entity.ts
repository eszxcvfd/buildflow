export type ContractorStatus = 'ACTIVE' | 'INACTIVE';

export interface ContractorProps {
  id: string;
  code: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  status: ContractorStatus;
  scope?: string | null; // maps to DB note column (work scope)
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function validateCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length === 0) throw new Error('Mã nhà thầu không được để trống');
  if (trimmed.length < 2 || trimmed.length > 50) throw new Error('Mã nhà thầu phải từ 2 đến 50 ký tự');
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new Error('Mã nhà thầu chỉ cho phép chữ, số, _ và -');
  return trimmed;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Tên nhà thầu không được để trống');
  if (trimmed.length < 2) throw new Error('Tên nhà thầu tối thiểu 2 ký tự');
  if (trimmed.length > 200) throw new Error('Tên nhà thầu tối đa 200 ký tự');
  return trimmed;
}

function validateRequiredContactName(v?: string | null): string {
  if (v === null || v === undefined) throw new Error('Thông tin liên hệ không được để trống');
  const t = String(v).trim();
  if (t.length === 0) throw new Error('Thông tin liên hệ không được để trống');
  if (t.length > 150) throw new Error('Tên liên hệ tối đa 150 ký tự');
  return t;
}

function validateContactName(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > 150) throw new Error('Tên liên hệ tối đa 150 ký tự');
  return t;
}

function validatePhone(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const normalized = v.trim();
  if (normalized.length > 20) throw new Error('Số điện thoại tối đa 20 ký tự');
  const digitsOnly = normalized.replace(/[\s-]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(digitsOnly)) throw new Error('Số điện thoại không hợp lệ');
  return normalized;
}

function validateEmail(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const trimmed = v.trim().toLowerCase();
  if (trimmed.length > 255) throw new Error('Email tối đa 255 ký tự');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) throw new Error('Email không hợp lệ');
  return trimmed;
}

function validateRequiredScope(v?: string | null): string {
  if (v === null || v === undefined) throw new Error('Phạm vi công việc không được để trống');
  const t = String(v).trim();
  if (t.length === 0) throw new Error('Phạm vi công việc không được để trống');
  if (t.length > 1000) throw new Error('Phạm vi công việc tối đa 1000 ký tự');
  return t;
}

function validateScope(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > 1000) throw new Error('Phạm vi công việc tối đa 1000 ký tự');
  return t;
}

export class ContractorEntity {
  constructor(private props: ContractorProps) {
    // Validate on construction — issue #25 requires contactName + scope (thiếu contact/scope phải reject)
    this.props.code = validateCode(this.props.code);
    this.props.name = validateName(this.props.name);
    this.props.contactName = validateRequiredContactName(this.props.contactName);
    this.props.phone = validatePhone(this.props.phone);
    this.props.email = validateEmail(this.props.email);
    this.props.scope = validateRequiredScope(this.props.scope);
    if (!['ACTIVE', 'INACTIVE'].includes(this.props.status)) {
      throw new Error('Trạng thái hợp tác không hợp lệ');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.props.id)) {
      throw new Error('ID nhà thầu không hợp lệ');
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.props.createdBy)) {
      throw new Error('Người tạo không hợp lệ');
    }
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get contactName(): string | null { return (this.props.contactName as string | null) ?? null; }
  get phone(): string | null { return (this.props.phone as string | null) ?? null; }
  get email(): string | null { return (this.props.email as string | null) ?? null; }
  get status(): ContractorStatus { return this.props.status; }
  get scope(): string | null { return (this.props.scope as string | null) ?? null; }
  get createdBy(): string { return this.props.createdBy; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isActive(): boolean { return this.props.status === 'ACTIVE'; }
  isInactive(): boolean { return this.props.status === 'INACTIVE'; }

  isEligibleForAssignment(): boolean {
    // ORG-SRS-002: nhà thầu ngừng hoạt động không được chọn cho phân công mới
    return this.props.status === 'ACTIVE';
  }

  updateDetails(input: {
    name?: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    scope?: string | null;
  }, now: Date = new Date()): void {
    if (input.name !== undefined) {
      this.props.name = validateName(input.name);
    }
    if (input.contactName !== undefined) {
      // Required field must not be cleared to empty/null
      if (input.contactName === null || String(input.contactName).trim() === '') {
        throw new Error('Thông tin liên hệ không được để trống');
      }
      this.props.contactName = validateRequiredContactName(input.contactName);
    }
    if (input.phone !== undefined) {
      this.props.phone = validatePhone(input.phone);
    }
    if (input.email !== undefined) {
      this.props.email = validateEmail(input.email);
    }
    if (input.scope !== undefined) {
      if (input.scope === null || String(input.scope).trim() === '') {
        throw new Error('Phạm vi công việc không được để trống');
      }
      this.props.scope = validateRequiredScope(input.scope);
    }
    this.props.updatedAt = now;
  }

  changeStatus(newStatus: ContractorStatus, now: Date = new Date()): void {
    if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
      throw new Error('Trạng thái hợp tác không hợp lệ');
    }
    if (this.props.status === newStatus) {
      throw new Error(`Nhà thầu đã ở trạng thái ${newStatus}`);
    }
    this.props.status = newStatus;
    this.props.updatedAt = now;
  }

  getProps(): ContractorProps {
    return { ...this.props };
  }

  toPublic(): {
    id: string;
    code: string;
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    status: ContractorStatus;
    scope: string | null;
    eligible: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      contactName: this.contactName,
      phone: this.phone,
      email: this.email,
      status: this.props.status,
      scope: this.scope,
      eligible: this.isEligibleForAssignment(),
      createdBy: this.props.createdBy,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
