/**
 * PRJ-SRS-008 (issue #39) — validation helpers thuần domain cho mẫu công việc
 * (mirror work-type.policy style: không Nest/DB, ném Error, use case
 * convert sang 400 fieldErrors).
 */

export const WO_TEMPLATE_CODE_RE = /^[A-Za-z0-9_-]+$/;
export const WO_TEMPLATE_CODE_MIN_LENGTH = 2;
export const WO_TEMPLATE_CODE_MAX_LENGTH = 50;
export const WO_TEMPLATE_NAME_MAX_LENGTH = 150;
export const WO_TEMPLATE_DESCRIPTION_MAX_LENGTH = 500;
export const WO_TEMPLATE_REASON_MAX_LENGTH = 500;
export const WO_TEMPLATE_REQUIRED_SKILLS_MAX = 50;
export const WO_TEMPLATE_CHECKLIST_ITEMS_MAX = 100;

export type WoTemplatePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const WO_TEMPLATE_PRIORITIES: WoTemplatePriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export type WoTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export const WO_TEMPLATE_STATUSES: WoTemplateStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE'];

export interface RequiredSkillRef {
  code: string;
  label: string;
}

export type ChecklistAnswerType = 'YES_NO' | 'TEXT' | 'NUMBER' | 'PASS_FAIL';

export const CHECKLIST_ANSWER_TYPES: ChecklistAnswerType[] = [
  'YES_NO',
  'TEXT',
  'NUMBER',
  'PASS_FAIL',
];

export interface ChecklistSnapshotItem {
  title: string;
  answerType: ChecklistAnswerType;
  isRequired: boolean;
  isBlocking: boolean;
  requiresPhoto?: boolean;
  sequenceNo: number;
}

/** Mã mẫu: bắt buộc, 2-50 ký tự, `^[A-Za-z0-9_-]+$` (cùng pattern trades/work-types). */
export function normalizeWoTemplateCode(code: unknown): string {
  const trimmed = String(code ?? '').trim();
  if (trimmed.length < WO_TEMPLATE_CODE_MIN_LENGTH || trimmed.length > WO_TEMPLATE_CODE_MAX_LENGTH) {
    throw new Error(`Mã mẫu công việc phải từ ${WO_TEMPLATE_CODE_MIN_LENGTH} đến ${WO_TEMPLATE_CODE_MAX_LENGTH} ký tự`);
  }
  if (!WO_TEMPLATE_CODE_RE.test(trimmed)) {
    throw new Error('Mã mẫu công việc chỉ cho phép chữ, số, _ và -');
  }
  return trimmed;
}

/** Tên mẫu: bắt buộc, 1-150 ký tự sau trim. */
export function normalizeWoTemplateName(name: unknown): string {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length === 0) throw new Error('Tên mẫu công việc không được để trống');
  if (trimmed.length > WO_TEMPLATE_NAME_MAX_LENGTH) {
    throw new Error(`Tên mẫu công việc tối đa ${WO_TEMPLATE_NAME_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** Mô tả: optional; rỗng → null; tối đa 500 ký tự. */
export function normalizeWoTemplateDescription(description?: string | null): string | null {
  if (description === undefined || description === null) return null;
  const trimmed = String(description).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WO_TEMPLATE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Mô tả mẫu công việc tối đa ${WO_TEMPLATE_DESCRIPTION_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** Thời lượng mặc định (phút): optional; khi gửi phải là số nguyên > 0 (mirror CHECK). */
export function normalizeWoTemplateDuration(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('Thời lượng mặc định phải là số nguyên dương (phút)');
  }
  return num;
}

/** Ưu tiên mặc định: optional, default `NORMAL`; sai enum → Error. */
export function normalizeWoTemplatePriority(value: unknown): WoTemplatePriority {
  if (value === undefined || value === null) return 'NORMAL';
  if (!WO_TEMPLATE_PRIORITIES.includes(value as WoTemplatePriority)) {
    throw new Error('Ưu tiên mặc định không hợp lệ');
  }
  return value as WoTemplatePriority;
}

/** `work_type_id` / `required_trade_id` / `source_checklist_template_id`: optional UUID; rỗng → null. */
export function normalizeWoTemplateOptionalUuid(value: unknown, _label: string): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/** Reason cho update/status: optional; khi gửi phải 1-500 ký tự sau trim. */
export function normalizeWoTemplateReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WO_TEMPLATE_REASON_MAX_LENGTH) {
    throw new Error(`Lý do tối đa ${WO_TEMPLATE_REASON_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

const SKILL_CODE_RE = /^[A-Za-z0-9_-]+$/;

function normalizeSkillEntry(entry: unknown, index: number): RequiredSkillRef {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`Kỹ năng #${index + 1} phải có dạng {code,label}`);
  }
  const raw = entry as Record<string, unknown>;
  const code = String(raw['code'] ?? '').trim();
  if (code.length === 0 || code.length > 50 || !SKILL_CODE_RE.test(code)) {
    throw new Error(`Kỹ năng #${index + 1}: code phải 1-50 ký tự, chỉ chữ/số/_/-`);
  }
  const label = String(raw['label'] ?? '').trim();
  if (label.length === 0 || label.length > 120) {
    throw new Error(`Kỹ năng #${index + 1}: label phải 1-120 ký tự`);
  }
  return { code, label };
}

/**
 * `required_skills`: optional, default `[]`; mỗi entry `{code,label}` trong đó
 * `code` là mã ngành nghề (trade code) — tồn tại + active do use case kiểm tra
 * qua repo (đọc trực tiếp `public.trades`). Trùng `code` (case-insensitive) → Error.
 */
export function normalizeRequiredSkills(value: unknown): RequiredSkillRef[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error('Danh sách kỹ năng phải là mảng');
  }
  if (value.length > WO_TEMPLATE_REQUIRED_SKILLS_MAX) {
    throw new Error(`Danh sách kỹ năng tối đa ${WO_TEMPLATE_REQUIRED_SKILLS_MAX} mục`);
  }
  const normalized = value.map((entry, index) => normalizeSkillEntry(entry, index));
  const seen = new Set<string>();
  for (const entry of normalized) {
    const lowered = entry.code.toLowerCase();
    if (seen.has(lowered)) {
      throw new Error(`Kỹ năng trùng code: ${entry.code}`);
    }
    seen.add(lowered);
  }
  return normalized;
}

function normalizeChecklistEntry(entry: unknown, index: number): ChecklistSnapshotItem {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`Checklist #${index + 1} phải có dạng {title,answerType,...}`);
  }
  const raw = entry as Record<string, unknown>;
  const title = String(raw['title'] ?? '').trim();
  if (title.length === 0 || title.length > 250) {
    throw new Error(`Checklist #${index + 1}: title phải 1-250 ký tự`);
  }
  const answerType = String(raw['answerType'] ?? '').trim().toUpperCase();
  if (!CHECKLIST_ANSWER_TYPES.includes(answerType as ChecklistAnswerType)) {
    throw new Error(
      `Checklist #${index + 1}: answerType phải thuộc ${CHECKLIST_ANSWER_TYPES.join('/')}`,
    );
  }
  for (const flag of ['isRequired', 'isBlocking'] as const) {
    if (raw[flag] !== undefined && typeof raw[flag] !== 'boolean') {
      throw new Error(`Checklist #${index + 1}: ${flag} phải là boolean`);
    }
  }
  if (raw['requiresPhoto'] !== undefined && typeof raw['requiresPhoto'] !== 'boolean') {
    throw new Error(`Checklist #${index + 1}: requiresPhoto phải là boolean`);
  }
  const sequenceNo = typeof raw['sequenceNo'] === 'number' ? raw['sequenceNo'] : Number(raw['sequenceNo']);
  if (!Number.isInteger(sequenceNo) || sequenceNo <= 0) {
    throw new Error(`Checklist #${index + 1}: sequenceNo phải là số nguyên dương`);
  }
  const normalized: ChecklistSnapshotItem = {
    title,
    answerType: answerType as ChecklistAnswerType,
    isRequired: Boolean(raw['isRequired'] ?? true),
    isBlocking: Boolean(raw['isBlocking'] ?? false),
    sequenceNo,
  };
  if (raw['requiresPhoto'] !== undefined) {
    normalized.requiresPhoto = Boolean(raw['requiresPhoto']);
  }
  return normalized;
}

/**
 * `checklist_snapshot`: optional, default `[]`; mỗi entry
 * `{title,answerType,isRequired,isBlocking,requiresPhoto?,sequenceNo>0}`.
 * Trùng `sequenceNo` → Error. Tối đa 100 items.
 */
export function normalizeChecklistSnapshot(value: unknown): ChecklistSnapshotItem[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error('Checklist phải là mảng');
  }
  if (value.length > WO_TEMPLATE_CHECKLIST_ITEMS_MAX) {
    throw new Error(`Checklist tối đa ${WO_TEMPLATE_CHECKLIST_ITEMS_MAX} mục`);
  }
  const normalized = value.map((entry, index) => normalizeChecklistEntry(entry, index));
  const seen = new Set<number>();
  for (const entry of normalized) {
    if (seen.has(entry.sequenceNo)) {
      throw new Error(`Checklist trùng sequenceNo: ${entry.sequenceNo}`);
    }
    seen.add(entry.sequenceNo);
  }
  return normalized;
}
