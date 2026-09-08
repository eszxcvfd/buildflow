/**
 * JOB-SRS-002 (issue #42) — readiness policy thuần domain cho kiểm tra điều
 * kiện công bố (không Nest/DB, không mutate — advisory read-only).
 *
 * Catalog chốt theo slice (thứ tự đánh giá cố định = thứ tự deterministic
 * của `unmet`, cũng là thứ tự response):
 * PROJECT_NOT_ACTIVE → WORK_TYPE_MISSING → WORK_TYPE_INACTIVE →
 * AREA_INVALID → MISSING_SCHEDULE → INVALID_SCHEDULE_RANGE →
 * MISSING_REQUIRED_SKILL → MISSING_REQUIRED_FIELD →
 * INVALID_STATUS_FOR_PUBLISH → ALREADY_ON_JOB_BOARD.
 *
 * Quyết định ghi rõ (xem ENDPOINTS.md §17 J6):
 * - Trạng thái được công bố: chỉ `DRAFT`/`READY` (slice #41 mới tạo `DRAFT`;
 *   `READY` dành cho transition tương lai — gate tái dùng ở #44/#47).
 * - `MISSING_REQUIRED_FIELD`: key ánh xạ được cột WO thì resolve về cột
 *   (title/code/description/instructions/priority/area/schedule/headcount/
 *   trade/project — so khớp case-insensitive, bỏ `_`/`-`); key còn lại
 *   resolve qua `work_orders.custom_fields` (J8, migration 0011) theo key gốc
 *   (fallback case-insensitive) và kiểm tra present + đúng kiểu theo `type`
 *   entry (NUMBER parse được số; BOOLEAN `false` vẫn tính là đã nhập;
 *   TEXT/SELECT/PHOTO non-empty; DATE parse được ngày). Entry shape verify
 *   theo work-types policy (mirror, không import cross-feature — xem J6);
 *   entry sai shape bị bỏ qua defensively; `required: false` được miễn; key
 *   vắng mặt ở cả cột WO lẫn `custom_fields` → fail-closed
 *   `MISSING_REQUIRED_FIELD` (không đoán đạt).
 * - Skill/required-field chỉ đánh giá khi work-type tồn tại (tránh cascade
 *   noise sau `WORK_TYPE_MISSING`).
 */

export const PUBLISH_CHECK_CODES = [
  'PROJECT_NOT_ACTIVE',
  'WORK_TYPE_MISSING',
  'WORK_TYPE_INACTIVE',
  'AREA_INVALID',
  'MISSING_SCHEDULE',
  'INVALID_SCHEDULE_RANGE',
  'MISSING_REQUIRED_SKILL',
  'MISSING_REQUIRED_FIELD',
  'INVALID_STATUS_FOR_PUBLISH',
  'ALREADY_ON_JOB_BOARD',
] as const;

export type PublishCheckCode = (typeof PUBLISH_CHECK_CODES)[number];

export interface PublishCheckUnmet {
  code: PublishCheckCode;
  field: string;
  message: string;
}

/** Snapshot read-only do read-port riêng cung cấp (1 query batch JOIN). */
export interface PublishCheckSnapshot {
  workOrder: {
    id: string;
    projectId: string;
    areaId: string | null;
    requiredTradeId: string | null;
    title: string;
    code: string;
    description: string | null;
    instructions: string | null;
    priority: string;
    status: string;
    plannedStartAt: Date | null;
    plannedEndAt: Date | null;
    plannedHeadcount: number | null;
    jobBoardOpen: boolean;
    /**
     * Dữ liệu bổ sung theo loại công việc (`work_orders.custom_fields`,
     * migration 0011) — key tùy chỉnh của `work_types.required_fields`
     * resolve ở đây (J8), không fail-closed như trước.
     */
    customFields: Record<string, unknown>;
  };
  project: { id: string; status: string } | null;
  workType: {
    id: string;
    isActive: boolean;
    requiredTradeId: string | null;
    /** Raw `work_types.required_fields` (jsonb) — verify shape ở đây. */
    requiredFieldsRaw: unknown;
  } | null;
  area: { id: string; projectId: string; isActive: boolean } | null;
  /** Trade mà work-type yêu cầu (`work_types.required_trade_id`). */
  workTypeTrade: { id: string; isActive: boolean } | null;
  /** Trade mà WO đang gắn (`work_orders.required_trade_id`). */
  workOrderTrade: { id: string; isActive: boolean } | null;
}

export interface PublishCheckResult {
  ready: boolean;
  unmet: PublishCheckUnmet[];
}

/** Chỉ nháp / sẵn sàng được công bố (gate tái dùng ở #44 publish). */
export const PUBLISHABLE_WORK_ORDER_STATUSES = ['DRAFT', 'READY'] as const;

const REQUIRED_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'PHOTO'] as const;
const REQUIRED_FIELD_KEY_RE = /^[A-Za-z0-9_]+$/;

interface RequiredFieldEntry {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

/**
 * Verify shape entry theo work-types policy
 * (`normalizeRequiredFieldEntry` — mirror ngữ nghĩa, không import
 * cross-feature prj): `{key (1-50 alnum/_), label (1-120), type (6 loại),
 * required? boolean}`. Sai shape → null (bỏ qua, catalog do prj slice giữ).
 */
function verifyRequiredFieldEntry(entry: unknown): RequiredFieldEntry | null {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null;
  const raw = entry as Record<string, unknown>;
  const key = String(raw['key'] ?? '').trim();
  if (key.length === 0 || key.length > 50 || !REQUIRED_FIELD_KEY_RE.test(key)) return null;
  const label = String(raw['label'] ?? '').trim();
  if (label.length === 0 || label.length > 120) return null;
  const type = String(raw['type'] ?? '').trim().toUpperCase();
  if (!(REQUIRED_FIELD_TYPES as readonly string[]).includes(type)) return null;
  if (raw['required'] !== undefined && typeof raw['required'] !== 'boolean') return null;
  return {
    key,
    label,
    type,
    ...(typeof raw['required'] === 'boolean' ? { required: raw['required'] } : {}),
  };
}

/**
 * Resolve giá trị WO cho một required-field key (so khớp không phân biệt
 * hoa/thường, bỏ `_`/`-`). Key không ánh xạ được cột WO nào → đọc
 * `custom_fields` theo key GỐC (J8 — key lạ không còn fail-closed nếu user
 * đã nhập ở phần Dữ liệu bổ sung); key vắng mặt ở cả hai nơi → undefined
 * (caller fail-closed).
 */
function resolveRequiredFieldValue(
  snapshot: PublishCheckSnapshot,
  normalizedKey: string,
  rawKey: string,
): { found: boolean; value: string | number | Date | boolean | null | undefined } {
  const wo = snapshot.workOrder;
  switch (normalizedKey) {
    case 'title':
      return { found: true, value: wo.title };
    case 'code':
      return { found: true, value: wo.code };
    case 'description':
      return { found: true, value: wo.description };
    case 'instructions':
      return { found: true, value: wo.instructions };
    case 'priority':
      return { found: true, value: wo.priority };
    case 'area':
    case 'areaid':
      return { found: true, value: wo.areaId };
    case 'plannedstartat':
    case 'start':
    case 'plannedstart':
      return { found: true, value: wo.plannedStartAt };
    case 'plannedendat':
    case 'end':
    case 'plannedend':
      return { found: true, value: wo.plannedEndAt };
    case 'plannedheadcount':
    case 'headcount':
      return { found: true, value: wo.plannedHeadcount };
    case 'requiredtradeid':
    case 'trade':
    case 'skill':
      return { found: true, value: wo.requiredTradeId };
    case 'project':
    case 'projectid':
      return { found: true, value: wo.projectId };
    default: {
      const custom = wo.customFields ?? {};
      if (Object.prototype.hasOwnProperty.call(custom, rawKey)) {
        return { found: true, value: custom[rawKey] as string | number | boolean | null | undefined };
      }
      const lowered = rawKey.toLowerCase();
      const hit = Object.keys(custom).find((k) => k.toLowerCase() === lowered);
      if (hit !== undefined) {
        return { found: true, value: custom[hit] as string | number | boolean | null | undefined };
      }
      return { found: false, value: undefined };
    }
  }
}

/** Các normalized key ánh xạ về cột WO (còn lại resolve qua `custom_fields`). */
const COLUMN_MAPPED_KEYS: readonly string[] = [
  'title',
  'code',
  'description',
  'instructions',
  'priority',
  'area',
  'areaid',
  'plannedstartat',
  'start',
  'plannedstart',
  'plannedendat',
  'end',
  'plannedend',
  'plannedheadcount',
  'headcount',
  'requiredtradeid',
  'trade',
  'skill',
  'project',
  'projectid',
];

function isColumnMappedKey(normalizedKey: string): boolean {
  return (COLUMN_MAPPED_KEYS as readonly string[]).includes(normalizedKey);
}

function isValuePresent(value: string | number | Date | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  return true;
}

/**
 * Kiểm tra giá trị `custom_fields` theo `type` của required-field entry
 * (J8 — present + đúng kiểu mới pass):
 * - TEXT/SELECT/PHOTO: chuỗi non-empty (số hữu hạn/boolean cũng chấp nhận —
 *   hiển thị được); PHOTO thường là URL hoặc ghi chú, đính kèm bằng chứng
 *   thật ở bước sau.
 * - NUMBER: số hữu hạn hoặc chuỗi parse được số.
 * - DATE: Date hợp lệ hoặc chuỗi parse được ngày.
 * - BOOLEAN: `true`/`false` (cả hai đều là giá trị hợp lệ — `false` KHÔNG
 *   coi là thiếu) hoặc chuỗi `true`/`false`/`1`/`0`, số `1`/`0`.
 */
function isCustomFieldValueValid(value: unknown, type: string): boolean {
  if (value === null || value === undefined) return false;
  switch (type) {
    case 'NUMBER': {
      if (typeof value === 'number') return Number.isFinite(value);
      if (typeof value === 'string') {
        const text = value.trim();
        return text.length > 0 && !Number.isNaN(Number(text));
      }
      return false;
    }
    case 'BOOLEAN': {
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') {
        const text = value.trim().toLowerCase();
        return text === 'true' || text === 'false' || text === '1' || text === '0';
      }
      if (typeof value === 'number') return value === 1 || value === 0;
      return false;
    }
    case 'DATE': {
      if (value instanceof Date) return !Number.isNaN(value.getTime());
      if (typeof value === 'string') {
        const text = value.trim();
        return text.length > 0 && !Number.isNaN(Date.parse(text));
      }
      return false;
    }
    default: {
      // TEXT / SELECT / PHOTO.
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'number') return Number.isFinite(value);
      return typeof value === 'boolean';
    }
  }
}

/**
 * Tính danh sách điều kiện chưa đạt theo catalog. Pure — không I/O, không
 * mutate, không audit. `ready = unmet.length === 0`.
 */
export function evaluatePublishReadiness(snapshot: PublishCheckSnapshot): PublishCheckResult {
  const unmet: PublishCheckUnmet[] = [];
  const wo = snapshot.workOrder;

  // 1. PROJECT_NOT_ACTIVE — chỉ project ACTIVE được công bố.
  if (!snapshot.project) {
    unmet.push({
      code: 'PROJECT_NOT_ACTIVE',
      field: 'projectId',
      message: 'Dự án của công việc không tồn tại, không thể công bố',
    });
  } else if (snapshot.project.status !== 'ACTIVE') {
    unmet.push({
      code: 'PROJECT_NOT_ACTIVE',
      field: 'projectId',
      message: `Dự án không còn hoạt động (trạng thái hiện tại: ${snapshot.project.status}), chỉ dự án ACTIVE mới được công bố`,
    });
  }

  // 2-3. Work type tồn tại + active.
  if (!snapshot.workType) {
    unmet.push({
      code: 'WORK_TYPE_MISSING',
      field: 'workTypeId',
      message: 'Loại công việc của Work Order không tồn tại, không thể công bố',
    });
  } else if (!snapshot.workType.isActive) {
    unmet.push({
      code: 'WORK_TYPE_INACTIVE',
      field: 'workTypeId',
      message: 'Loại công việc đã ngừng hoạt động, không thể công bố',
    });
  }

  // 4. AREA_INVALID — area khác project hoặc inactive; null = pass.
  if (wo.areaId !== null) {
    const area = snapshot.area;
    if (!area) {
      unmet.push({
        code: 'AREA_INVALID',
        field: 'areaId',
        message: 'Khu vực của Work Order không tồn tại, hãy chọn lại khu vực',
      });
    } else if (area.projectId !== wo.projectId) {
      unmet.push({
        code: 'AREA_INVALID',
        field: 'areaId',
        message: 'Khu vực không thuộc dự án này, hãy chọn khu vực của đúng dự án',
      });
    } else if (!area.isActive) {
      unmet.push({
        code: 'AREA_INVALID',
        field: 'areaId',
        message: 'Khu vực đã ngừng hoạt động, hãy chọn khu vực đang hoạt động',
      });
    }
  }

  // 5-6. Lịch: thiếu mốc → MISSING_SCHEDULE (per-field); cả hai mốc mà
  // khoảng sai → INVALID_SCHEDULE_RANGE (strict end > start).
  if (wo.plannedStartAt === null) {
    unmet.push({
      code: 'MISSING_SCHEDULE',
      field: 'plannedStartAt',
      message: 'Chưa có thời điểm bắt đầu kế hoạch, hãy bổ sung lịch trước khi công bố',
    });
  }
  if (wo.plannedEndAt === null) {
    unmet.push({
      code: 'MISSING_SCHEDULE',
      field: 'plannedEndAt',
      message: 'Chưa có thời điểm kết thúc kế hoạch, hãy bổ sung lịch trước khi công bố',
    });
  } else if (wo.plannedStartAt !== null && wo.plannedEndAt.getTime() <= wo.plannedStartAt.getTime()) {
    unmet.push({
      code: 'INVALID_SCHEDULE_RANGE',
      field: 'plannedEndAt',
      message: 'Thời điểm kết thúc kế hoạch phải sau thời điểm bắt đầu',
    });
  }

  // 7. MISSING_REQUIRED_SKILL — work-type.required_trade_id có nhưng WO
  // thiếu/khác hoặc trade inactive. (Bỏ qua khi work-type missing.)
  const requiredTradeId = snapshot.workType?.requiredTradeId ?? null;
  if (snapshot.workType && requiredTradeId !== null) {
    if (wo.requiredTradeId === null) {
      unmet.push({
        code: 'MISSING_REQUIRED_SKILL',
        field: 'requiredTradeId',
        message: 'Loại công việc yêu cầu ngành nghề cụ thể nhưng Work Order chưa gắn, hãy bổ sung ngành nghề',
      });
    } else if (wo.requiredTradeId !== requiredTradeId) {
      unmet.push({
        code: 'MISSING_REQUIRED_SKILL',
        field: 'requiredTradeId',
        message: 'Ngành nghề của Work Order không khớp ngành nghề mà loại công việc yêu cầu',
      });
    } else if (!snapshot.workOrderTrade) {
      unmet.push({
        code: 'MISSING_REQUIRED_SKILL',
        field: 'requiredTradeId',
        message: 'Ngành nghề yêu cầu không tồn tại, hãy chọn ngành nghề đang hoạt động',
      });
    } else if (!snapshot.workOrderTrade.isActive) {
      unmet.push({
        code: 'MISSING_REQUIRED_SKILL',
        field: 'requiredTradeId',
        message: 'Ngành nghề yêu cầu đã ngừng hoạt động, hãy chọn ngành nghề đang hoạt động',
      });
    }
  }

  // 8. MISSING_REQUIRED_FIELD — per-key từ work_types.required_fields.
  // (Bỏ qua khi work-type missing.)
  if (snapshot.workType) {
    const raw = snapshot.workType.requiredFieldsRaw;
    const entries = Array.isArray(raw) ? raw : [];
    for (const entry of entries) {
      const verified = verifyRequiredFieldEntry(entry);
      if (!verified) continue;
      if (verified.required === false) continue;
      const normalizedKey = verified.key.toLowerCase().replace(/[_-]/g, '');
      const resolved = resolveRequiredFieldValue(snapshot, normalizedKey, verified.key);
      const isCustom = !isColumnMappedKey(normalizedKey);
      if (!resolved.found) {
        unmet.push({
          code: 'MISSING_REQUIRED_FIELD',
          field: verified.key,
          message: isCustom
            ? `Chưa nhập "${verified.label}" — nhập ở phần Dữ liệu bổ sung khi tạo/sửa Work Order`
            : `Thiếu dữ liệu bắt buộc: ${verified.label} (khóa "${verified.key}" chưa có trường tương ứng trên Work Order)`,
        });
        continue;
      }
      const present = isCustom
        ? isCustomFieldValueValid(resolved.value, verified.type)
        : isValuePresent(resolved.value);
      if (!present) {
        unmet.push({
          code: 'MISSING_REQUIRED_FIELD',
          field: verified.key,
          message: isCustom
            ? `Chưa nhập "${verified.label}" — nhập ở phần Dữ liệu bổ sung khi tạo/sửa Work Order`
            : `Thiếu dữ liệu bắt buộc: ${verified.label}`,
        });
      }
    }
  }

  // 9. INVALID_STATUS_FOR_PUBLISH — chỉ DRAFT/READY được công bố.
  if (!(PUBLISHABLE_WORK_ORDER_STATUSES as readonly string[]).includes(wo.status)) {
    unmet.push({
      code: 'INVALID_STATUS_FOR_PUBLISH',
      field: 'status',
      message: `Trạng thái ${wo.status} không thể công bố, chỉ Work Order DRAFT hoặc READY được công bố`,
    });
  }

  // 10. ALREADY_ON_JOB_BOARD — job_board_open = true.
  if (wo.jobBoardOpen) {
    unmet.push({
      code: 'ALREADY_ON_JOB_BOARD',
      field: 'jobBoardOpen',
      message: 'Công việc đã mở trên Job Board, không cần công bố lại',
    });
  }

  return { ready: unmet.length === 0, unmet };
}
