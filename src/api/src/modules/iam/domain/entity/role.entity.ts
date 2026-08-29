export interface RoleProps {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class RoleEntity {
  constructor(private props: RoleProps) {}

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null | undefined { return this.props.description; }
  get isSystem(): boolean { return this.props.isSystem; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isAssignable(): boolean {
    // Only active roles can be assigned per IAM-SRS-005
    return this.props.isActive === true;
  }

  getProps(): RoleProps {
    return { ...this.props };
  }
}
