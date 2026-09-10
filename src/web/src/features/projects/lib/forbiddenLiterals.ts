/**
 * Web redesign — canonical FORBIDDEN literal list (F001/F002/F003).
 * Superset mọi số liệu/tên giả từng xuất hiện trong mẫu redesign; dùng chung
 * cho grep audit (§9 plan) và noFabrication spec (render + source-scan).
 * Mọi ô /projects phải là field API thật hoặc placeholder '—'/empty-state.
 */
export const FORBIDDEN_LITERALS = [
  'Sunshine Plaza',
  '72%',
  '48.2',
  '24.5 / 32B',
  '24.5 Tỷ (76%)',
  '80% tải',
  '45%',
  '88%',
  '15%',
  '85 Tỷ',
  '32.0 Tỷ',
  '84 công nhân',
  'KTS.Hoàng Anh',
  'Bệnh viện Q7',
  'Chuẩn tiến độ',
  'Thiếu vật tư',
] as const;
