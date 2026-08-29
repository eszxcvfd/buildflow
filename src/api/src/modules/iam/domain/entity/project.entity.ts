export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CLOSED';

export interface ProjectProps {
  id: string;
  code: string;
  name: string;
  status: ProjectStatus;
  managerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectEntity {
  constructor(private readonly props: ProjectProps) {}

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get status(): ProjectStatus { return this.props.status; }
  get managerId(): string { return this.props.managerId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  getProps(): ProjectProps {
    return { ...this.props };
  }
}
