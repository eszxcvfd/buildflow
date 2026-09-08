import {
  WorkOrderPriority,
  normalizePlannedHeadcount,
  normalizeWorkOrderCode,
  normalizeWorkOrderPriority,
  normalizeWorkOrderText,
  normalizeWorkOrderTitle,
} from '../service/work-order.policy';

export type WorkOrderStatus = 'DRAFT';

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
  /** Slice này chỉ tạo nháp — luôn `DRAFT` (gán/phát hành thuộc #42/#44). */
  status: WorkOrderStatus;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedHeadcount: number | null;
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
    if (this.props.status !== 'DRAFT') throw new Error('Work Order mới phải ở trạng thái DRAFT');
    this.props.plannedHeadcount = normalizePlannedHeadcount(this.props.plannedHeadcount);
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
  get plannedHeadcount(): number | null { return this.props.plannedHeadcount; }
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
    createdBy: string;
    version: number;
    requestKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return { ...this.props };
  }
}
