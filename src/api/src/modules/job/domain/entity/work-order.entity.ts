import {
  WorkOrderCustomFields,
  WorkOrderPriority,
  normalizeCustomFieldsInput,
  normalizePlannedHeadcount,
  normalizeWorkOrderCode,
  normalizeWorkOrderPriority,
  normalizeWorkOrderText,
  normalizeWorkOrderTitle,
} from '../service/work-order.policy';

/** Full DB enum (`work_orders_status_ck`, migration 0001) — rehydrate chấp nhận tất cả. */
export type WorkOrderStatus =
  | 'DRAFT'
  | 'READY'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WORK_DONE'
  | 'CLOSED'
  | 'CANCELLED';

const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  'DRAFT',
  'READY',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WORK_DONE',
  'CLOSED',
  'CANCELLED',
];

export interface WorkOrderProps {
  id: string;
  code: string;
  projectId: string;
  areaId: string | null;
  workTypeId: string;
  requiredTradeId: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  priority: WorkOrderPriority;
  /** Trạng thái hiện tại (tạo mới luôn `DRAFT` qua `createDraft`; lifecycle sau thuộc #42/#44). */
  status: WorkOrderStatus;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  /** Hạn hoàn thành (`work_orders.due_at`) — chỉnh qua PATCH #43 (create để null). */
  dueAt: Date | null;
  plannedHeadcount: number | null;
  /**
   * Dữ liệu bổ sung theo loại công việc (`work_orders.custom_fields`,
   * migration 0011) — giá trị các `required_fields` tùy chỉnh của work-type.
   */
  customFields: WorkOrderCustomFields;
  createdBy: string;
  version: number;
  requestKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) throw new Error(`${label} không hợp lệ`);
}

export class WorkOrderEntity {
  /**
   * Tạo nháp mới — giữ invariant DRAFT-at-creation (slice này chỉ tạo nháp;
   * gán/phát hành thuộc #42/#44).
   */
  static createDraft(props: Omit<WorkOrderProps, 'status'> & { status: 'DRAFT' }): WorkOrderEntity {
    if (props.status !== 'DRAFT') throw new Error('Work Order mới phải ở trạng thái DRAFT');
    return new WorkOrderEntity({ ...props, status: 'DRAFT' });
  }

  /**
   * Rehydrate từ persistence — chấp nhận full DB enum, không ép DRAFT
   * (GET mọi WO non-DRAFT đi qua đây qua `mapRow`).
   */
  static fromPersistence(props: WorkOrderProps): WorkOrderEntity {
    return new WorkOrderEntity({ ...props });
  }

  constructor(private props: WorkOrderProps) {
    assertUuid(this.props.id, 'ID công việc');
    assertUuid(this.props.projectId, 'ID dự án');
    if (this.props.areaId !== null) assertUuid(this.props.areaId, 'ID khu vực');
    assertUuid(this.props.workTypeId, 'ID loại công việc');
    if (this.props.requiredTradeId !== null) assertUuid(this.props.requiredTradeId, 'ID ngành nghề');
    assertUuid(this.props.createdBy, 'ID người tạo');
    const code = normalizeWorkOrderCode(this.props.code);
    if (!code) throw new Error('Mã công việc không được để trống');
    this.props.code = code;
    this.props.title = normalizeWorkOrderTitle(this.props.title);
    this.props.description = normalizeWorkOrderText(this.props.description, 'Mô tả công việc');
    this.props.instructions = normalizeWorkOrderText(this.props.instructions, 'Hướng dẫn thực hiện');
    this.props.priority = normalizeWorkOrderPriority(this.props.priority);
    if (!WORK_ORDER_STATUSES.includes(this.props.status)) throw new Error('Trạng thái công việc không hợp lệ');
    this.props.plannedHeadcount = normalizePlannedHeadcount(this.props.plannedHeadcount);
    this.props.customFields = normalizeCustomFieldsInput(this.props.customFields);
    if (!Number.isInteger(this.props.version) || this.props.version < 1) {
      throw new Error('Version công việc không hợp lệ');
    }
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get projectId(): string { return this.props.projectId; }
  get areaId(): string | null { return this.props.areaId; }
  get workTypeId(): string { return this.props.workTypeId; }
  get requiredTradeId(): string | null { return this.props.requiredTradeId; }
  get title(): string { return this.props.title; }
  get description(): string | null { return this.props.description; }
  get instructions(): string | null { return this.props.instructions; }
  get priority(): WorkOrderPriority { return this.props.priority; }
  get status(): WorkOrderStatus { return this.props.status; }
  get plannedStartAt(): Date | null { return this.props.plannedStartAt; }
  get plannedEndAt(): Date | null { return this.props.plannedEndAt; }
  get dueAt(): Date | null { return this.props.dueAt; }
  get plannedHeadcount(): number | null { return this.props.plannedHeadcount; }
  get customFields(): WorkOrderCustomFields { return { ...this.props.customFields }; }
  get createdBy(): string { return this.props.createdBy; }
  get version(): number { return this.props.version; }
  get requestKey(): string | null { return this.props.requestKey; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // JOB-SRS-001: thiếu dữ liệu tùy chọn (schedule/area/trade) → vẫn DRAFT,
  // không chặn tạo; gán người thực hiện / mở job board thuộc slice sau.
  isDraft(): boolean { return this.props.status === 'DRAFT'; }

  getProps(): WorkOrderProps {
    return { ...this.props };
  }

  /**
   * Public fields cho response + audit `afterData` (không chứa secret —
   * entity vốn không giữ credential; `requestKey` cố ý loại khỏi response
   * summary ở mapper nhưng vẫn nằm trong afterData phục vụ trace replay).
   */
  toPublic(): {
    id: string;
    code: string;
    projectId: string;
    areaId: string | null;
    workTypeId: string;
    requiredTradeId: string | null;
    title: string;
    description: string | null;
    instructions: string | null;
    priority: WorkOrderPriority;
    status: WorkOrderStatus;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    plannedHeadcount: number | null;
    dueAt: Date | null;
    customFields: WorkOrderCustomFields;
    createdBy: string;
    version: number;
    requestKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return { ...this.props };
  }
}
