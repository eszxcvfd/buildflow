# Demo Data — BuildFlow (canonical)

> Quyết định: [ADR 0003](adr/0003-e2e-realistic-data.md) — dữ liệu E2E phải giống thật nhất có thể.

> Fiction: **Công ty CP Xây dựng Vinacons (VINACONS)**, email domain
> `@vinacons.vn`. Mọi dữ liệu demo dưới đây là hư cấu phục vụ phát triển/E2E.
>
> Mapping note: **đổi tên 2026-09-07, dữ liệu cũ còn trong audit_logs
> (append-only) là có chủ ý** — bảng `audit_logs` bị chặn UPDATE/DELETE/
> TRUNCATE ở mức DB trigger, nên các dòng audit lịch sử vẫn giữ identifier
> cũ (`admin@example.com`, `E2E4-PRJ`, …). Đó là hành vi đúng, không phải
> dữ liệu bẩn.
>
> Reproduce: [`evidence/demo-data/cleanup-e2e-leftovers.sql`](evidence/demo-data/cleanup-e2e-leftovers.sql)
> rồi [`evidence/demo-data/seed-realistic-operations.sql`](evidence/demo-data/seed-realistic-operations.sql)
> (cả hai idempotent — chạy lại an toàn; chi tiết ở §8). Cách rebuild từ scratch: xem §Reset.
>
> Lịch sử: [`evidence/demo-data/rename-realistic.sql`](evidence/demo-data/rename-realistic.sql)
> và [`evidence/demo-data/demo-work-order-templates.sql`](evidence/demo-data/demo-work-order-templates.sql)
> là bước rename/demo trước đây (giữ nguyên làm evidence lịch sử, không dùng để reproduce nữa).

## 1. Users

Mật khẩu KHÔNG đổi (giữ nguyên để E2E/driver dùng được):

| Email | Mật khẩu | Họ tên | Role (`user_roles`) | `user_type` | Code | Status | Phone |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hoang.anh@vinacons.vn | `E2EAdmin@2025` | Nguyễn Hoàng Anh | ADMIN, STAFF | STAFF | — | ACTIVE | 0901234561 |
| quoc.tran@vinacons.vn | `E2EPm@2025` | Trần Quốc Điều | PROJECT_MANAGER | STAFF | — | ACTIVE | 0912345672 |
| thang.nguyen@vinacons.vn | `E2EWorker@2025` | Nguyễn Văn Thắng | WORKER | WORKER | TX-0010 | **LOCKED** (giữ nguyên — driver-004 chứng minh WORKER canonical bị LOCKED) | 0932345673 |
| hau.le@vinacons.vn | `E2EWorker2@2025` | Lê Văn Hậu | WORKER | WORKER | TX-0011 | ACTIVE | 0903456784 |
| tuan.pham@vinacons.vn | (không đổi) | Phạm Văn Tuấn | — | WORKER | TX-0012 | ACTIVE | 0909211361 |
| dong.trinh@vinacons.vn | (không đổi) | Trịnh Văn Đông | — | WORKER | TX-0018 | ACTIVE | 0909813672 |
| cuong.do@vinacons.vn | (không đổi) | Đỗ Văn Cường | — | WORKER | TX-0021 | **INACTIVE** (giữ nguyên) | 0900123402 |
| ba.nguyen@vinacons.vn | `E2E5W3@2025` | Nguyễn Văn Ba | — | WORKER | TX-0015 | ACTIVE | 0914567895 |
| duc.tran@vinacons.vn (ex `dbg.503.916174`, rename 2026-09-09 — user bị audit-ghim nên giữ UUID) | (không đổi) | Trần Quốc Đức | — | WORKER | TX-0022 | ACTIVE | (giữ nguyên) |
| manh.pham@vinacons.vn (ex `e2e.sync11.w1.905257`, rename 2026-09-09 — user bị audit-ghim nên giữ UUID) | (không đổi) | Phạm Văn Mạnh | — | WORKER | TX-0023 | ACTIVE | (giữ nguyên) |
| son.nguyen@vinacons.vn (seed 2026-09-09) | `Vinacons@2026` | Nguyễn Văn Sơn | PROJECT_MANAGER, STAFF | STAFF | TX-0030 | ACTIVE | 0903344551 |
| lan.tran@vinacons.vn (seed 2026-09-09) | `Vinacons@2026` | Trần Thị Lan | WORKER | WORKER | TX-0031 | ACTIVE | 0903344552 |
| hung.vo@vinacons.vn (seed 2026-09-09) | `Vinacons@2026` | Võ Văn Hùng | WORKER | WORKER | TX-0032 | ACTIVE | 0903344553 |
| phuc.dang@vinacons.vn (seed 2026-09-09) | `Vinacons@2026` | Đặng Văn Phúc | WORKER | WORKER | TX-0033 | ACTIVE | 0903344554 |

Đã xóa 2026-09-09 (cleanup-e2e-leftovers.sql): `luc.tran.s7qrjp`, `khoi.pham.283393`
(kèm resource_trades/crew_member của họ; audit `ORG_WORKER_*` giữ nguyên có chủ ý).

UUID, role, status (kể cả INACTIVE của `cuong.do`), password hash giữ nguyên —
chỉ đổi `email`/`full_name`/`employee_code`/`phone`.

## 2. Projects

| Code | Tên | Địa chỉ | Status | Planned | Manager |
| --- | --- | --- | --- | --- | --- |
| PRA | Trung tâm thương mại Sunshine Plaza | 45 Lê Lợi, Q.1, TP.HCM | ACTIVE | 2026-09-01 → 2027-06-30 | hoang.anh |
| PRB | Chung cư Green Tower | 12 Phạm Văn Đồng, Thủ Đức | ACTIVE | 2026-08-15 → 2027-12-31 | hoang.anh |
| PRC | Nhà máy cơ khí Chính Cơ | KCN Vĩnh Lộc, Bình Chánh | DRAFT | 2026-10-01 → 2027-09-30 | quoc.tran |
| PRD | Bệnh viện đa khoa Quận 7 (ex `E2E4-PRJ`) | 31 Nguyễn Văn Linh, Q.7, TP.HCM | ACTIVE | 2026-09-06 → 2026-12-05 | hoang.anh |
| PRT (seed 2026-09-09) | Khu dân cư ven sông Thủ Thiêm | Đại lộ Mai Chí Thọ, TP. Thủ Đức, TP.HCM | ACTIVE | 2026-09-01 → 2027-12-31 | quoc.tran |

Status / planned dates / manager giữ nguyên.

## 3. Project areas

| Project | Code | Tên | Order |
| --- | --- | --- | --- |
| PRA | KQ-01 | Sảnh chính - Tầng 1 | 1 |
| PRA | TM-02 | Khu thương mại - Tầng 2 | 2 |
| PRB | GA-A03 | Block A - Tầng 3 | 1 |
| PRD | B1-01 (ex `E2E4-AREA-1`) | Tầng hầm B1 | 1 |
| PRD | PT-04 | Khu phẫu thuật - Tầng 4 | 2 |
| PRD | CC-02 | Khu khám chữa bệnh - Tầng 2 | 3 |
| PRT (seed 2026-09-09) | TH-01 | Tháp A - Tầng điển hình | 1 |
| PRT (seed 2026-09-09) | TH-02 | Tháp B - Tầng điển hình | 2 |
| PRT (seed 2026-09-09) | HM-01 | Hầm để xe B1 | 3 |

Tất cả `is_active = true`.

## 4. Project members (seed mới — trước đây trống)

`added_by` = hoang.anh cho mọi dòng; toàn bộ `is_active = true`.

| Project | User | Role |
| --- | --- | --- |
| PRA | quoc.tran | MANAGER |
| PRB | quoc.tran | MANAGER |
| PRC | quoc.tran | MANAGER |
| PRD | quoc.tran | MANAGER |
| PRA | hau.le | WORKER |
| PRA | ba.nguyen | QC |
| PRB | tuan.pham | WORKER |
| PRD | thang.nguyen | WORKER |
| PRD | dong.trinh | COORDINATOR |
| PRT | son.nguyen | MANAGER |
| PRT | lan.tran | WORKER |
| PRT | hung.vo | WORKER |

Insert bằng SQL trực tiếp nên **không** sinh dòng audit.

## 5. Trades

| Code | Tên |
| --- | --- |
| THO-CAT | Tho cat gach (giữ nguyên) |
| OP-LAT (ex `E2E-TONWFWD`) | Thợ ốp lát |
| SON-NUOC (ex `E2E-TONZFUF`) | Thợ sơn nước |
| DIEN (ex `E2E-TOO1CBY`) | Thợ điện |
| COP-PHA (seed 2026-09-09) | Thợ cốp pha |
| THEP (seed 2026-09-09) | Thợ cốt thép |

Đã xóa 2026-09-09: `NK-S7QRJP`, `XT-S7QRJP` (đã kiểm tra 0 tham chiếu còn lại);
contractor `XD-283393` đi kèm cũng đã xóa (0 tham chiếu).

`resource_trades` (active): tuan.pham → SON-NUOC; dong.trinh → DIEN
(đã dedupe từ cặp active+inactive trùng `(user, trade)` về 1 dòng active);
seed 2026-09-09 thêm: lan.tran → COP-PHA; hung.vo → DIEN; phuc.dang → THEP;
crew DOI-BT → THO-CAT; crew DOI-SON → SON-NUOC.

## 6. Contractors / crews / work types / work orders

- Contractors (tổng = 5): `VCC` Công ty CP Xây dựng Vinacons
  (ex `E2E4-CON`); `NTA`, `HTB` giữ nguyên; seed 2026-09-09 thêm `XD-TH`
  (Trường Hải), `CD-VT` (Việt Thắng); `XD-283393` đã xóa (0 tham chiếu).
- Crews (tổng = 5): `DD-CD` Đội cơ điện Vinacons (ex `E2E4-CREW`), contractor → VCC;
  seed 2026-09-09 thêm `DOI-BT` (VCC), `DOI-SON` + `DOI-COP` (XD-TH),
  `DOI-DIEN` (CD-VT) — mỗi crew đúng 1 LEAD active (`ux_crew_one_active_lead`).
- Work types: `BT-CT` Công tác bê tông cốt thép (ex `E2E4-WT`) + 4 dòng WT-*
  giữ nguyên (tổng = 5).
- Work orders (tổng = 9): `PRD-B1-001` “Thi công sàn bê tông tầng hầm B1”
  (ex `E2E4-WO-1`), status ASSIGNED; 4 WO rác PRA (`Dbg 503 WO`, 3 WO suffix số)
  đã xóa 2026-09-09; seed 2026-09-09 thêm 8 WO đa trạng thái, **board ĐÓNG**
  (`job_board_open = false`), chỉ ở PRD + PRT (không ở PRA/PRB để né assertions
  driver-005/004):
  `WO-PRT-001` DRAFT, `WO-PRT-002` READY, `WO-PRT-003` OPEN, `WO-PRD-101`
  ASSIGNED, `WO-PRD-102` IN_PROGRESS, `WO-PRD-103` WORK_DONE, `WO-PRT-004`
  CLOSED, `WO-PRT-005` CANCELLED. Assignment giữ nguyên.

### 6b. Phủ seed operations 2026-09-09 (mỗi bảng nghiệp vụ ≥ 5 dòng)

Seed trong `seed-realistic-operations.sql` (UUID `dec0de00-…`, idempotent,
guard cuối script tự fail nếu bảng nào dưới ngưỡng):

| Bảng | Count sau seed |
| --- | --- |
| users / user_roles | 14 / 12 |
| contractors / crews / crew_members / resource_trades / trades | 5 / 5 / 8 / 9 / 6 |
| projects / project_areas / project_members | 5 / 9 / 14 |
| work_orders / dependencies / assignments / state_history / updates | 9 / 5 / 6 / 8 / 5 |
| readiness_checks / readiness_items | 5 / 6 |
| materials / work_order_materials / supplement_requests / blockers | 5 / 6 / 5 / 5 |
| checklist_templates / template_items | 5 / 7 |
| checkpoint_templates / checkpoints | 5 / 5 |
| checklist_instances / instance_items | 5 / 6 |
| inspections / corrective_actions / attachments / notifications | 5 / 5 / 5 / 5 |

Ngoại lệ < 5 có chủ ý (KHÔNG ép vô nghĩa): `roles` = 4 (chuẩn RBAC —
thêm role giả làm sai phân quyền); `password_reset_tokens` = 2 (token nhất thời
do runtime tạo/hết hạn, không phải demo data); `schema_migrations` (hệ thống);
`audit_logs` append-only (4046 tại thời điểm seed — xem §8 về delta driver).

## 7. Work-order templates

8 mẫu công việc thật cho trang `/work-order-templates` (trước đây trống sau
driver cleanup). `work_type_id`/`required_trade_id` trỏ tới work types/trades
có sẵn (§2/§5); `required_skills` 1–2 trade codes; checklist 3–5 mục tiếng
Việt (`PASS_FAIL`/`TEXT`/`NUMBER`); `version = 1`.

| Code | Tên | Trạng thái | Ưu tiên | Thời lượng (phút) |
| --- | --- | --- | --- | --- |
| WOT-BT-COT | Đổ bê tông cột, vách | ACTIVE | HIGH | 240 |
| WOT-BT-SAN | Đổ bê tông dầm sàn | ACTIVE | NORMAL | 480 |
| WOT-COT-THEP | Gia công, lắp dựng cốt thép | ACTIVE | HIGH | 360 |
| WOT-COP-PHA | Lắp dựng cốp pha | ACTIVE | NORMAL | 300 |
| WOT-SON-NOI-THAT | Sơn nước tường nội thất | ACTIVE | NORMAL | 240 |
| WOT-OP-LAT-NEN | Ốp lát gạch nền | ACTIVE | NORMAL | 300 |
| WOT-DIEN-AM | Đi ống điện âm tường | ACTIVE | HIGH | 240 |
| WOT-CHONG-THAM | Chống thấm sàn vệ sinh | DRAFT | NORMAL | 360 |

Reproduce (idempotent — `ON CONFLICT (code) DO NOTHING`, không đụng row
của evidence drivers PRJ-SRS-008):

```bash
docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
  < docs/evidence/demo-data/demo-work-order-templates.sql
```

## 8. Reset — rebuild demo data từ scratch

1. Dựng DB từ migration baseline (`src/api`: `scripts/migrate.js` — các file
   `migrations/NNNN_*.sql`), rồi seed fixture gốc theo quy trình seed hiện
   hành của repo (nếu có).
2. Áp 2 script theo đúng thứ tự (idempotent, chạy lại nhiều lần an toàn):
   ```bash
   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
     < docs/evidence/demo-data/cleanup-e2e-leftovers.sql
   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
     < docs/evidence/demo-data/seed-realistic-operations.sql
   ```
   `cleanup-e2e-leftovers.sql` xóa rác E2E theo UUID chính xác (children →
   parents) + rename 2 user audit-ghim; `seed-realistic-operations.sql` chèn
   dữ liệu vận hành thực tế (UUID `dec0de00-…`, `ON CONFLICT DO NOTHING`,
   guard cuối fail nếu bảng nghiệp vụ nào < 5 ngoài ngoại lệ §6b).
   Không sinh dòng audit mới (INSERT/DELETE trực tiếp, delta `audit_logs` = 0 —
   đã verify: 4046 trước và sau khi áp 2 script; lần chạy driver E2E sau đó
   mới làm audit tăng qua API, ví dụ smoke driver-005 +13 → 4059).
3. Kiểm tra (kỳ vọng mỗi truy vấn 0 dòng; `audit_logs` được loại trừ có chủ ý —
   giữ identifier cũ là hành vi đúng, xem mapping note đầu file):
   ```sql
   SELECT email FROM users WHERE email ~* 'dbg|sync|e2e|S7QRJP|283393';
   SELECT full_name FROM users WHERE full_name ~* 'dbg|sync|e2e|S7QRJP|Mới';
   SELECT code, name FROM projects    WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code, name FROM trades      WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code, name FROM contractors WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code, name FROM crews       WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code FROM work_types        WHERE code ~* 'e2e|probe|test';
   SELECT code FROM work_order_templates WHERE code ~* 'e2e|probe|test';
   SELECT code, title FROM work_orders WHERE code ~* 'e2e|probe|test' OR title ~* 'e2e|probe|test'
     OR title ~ '[0-9]{6,}' OR title ILIKE '%Dbg%';
   SELECT a.code, a.name FROM project_areas a
     WHERE a.code ~* 'e2e|probe|test' OR a.name ~* 'e2e|probe|test';
   ```
4. Smoke test API: login `POST /api/v1/auth/login`
   (`hoang.anh@vinacons.vn` / `E2EAdmin@2025`) rồi `GET /projects` — phải thấy
   `PRD` “Bệnh viện đa khoa Quận 7”.
