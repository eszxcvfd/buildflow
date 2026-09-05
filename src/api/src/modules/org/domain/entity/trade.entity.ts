export type TradeStatus = 'ACTIVE' | 'INACTIVE';

export interface TradeProps {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function validateCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.length === 0) throw new Error('Mã ngành nghề không được để trống');
  if (trimmed.length < 2 || trimmed.length > 50) throw new Error('Mã ngành nghề phải từ 2 đến 50 ký tự');
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new Error('Mã ngành nghề chỉ cho phép chữ, số, _ và -');
  return trimmed;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error('Tên ngành nghề không được để trống');
  if (trimmed.length < 1 || trimmed.length > 120) throw new Error('Tên ngành nghề phải từ 1 đến 120 ký tự');
  return trimmed;
}

function validateDescription(v?: string | null): string | null {
  if (v === null || v === undefined || v === '') return null;
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > 500) throw new Error('Mô tả ngành nghề tối đa 500 ký tự');
  return t;
}

export class TradeEntity {
  constructor(private props: TradeProps) {
    this.props.code = validateCode(this.props.code);
    this.props.name = validateName(this.props.name);
    this.props.description = validateDescription(this.props.description);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.props.id)) {
      throw new Error('ID ngành nghề không hợp lệ');
    }
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null { return (this.props.description as string | null) ?? null; }
  get isActive(): boolean { return this.props.isActive === true; }
  get status(): TradeStatus { return this.props.isActive === true ? 'ACTIVE' : 'INACTIVE'; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // ORG-SRS-003: catalog ngừng hiệu lực không được dùng cho phân công/tự nhận mới
  isAssignable(): boolean { return this.props.isActive === true; }
  isActiveStatus(): boolean { return this.props.isActive === true; }
  isInactive(): boolean { return this.props.isActive !== true; }

  updateDetails(input: { name?: string; description?: string | null }, now: Date = new Date()): void {
    if (input.name !== undefined) {
      this.props.name = validateName(input.name);
    }
    if (input.description !== undefined) {
      this.props.description = validateDescription(input.description);
    }
    this.props.updatedAt = now;
  }

  changeStatus(newStatus: TradeStatus, now: Date = new Date()): void {
    if (!['ACTIVE', 'INACTIVE'].includes(newStatus)) {
      throw new Error('Trạng thái ngành nghề không hợp lệ');
    }
    if ((newStatus === 'ACTIVE') === this.isActive) {
      throw new Error(`Ngành nghề đã ở trạng thái ${newStatus}`);
    }
    this.props.isActive = newStatus === 'ACTIVE';
    this.props.updatedAt = now;
  }

  getProps(): TradeProps {
    return { ...this.props };
  }

  toPublic(): {
    id: string;
    code: string;
    name: string;
    description: string | null;
    status: TradeStatus;
    assignable: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      code: this.props.code,
      name: this.props.name,
      description: this.description,
      status: this.status,
      assignable: this.isAssignable(),
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
