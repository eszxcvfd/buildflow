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
> Reproduce: [`evidence/demo-data/rename-realistic.sql`](evidence/demo-data/rename-realistic.sql)
> (idempotent — chạy lại an toàn). Cách rebuild từ scratch: xem §Reset.

## 1. Users

Mật khẩu KHÔNG đổi (giữ nguyên để E2E/driver dùng được):

| Email | Mật khẩu | Họ tên | Role (`user_roles`) | `user_type` | Code | Status | Phone |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hoang.anh@vinacons.vn | `E2EAdmin@2025` | Nguyễn Hoàng Anh | ADMIN, STAFF | STAFF | — | ACTIVE | 0901234561 |
| quoc.tran@vinacons.vn | `E2EPm@2025` | Trần Quốc Điều | PROJECT_MANAGER | STAFF | — | ACTIVE | 0912345672 |
| thang.nguyen@vinacons.vn | `E2EWorker@2025` | Nguyễn Văn Thắng | WORKER | WORKER | TX-0010 | ACTIVE | 0932345673 |
| hau.le@vinacons.vn | `E2EWorker2@2025` | Lê Văn Hậu | WORKER | WORKER | TX-0011 | ACTIVE | 0903456784 |
| tuan.pham@vinacons.vn | (không đổi) | Phạm Văn Tuấn | — | WORKER | TX-0012 | ACTIVE | 0909211361 |
| dong.trinh@vinacons.vn | (không đổi) | Trịnh Văn Đông | — | WORKER | TX-0018 | ACTIVE | 0909813672 |
| cuong.do@vinacons.vn | (không đổi) | Đỗ Văn Cường | — | WORKER | TX-0021 | **INACTIVE** (giữ nguyên) | 0900123402 |
| ba.nguyen@vinacons.vn | `E2E5W3@2025` | Nguyễn Văn Ba | — | WORKER | TX-0015 | ACTIVE | 0914567895 |

UUID, role, status (kể cả INACTIVE của `cuong.do`), password hash giữ nguyên —
chỉ đổi `email`/`full_name`/`employee_code`/`phone`.

## 2. Projects

| Code | Tên | Địa chỉ | Status | Planned | Manager |
| --- | --- | --- | --- | --- | --- |
| PRA | Trung tâm thương mại Sunshine Plaza | 45 Lê Lợi, Q.1, TP.HCM | ACTIVE | 2026-09-01 → 2027-06-30 | hoang.anh |
| PRB | Chung cư Green Tower | 12 Phạm Văn Đồng, Thủ Đức | ACTIVE | 2026-08-15 → 2027-12-31 | hoang.anh |
| PRC | Nhà máy cơ khí Chính Cơ | KCN Vĩnh Lộc, Bình Chánh | DRAFT | 2026-10-01 → 2027-09-30 | quoc.tran |
| PRD | Bệnh viện đa khoa Quận 7 (ex `E2E4-PRJ`) | 31 Nguyễn Văn Linh, Q.7, TP.HCM | ACTIVE | 2026-09-06 → 2026-12-05 | hoang.anh |

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

Insert bằng SQL trực tiếp nên **không** sinh dòng audit.

## 5. Trades

| Code | Tên |
| --- | --- |
| THO-CAT | Tho cat gach (giữ nguyên) |
| OP-LAT (ex `E2E-TONWFWD`) | Thợ ốp lát |
| SON-NUOC (ex `E2E-TONZFUF`) | Thợ sơn nước |
| DIEN (ex `E2E-TOO1CBY`) | Thợ điện |

Các dòng `E2E-DUP-*` đã xóa (đã kiểm tra không còn FK nào từ
`resource_trades`/`work_orders`/`work_types` trỏ tới).

`resource_trades` (active): tuan.pham → SON-NUOC; dong.trinh → DIEN
(đã dedupe từ cặp active+inactive trùng `(user, trade)` về 1 dòng active).

## 6. Contractors / crews / work types / work orders

- Contractors (giữ tổng = 3): `VCC` Công ty CP Xây dựng Vinacons
  (ex `E2E4-CON`); `NTA`, `HTB` giữ nguyên.
- Crews: `DD-CD` Đội cơ điện Vinacons (ex `E2E4-CREW`), contractor → VCC.
- Work types: `BT-CT` Công tác bê tông cốt thép (ex `E2E4-WT`).
- Work orders: `PRD-B1-001` “Thi công sàn bê tông tầng hầm B1”
  (ex `E2E4-WO-1`), status ASSIGNED; description/instructions tiếng Việt
  thực tế (bản vẽ KC-B1, nghiệm thu cốp pha/cốt thép). Assignment giữ nguyên.

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
2. Áp scriptshirt này (idempotent, chạy lại nhiều lần an toàn):
   ```bash
   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
     < docs/evidence/demo-data/rename-realistic.sql
   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
     < docs/evidence/demo-data/demo-work-order-templates.sql
   ```
3. Kiểm tra (kỳ vọng mỗi truy vấn 0 dòng; `audit_logs` được loại trừ có chủ ý):
   ```sql
   SELECT email FROM users            WHERE email ~* 'e2e|probe|test';
   SELECT code, name FROM projects    WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code, name FROM trades      WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code, name FROM contractors WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code, name FROM crews       WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
   SELECT code FROM work_types        WHERE code ~* 'e2e|probe|test';
   SELECT code FROM work_order_templates WHERE code ~* 'e2e|probe|test';
   SELECT code, title FROM work_orders WHERE code ~* 'e2e|probe|test' OR title ~* 'e2e|probe|test';
   SELECT a.code, a.name FROM project_areas a
     WHERE a.code ~* 'e2e|probe|test' OR a.name ~* 'e2e|probe|test';
   ```
4. Smoke test API: login `POST /api/v1/auth/login`
   (`hoang.anh@vinacons.vn` / `E2EAdmin@2025`) rồi `GET /projects` — phải thấy
   `PRD` “Bệnh viện đa khoa Quận 7”.
