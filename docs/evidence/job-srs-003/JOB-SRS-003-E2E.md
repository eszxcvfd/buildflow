# JOB-SRS-003 — E2E Evidence: Cập nhật Work Order (issue #43)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-job-srs-003.cjs`, **7/7 PASS ×2 runs**).
> **Trạng thái tổng:** **7/7 PASS** — không phát hiện bug sản phẩm #43.
> **Phạm vi:** file dưới `docs/evidence/job-srs-003/` — **không commit**, không đụng GitHub,
> không đụng `docs/evidence/job-srs-001/` / `job-srs-002/` của session khác.

> **Chuẩn hóa realistic (docs/demo-data.md, ADR-0003):** creds `@vinacons.vn`,
> WO tiếng Việt (`Cải tạo đường ống nước khu KQ-01 <digits>`), lý do tiếng Việt
> (`Dời lịch do chờ vật tư về (đợt T9/2026) <digits>`). Không dùng `E2E%`/`test%`
> trong dữ liệu hiển thị; uniqueness bằng suffix digits; cleanup theo id
> (`e2e-vars.json`); audit giữ nguyên (append-only).
> Dùng tài khoản canonical nguyên trạng (không reset password, không tạo user).

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (working tree, không commit) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy — **đã rebuild sau slices #43 API+Web**) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — đã rebuild sau slices #43) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng `work_orders` + `notifications` + `audit_logs` sẵn có; `due_at` có từ DDL 0001) |

## 2. Tài khoản & fixtures

| Email | Vai trò | Membership PRA (seed canonical) | Dùng trong |
| --- | --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | không member (bypass audited) | U1–U4, U5 exception, U6, U7 |
| `quoc.tran@vinacons.vn` | PM | member PRA (write scope) | U5 ẩn nút + PATCH 400 |

Fixtures resolve qua API thật mỗi run: project `PRA` (ACTIVE), area `KQ-01` ∈ PRA,
work type `BT-CT` (active), trade `THO-CAT` (active).

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed project/area/type mới** — dùng fixtures canonical PRA/KQ-01/BT-CT nguyên trạng.
  Driver chỉ tạo: 1 WO (`POST /api/v1/work-orders`, title + digits, DRAFT).
  Đổi `status` giữa scenario dùng **SQL UPDATE trực tiếp** (không có endpoint
  publish/assign trong slice này — xem Deviations D1).
- **Cleanup id-based (cuối mỗi run, audit giữ nguyên):**
  `DELETE notifications WHERE entity_id=<woId>`; `DELETE work_orders WHERE id=<woId>`.
  Đã verify sau cả 2 runs: `WO rest=0`, `notif rest=0`.
- **Audit:** append-only, giữ nguyên; run quyết định `audit 2810→2844`
  (writes: create-WO + 4 PATCH thành công + `PROJECT_SCOPE_*` scope rows —
  check 400/409 không ghi audit nghiệp vụ, version giữ nguyên — xem U4).
- **Không đụng data job-srs-001/002:** cleanup theo id WO của run này;
  verify `title LIKE %<digits>%` về 0 (digits khác mỗi run nên không giao nhau).

## 4. Kịch bản & kết quả (run quyết định digits=087697, 7/7 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/job-srs-003/shots/`

| # | Bước (UI → API → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| U1 | DRAFT: admin mở WO → nút **Sửa** → dialog đổi mô tả/ưu tiên (HIGH→URGENT)/hạn → **Lưu thay đổi** → detail hiện mô tả mới; DB `version 1→2`; audit `JOB_WORK_ORDER_UPDATED` before/after đủ 3 trường | 🟢 PASS | `U1-dialog-filled.png`, `U1-updated.png` + §5 |
| U2 | `status=OPEN` (SQL): dialog **lịch/kỹ năng read-only** + text `Khóa ở trạng thái OPEN`; `PATCH plannedStartAt` → **400 `WORK_ORDER_FIELD_LOCKED`** + `fieldErrors.plannedStartAt` | 🟢 PASS | `U2-locked.png` + HTTP §5 |
| U3 | `status=ASSIGNED` (SQL): `PATCH` lịch (start+end) + reason → **200** `version→3`; **1 row `notifications`** cho `created_by` (`WORK_ORDER_UPDATED`, `dedup_key='woupd-*'`); audit `JOB_WORK_ORDER_UPDATED` before/after đủ 2 trường lịch | 🟢 PASS | DB §5 |
| U4 | ASSIGNED đổi lịch **thiếu reason** → **400 `WORK_ORDER_REASON_REQUIRED`** + `fieldErrors.reason`; version giữ nguyên (không side-effect) | 🟢 PASS | HTTP/DB §5 |
| U5 | `status=WORK_DONE` (SQL): **PM không thấy nút Sửa**; PM `PATCH` → **400 `WORK_ORDER_FIELD_LOCKED`**; ADMIN + reason (≥10 ký tự) → **200** + audit **`WORK_ORDER_EXCEPTION_EDIT`** before/after description | 🟢 PASS | `U5-pm-hidden.png` + §5 |
| U6 | Optimistic lock: GET 2 bản cùng version → tab 1 PATCH 200 → tab 2 cùng version cũ → **409 `WORK_ORDER_CONFLICT`**; UI: dialog mở trước bị bump qua API → submit → **notice + nút Tải lại** | 🟢 PASS | `U6-conflict.png` + §5 |
| U7 | Đọc lại WO ở `ASSIGNED` sau edit → `GET :id` **200** đúng nội dung + UI detail render (regression G1 — non-DRAFT GET) | 🟢 PASS | HTTP §5 |

**Tổng: 7 PASS / 0 FAIL / 7 mục. Run lặp độc lập: 7/7 PASS
(digits=075622, code `WO-MTSQMMEJOD6H`, `rest=0`, `audit 2774→2808`).**

## 5. HTTP + DB outputs thật (run quyết định, digits=087697)

```
fixtures PRA=10000000-... KQ-01=589c0681-... BT-CT=e2e4b200-... THO-CAT=11111111-...
U1  POST /work-orders → 201 code=WO-MTSQMVNYD9K9 id=8c3fb4f0-...
    UI Sửa → desc/priority/dueAt → detail hiện mô tả mới; version 1→2
    audit JOB_WORK_ORDER_UPDATED ×1, before/after đủ [description,priority,dueAt]
U2  status OPEN (SQL); UI start/end disabled + 'Khóa ở trạng thái OPEN'
    PATCH schedule → 400 WORK_ORDER_FIELD_LOCKED + fieldErrors.plannedStartAt
U3  status ASSIGNED (SQL); PATCH start+end+reason → 200 version→3
    notifications: 1 row WORK_ORDER_UPDATED recipient=created_by dedup=woupd-*;
    audit JOB_WORK_ORDER_UPDATED before/after [plannedStartAt,plannedEndAt]
U4  PATCH schedule thiếu reason → 400 WORK_ORDER_REASON_REQUIRED + fieldErrors.reason; version giữ nguyên
U5  status WORK_DONE (SQL); PM: Sửa count=0, PATCH → 400 WORK_ORDER_FIELD_LOCKED
    ADMIN + reason → 200; audit WORK_ORDER_EXCEPTION_EDIT before/after [description]
U6  2× GET cùng version → tab1 200 → tab2 stale → 409 WORK_ORDER_CONFLICT (version hiện tại 6)
    UI dialog cũ submit → notice + nút 'Tải lại'
U7  status ASSIGNED (SQL); GET :id → 200 (status/id/code/version đúng); UI detail render
cleanup: WO rest=0, notif rest=0, audit 2810→2844
```

## 6. Acceptance mapping (SRS.md:396 — JOB-SRS-003)

| Tiêu chí SRS / nghiệm thu | Scenario chứng minh |
| --- | --- |
| Điều phối viên cập nhật mô tả, ưu tiên, thời hạn, hướng dẫn khi trạng thái cho phép | U1 (DRAFT đổi desc/priority/dueAt qua UI → 200, version+1) |
| Thay đổi lịch, kỹ năng phải gửi thông báo và lưu giá trị trước/sau | U3 (notification row cho creator + audit before/after 2 trường lịch); U4 (thiếu reason → 400, không side-effect) |
| Dữ liệu bị khóa sau hoàn tất chỉ sửa qua quy trình ngoại lệ | U5 (PM ẩn nút + PATCH 400; ADMIN + reason ≥10 → 200 + `WORK_ORDER_EXCEPTION_EDIT`) |
| Trường khóa theo trạng thái hiển thị rõ | U2 (OPEN: UI read-only + text khóa; PATCH → 400 `FIELD_LOCKED` per-field) |
| Chống ghi đè đồng thời (optimistic lock) | U6 (tab cũ → 409 `CONFLICT`; UI notice + Tải lại) |
| Đọc lại WO sau edit (hồi quy G1) | U7 (GET non-DRAFT 200 + UI render) |

**Ngoài phạm vi E2E này:** đổi `workTypeId`/`requiredTradeId` kèm reason (cùng nhánh
workflow-impacting với đổi lịch — đã cover ở unit policy + api e2e slice);
`instructions` (cùng nhánh desc — cover U1 desc); gán assignee (defer #47 —
notification tạm gửi creator theo thiết kế slice).

## 7. Deviations

- **D1 — đổi status bằng SQL:** không có endpoint publish/assign trong slice này
  (lệnh #44/#47 chưa mở) nên `OPEN`/`ASSIGNED`/`WORK_DONE` được seed qua
  `UPDATE work_orders SET status=...` — mirror deviation D1 của `JOB-SRS-002-E2E.md`
  (không có PATCH ở slice đó). Ghi rõ trong driver + §3.
- **D2 — U2/U4 ở HTTP-level:** dialog client `disable` field khóa và chặn submit
  thiếu reason ngay phía client (server authoritative) nên 400 `FIELD_LOCKED` /
  `REASON_REQUIRED` assert qua API với token thật; UI chứng minh phía khóa/hint
  (`U2-locked.png`; hint reason trong `U1-dialog-filled.png` khi chạm workflow).
- **D3 — notification cho creator:** assignee chưa tồn tại (defer #47) nên U3
  assert recipient = `created_by` theo thiết kế slice (xem báo cáo upd-api).

## 8. Cách tái sinh

```bash
# 1. Stack từ working tree (rebuild api+web gồm slices #43):
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự tạo WO, cleanup id-based, audit giữ nguyên):
node docs/evidence/job-srs-003/e2e-driver-job-srs-003.cjs
# → TỔNG: 7/7 PASS (ids ghi vào e2e-vars.json; shots/ U1×2, U2, U5, U6)
```

## 9. Rủi ro / ghi chú

- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- Writes kèm `X-Correlation-Id` UUID mới mỗi request (partial unique `ux_audit_correlation_action`); các `GET` check không gửi correlation (server chỉ validate cho write).
- Suite api full: **136 passed / 1 skipped suites; 1166 passed / 11 skipped tests, EXIT=0**;
  `lint` + `build` api xanh.
- Suite web full: **102/103 suites, 667/669 tests**; 2 fail đều ở
  `WorkerCrews.spec.tsx` (add happy path + remove flow — slice ORG-03/ORG-05,
  không liên quan #43) **pass 8/8 khi chạy isolate** → flake timing khi chạy
  full-suite dưới tải, đã ghi nhận ở `JOB-SRS-002-E2E.md` §8 (không fix trong slice này);
  `lint` (No warnings/errors) + `build` web xanh.
