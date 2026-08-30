export interface TradeProps {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TradeEntity {
  constructor(private readonly props: TradeProps) {}
  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get description(): string | null | undefined { return this.props.description; }
  get isActive(): boolean { return this.props.isActive; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  isAssignable(): boolean { return this.props.isActive === true; }
  getProps(): TradeProps { return { ...this.props }; }
}
