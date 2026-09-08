import { WorkOrderStatus } from '../entity/work-order.entity';

/**
 * JOB-SRS-003 (issue #43) — state policy thuần domain cho cập nhật Work Order
 * (mirror `work-order-publish-check.policy.ts`: không Nest/DB, không mutate).
 *
 * Ma trận cho phép (field khóa gửi payload → caller 400
 * `WORK_ORDER_FIELD_LOCKED` + `fieldErrors` per-field):
 * - `DRAFT`/`READY` → sửa được tất cả field updatable (9 field: 8 cũ +
 *   `customFields` J8).
 * - `OPEN` → chỉ `description`/`instructions`/`dueAt`/`customFields`
 *   (lịch/skill/work-type khóa — đổi phải qua đóng board trước; xem
 *   ENDPOINTS §17 J7).
 * - `ASSIGNED`/`IN_PROGRESS` → chỉ `description`/`instructions`/`customFields`;
 *   lịch/skill/work-type (`plannedStartAt`/`plannedEndAt`/`requiredTradeId`/
 *   `workTypeId`) là workflow-impacting: cho phép nhưng BẮT BUỘC `reason`
 *   (SRS: đổi lịch/kỹ năng phải thông báo + lưu before/after).
 * - `WORK_DONE`/`CLOSED`/`CANCELLED` → toàn bộ khóa; CHỈ ADMIN với `reason`
 *   ≥ 10 ký tự sửa được (quy trình ngoại lệ, audit
 *   `WORK_ORDER_EXCEPTION_EDIT`).
 *
 * Quyết định ghi rõ:
 * - `dueAt` KHÔNG thuộc nhóm workflow-impacting (chỉ deadline, không đổi
 *   lịch/skill/người thực hiện) nên không trigger notification và không đòi
 *   `reason` ở `ASSIGNED`/`IN_PROGRESS` — nhưng vẫn khóa ở các trạng thái này
 *   (ngoài allow-list `description`/`instructions`).
 * - `priority` khóa từ `OPEN` trở đi (đổi ưu tiên sau công bố thuộc điều phối
 *   lại, ngoài slice này).
 */

export const UPDATABLE_WORK_ORDER_FIELDS = [
  'description',
  'instructions',
  'priority',
  'dueAt',
  'plannedStartAt',
  'plannedEndAt',
  'requiredTradeId',
  'workTypeId',
  /**
   * Dữ liệu bổ sung (`custom_fields`, J8) — chỉnh được như
   * `description`/`instructions` (không workflow-impacting: không đòi
   * `reason`, không notification; terminal vẫn khóa như mọi field).
   */
  'customFields',
] as const;

export type UpdatableWorkOrderField = (typeof UPDATABLE_WORK_ORDER_FIELDS)[number];

/** Field đổi lịch/skill/work-type → notification + before/after + reason. */
export const WORKFLOW_IMPACTING_FIELDS: readonly UpdatableWorkOrderField[] = [
  'plannedStartAt',
  'plannedEndAt',
  'requiredTradeId',
  'workTypeId',
];

/** Trạng thái khóa toàn bộ — chỉ quy trình ngoại lệ (ADMIN + reason). */
export const TERMINAL_LOCKED_STATUSES: readonly WorkOrderStatus[] = [
  'WORK_DONE',
  'CLOSED',
  'CANCELLED',
];

export const EXCEPTION_REASON_MIN_LENGTH = 10;

const FULL_EDIT_STATUSES: readonly WorkOrderStatus[] = ['DRAFT', 'READY'];
const OPEN_EDITABLE_FIELDS: readonly UpdatableWorkOrderField[] = [
  'description',
  'instructions',
  'dueAt',
  'customFields',
];
const ACTIVE_EDITABLE_FIELDS: readonly UpdatableWorkOrderField[] = [
  'description',
  'instructions',
  'customFields',
];

export interface UpdateFieldDecision {
  /** Field được chấp nhận ở trạng thái này (trước kiểm tra reason). */
  allowed: boolean;
  /** Đổi field này bắt buộc kèm `reason` (chỉ ở ASSIGNED/IN_PROGRESS). */
  requiresReason: boolean;
  /** Trạng thái khóa toàn bộ — chỉ ADMIN + reason ngoại lệ. */
  exceptionEdit: boolean;
}

/**
 * Quyết định per-field thuần — không I/O, không mutate.
 */
export function decideUpdateField(
  status: WorkOrderStatus,
  field: UpdatableWorkOrderField,
  opts: { isAdmin: boolean },
): UpdateFieldDecision {
  if ((TERMINAL_LOCKED_STATUSES as readonly string[]).includes(status)) {
    return { allowed: opts.isAdmin, requiresReason: true, exceptionEdit: true };
  }
  if ((FULL_EDIT_STATUSES as readonly string[]).includes(status)) {
    return { allowed: true, requiresReason: false, exceptionEdit: false };
  }
  if (status === 'OPEN') {
    return {
      allowed: (OPEN_EDITABLE_FIELDS as readonly string[]).includes(field),
      requiresReason: false,
      exceptionEdit: false,
    };
  }
  // ASSIGNED / IN_PROGRESS.
  if ((ACTIVE_EDITABLE_FIELDS as readonly string[]).includes(field)) {
    return { allowed: true, requiresReason: false, exceptionEdit: false };
  }
  return {
    allowed: (WORKFLOW_IMPACTING_FIELDS as readonly string[]).includes(field),
    requiresReason: true,
    exceptionEdit: false,
  };
}

export interface EvaluateUpdateRequestOpts {
  isAdmin: boolean;
  /** Reason đã trim (null khi không gửi). */
  reason: string | null;
}

export interface EvaluateUpdateRequestResult {
  /** Per-field lỗi khóa → caller 400 `WORK_ORDER_FIELD_LOCKED`. */
  fieldErrors: Record<string, string[]>;
  /** True khi đi nhánh ngoại lệ (terminal + ADMIN + reason hợp lệ). */
  exceptionEdit: boolean;
  /** Field workflow-impacting được chấp nhận (cần reason đã verify). */
  reasonGovernedFields: UpdatableWorkOrderField[];
}

/**
 * Đánh giá toàn bộ request PATCH: gom `fieldErrors` cho field khóa + kiểm tra
 * `reason` (ngoại lệ terminal: ADMIN + ≥10 ký tự; workflow-impacting ở
 * ASSIGNED/IN_PROGRESS: bắt buộc non-empty). Pure.
 */
export function evaluateUpdateRequest(
  status: WorkOrderStatus,
  fields: UpdatableWorkOrderField[],
  opts: EvaluateUpdateRequestOpts,
): EvaluateUpdateRequestResult {
  const fieldErrors: Record<string, string[]> = {};
  const reasonGovernedFields: UpdatableWorkOrderField[] = [];
  let exceptionEdit = false;

  const isTerminal = (TERMINAL_LOCKED_STATUSES as readonly string[]).includes(status);
  if (isTerminal) {
    if (!opts.isAdmin) {
      for (const field of fields) {
        fieldErrors[field] = [
          `Trường ${field} đã bị khóa ở trạng thái ${status}; dữ liệu sau hoàn tất chỉ sửa qua quy trình ngoại lệ`,
        ];
      }
      return { fieldErrors, exceptionEdit: false, reasonGovernedFields };
    }
    const reasonLen = (opts.reason ?? '').trim().length;
    if (reasonLen < EXCEPTION_REASON_MIN_LENGTH) {
      fieldErrors['reason'] = [
        `Sửa công việc ở trạng thái ${status} thuộc quy trình ngoại lệ, bắt buộc nhập lý do từ ${EXCEPTION_REASON_MIN_LENGTH} ký tự trở lên`,
      ];
      return { fieldErrors, exceptionEdit: false, reasonGovernedFields };
    }
    exceptionEdit = true;
    return { fieldErrors, exceptionEdit, reasonGovernedFields: [...fields] };
  }

  for (const field of fields) {
    const decision = decideUpdateField(status, field, { isAdmin: opts.isAdmin });
    if (!decision.allowed) {
      fieldErrors[field] =
        status === 'OPEN'
          ? [`Trường ${field} đã bị khóa ở trạng thái OPEN; đổi lịch/kỹ năng phải đóng board trước`]
          : [`Trường ${field} đã bị khóa ở trạng thái ${status}; đổi lịch/kỹ năng phải nhập lý do`];
    } else if (decision.requiresReason) {
      reasonGovernedFields.push(field);
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, exceptionEdit: false, reasonGovernedFields: [] };
  }
  if (reasonGovernedFields.length > 0 && (opts.reason ?? '').trim().length === 0) {
    fieldErrors['reason'] = [
      'Đổi lịch/kỹ năng ở trạng thái này bắt buộc nhập lý do để thông báo cho bên liên quan',
    ];
  }
  return { fieldErrors, exceptionEdit: false, reasonGovernedFields };
}
