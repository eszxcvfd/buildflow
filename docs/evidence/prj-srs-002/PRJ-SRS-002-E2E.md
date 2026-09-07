# PRJ-SRS-002 — E2E Evidence: Vòng đời trạng thái dự án (issue #33)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-002.cjs`, run chuẩn hóa realistic = **11/11 PASS**).
> Các run cũ (2026-09-07, mã `E2E2-*`) xem §4a — identifiers cũ chỉ còn trong lịch sử/audit.
> **Trạng thái tổng:** **11/11 PASS** — không phát hiện bug sản phẩm #33; 1 hành vi ngoài scope #33 được ghi nhận (§4a F1, không fix).
> **Phạm vi:** file dưới `docs/evidence/prj-srs-002/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md):** creds `@vinacons.vn`, mã run `VDA2-*`
> (Vinacons Dự Án 2), tên dự án + lý do chuyển trạng thái tiếng Việt thực tế
> (`…(đợt T9/2026)`). Manager UUIDs giữ nguyên (`33333333-…`=thang.nguyen,
> `44444444-…`=hau.le). Count semantics giữ nguyên (S3: đúng 6 `STATUS_CHANGED`).
> `audit_logs` append-only — các dòng audit cũ giữ identifier cũ là có chủ ý.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng bảng `projects` + `audit_logs` sẵn có) |

> Stack chạy đúng **canonical ports** (`3000/3001/19006/5432/6379` trên `127.0.0.1`); không rebuild cho run này (không đổi product code).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` (manager-member của VDA2-W → đọc được detail, PATCH 403) |

Seed VDA2 (driver tạo, cleanup cuối run): `VDA2-A` (chuỗi lifecycle chính),
`VDA2-B` (invalid/idempotent), `VDA2-C` (race 409 UI), `VDA2-D` (race alreadyInState UI),
`VDA2-W` (worker, manager thang.nguyen), `VDA2-PM` (PM transition, manager hau.le),
`VDA2-R` (correlation). Tên realistic trong driver (`PROJ` map: Bến cảng logistics Cái Mép,
Cầu vượt An Sương, Kho lạnh Tân Cảng, Trạm biến áp Long Thành, Xưởng cơ khí Đông Anh,
Khu nghỉ dưỡng Suối Mơ, Đập thủy lợi Đa Nhim).
Không reset password — cả 3 login gốc đều còn hiệu lực.
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Cleanup (driver chạy đầu + cuối mỗi run, audit giữ nguyên — append-only, guard cấm DELETE/UPDATE):** id-based theo
  `projectIds` trong `e2e-vars.json` cũ + file `seed-002.sql` (xóa `project_members`/`attachments`/
  `project_areas`/`work_orders` tham chiếu → `projects` có `code LIKE 'VDA2-%'`, kèm fallback cửa sổ
  12h; re-runnable). Đã verify sau run quyết định: `VDA2-% rest=0`.
- **Lưu ý DDL:** `audit_logs` có trigger `audit_logs_append_only_guard()` (cấm DELETE/UPDATE/TRUNCATE) + partial unique
  `ux_audit_correlation_action (correlation_id, action)` → mỗi request kèm correlation trong driver dùng UUID mới.

## 4. Kịch bản & kết quả (run chuẩn hóa realistic, 11/11 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-002/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN tạo `VDA2-A` qua `/projects/new` → detail `Nháp` → dialog `Kích hoạt` (không reason) → `Kích hoạt dự án thành công`, detail `Đang hoạt động`; psql `ACTIVE`; audit `PRJ_PROJECT_STATUS_CHANGED` actor admin `DRAFT->ACTIVE` | 🟢 PASS | `S1-active.png` + HTTP/DB §5 |
| S2 | `PAUSE` (reason `Tạm dừng: chờ vật tư…`) → `Tạm dừng`; `RESUME` → `Đang hoạt động`; `COMPLETE` → `Hoàn thành`; `CLOSE` (reason `Đóng: đã nghiệm thu…`) → `Đóng` (mỗi bước API 200 + psql + detail UI); banner WO-guard khi CLOSED; reasons lưu cột audit `reason` | 🟢 PASS | `S2-closed.png` + §5 |
| S3 | `REOPEN` (reason `Mở lại: phát sinh hạng mục…`) từ CLOSED → 200 `Đang hoạt động`; psql `ACTIVE`; đủ 6 audit `STATUS_CHANGED` | 🟢 PASS | `S3-reopened.png` + §5 |
| S4 | `VDA2-B` DRAFT + `COMPLETE` → **409** `INVALID_TRANSITION`, `allowedTransitions=[ACTIVATE,CLOSE]`, psql vẫn `DRAFT`; UI detail DRAFT chỉ 2 nút (`Kích hoạt`/`Đóng`, không `Hoàn thành`); race UI (dialog Kích hoạt + API CLOSE trước) → banner `Không thể chuyển trạng thái từ Đóng… chỉ cho phép: Mở lại` | 🟢 PASS | `S4-invalid-ui.png` + §5 |
| S5 | `PAUSE` không reason → **400** `fieldErrors.reason`, psql `DRAFT` nguyên; UI (VDA2-A ACTIVE): dialog `Tạm dừng` xác nhận rỗng → lỗi client `Lý do là bắt buộc…`, **0 request** ra server, psql `ACTIVE` nguyên | 🟢 PASS | `S5-reason-required.png` + §5 |
| S6 | `ACTIVATE` lần 2 trên `VDA2-B` → 200 `alreadyInState:true`, audit `1→1`; race UI (`VDA2-D`): dialog + API ACTIVATE trước → notice `Dự án đã ở trạng thái này — không thay đổi gì thêm`, audit `1→1` | 🟢 PASS | `S6-already-in-state.png` + §5 |
| S7 | Worker1: `PATCH status` → **403**, psql `DRAFT` nguyên; worker là manager-member nên `GET detail=200` nhưng UI **0 nút** chuyển trạng thái (không hàng `Chuyển trạng thái:`) | 🟢 PASS | `S7-worker-detail.png` + §5 |
| S8 | Timeline `VDA2-A` hiện transitions + deep-link `Xem tất cả` (`entityType=PROJECT&entityId&result=SUCCESS`); psql dump đủ chuỗi 7 rows (`CREATED` + 6 transitions) đúng thứ tự, reasons đầy đủ — history append-only (§4a F1: cửa sổ 10 mới nhất) | 🟢 PASS | `S8-timeline.png` + §5 |
| S9 | PM `ACTIVATE` `VDA2-PM` qua API → 200 `ACTIVE`; audit actor `22222222-…` (pm) `DRAFT->ACTIVE` | 🟢 PASS | HTTP/DB §5 |
| S10 | `PATCH status` kèm `X-Correlation-Id` → audit `correlation_id` khớp; corr xấu (`not-a-uuid`) → **400** strict, psql `ACTIVE` nguyên | 🟢 PASS | HTTP/DB §5 |
| S11 | `GET /api/v1/audit-logs?entityType=PROJECT&entityId=&result=SUCCESS` → 16 rows **toàn** `PROJECT` của `VDA2-A` (gồm `CREATED` + `STATUS_CHANGED`), không lẫn `WORKER/CREW/CONTRACTOR` | 🟢 PASS | HTTP/DB §5 |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. Fixes & findings lịch sử (runs 2026-09-07, mã `E2E2-*` — tên cũ trước chuẩn hóa)

**Không có fix sản phẩm nào.** Các FAIL run cũ đều thuộc driver/scope:

- **F1 — lỗi driver `C is not defined` (đã fix trong driver):** S7 dùng `page.waitForFunction(() => … C.W …)` — closure Node không tồn tại trong browser context → `ReferenceError`. Fix: truyền code làm arg `waitForFunction((code) => …, C.W)`. Không phải bug sản phẩm.
- **F2 — assert timeline scope sai (đã mã hóa lại trong driver, ghi nhận — đúng thiết kế):** S8 run cũ đòi timeline hiện đủ 6 `Đổi trạng thái dự án`, thực tế chỉ 4. Nguyên nhân đã verify bằng psql độc lập: `StatusTimeline` là **cửa sổ 10 bản ghi mới nhất** (`TIMELINE_LIMIT`, `StatusTimeline.tsx:59-78`), và mỗi lần admin đọc detail, iam reads ghi thêm audit `PROJECT_SCOPE_ADMIN_BYPASS` **cùng `entity_id`** → 6 transitions bị đẩy bớt khỏi cửa sổ. History **không bị xóa/ghi đè** — psql dump đủ chuỗi đúng thứ tự (§5 S8), deep-link `Xem tất cả` (`entityType=PROJECT&entityId&result=SUCCESS`, `StatusTimeline.tsx:130`) dẫn tới full log. Driver assert đúng scope: timeline hiện transitions trong cửa sổ + deep-link đúng params + psql full-chain. File:line tham chiếu: `src/web/src/features/resources/components/StatusTimeline.tsx:59-78` (limit), `:130` (deep-link).

## 5. HTTP + DB outputs thật (run chuẩn hóa)

```
baseline audit=1048
S1  UI 'Tạo dự án thành công' → /projects có VDA2-A; detail Nháp → dialog Kích hoạt → 'Kích hoạt dự án thành công' → Đang hoạt động
    psql: status=ACTIVE
    audit: 11111111-…|PRJ_PROJECT_STATUS_CHANGED|PROJECT|DRAFT->ACTIVE
S2  PAUSE→PAUSED, RESUME→ACTIVE, COMPLETE→COMPLETED, CLOSE→CLOSED (API 200 + psql + detail UI từng bước)
    banner CLOSED: 'không nhận Work Order mới'; reasons audit: 'Tạm dừng: chờ vật tư…', 'Đóng: đã nghiệm thu…'
S3  REOPEN → 200 ACTIVE; psql ACTIVE; count STATUS_CHANGED=6
S4  DRAFT+COMPLETE → 409 {"code":"INVALID_TRANSITION","allowedTransitions":["ACTIVATE","CLOSE"]}; psql DRAFT
    UI DRAFT: Kích hoạt=1 Đóng=1 Hoàn thành=0; race UI → 'Không thể chuyển trạng thái từ Đóng…chỉ cho phép: Mở lại'; VDA2-C psql=CLOSED
S5  PAUSE thiếu reason → 400 fieldErrors.reason; VDA2-B psql=DRAFT
    UI: 'Lý do là bắt buộc…' + 0 request + Hủy; VDA2-A psql=ACTIVE
S6  API lần 2: 200 alreadyInState=true, audit 1→1; UI race: notice 'Dự án đã ở trạng thái này…', audit 1→1
S7  worker PATCH=403; VDA2-W psql=DRAFT; GET detail=200 (manager-member readable); UI 0 nút chuyển, không hàng 'Chuyển trạng thái:'
S8  timeline cửa sổ 10 (thấy 4 transitions + deep-link entityType=PROJECT); bypass rows=9
    psql ordered: PRJ_PROJECT_CREATED → STATUS_CHANGED DRAFT->ACTIVE → ACTIVE->PAUSED|Tạm dừng: chờ vật tư → PAUSED->ACTIVE → ACTIVE->COMPLETED → COMPLETED->CLOSED|Đóng: đã nghiệm thu → CLOSED->ACTIVE|Mở lại: phát sinh
S9  PM ACTIVATE → 200 ACTIVE; audit 22222222-…|DRAFT->ACTIVE
S10 PATCH corr=6f09d70c-… → audit correlation_id khớp; corr xấu 400; psql ACTIVE
S11 audit-logs filter → 16 rows toàn PROJECT của VDA2-A (CREATED + STATUS_CHANGED + SCOPE_BYPASS), không lẫn worker/crew
cleanup: VDA2-% rest=0, audit 1048→1080 (tăng do transitions hợp lệ; audit giữ nguyên)
```

## 6. Cách tái sinh

```bash
# 1. Stack đã chạy canonical ports — nếu cần rebuild từ working tree:
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự cleanup id-based + VDA2-% đầu/cuối run, audit giữ nguyên)
node docs/evidence/prj-srs-002/e2e-driver-prj-002.cjs
# 3. Seed/cleanup thủ công (nếu cần): xem seed-002.sql
```

## 7. Rủi ro / ghi chú

- Timeline detail là cửa sổ 10 bản ghi mới nhất, lẫn `PROJECT_SCOPE_ADMIN_BYPASS` do iam reads ghi cùng `entity_id`
  (F2 §4a) — full history xem qua deep-link `/admin/audit-logs?entityType=PROJECT&entityId&result=SUCCESS` hoặc psql.
- Worker là manager được auto-add member (PRJ-SRS-001 P9) nên đọc được detail của dự án mình quản lý (200),
  nhưng `PATCH status` vẫn 403 role-guard (đúng L2: ADMIN + PROJECT_MANAGER) và UI không render nút chuyển (fail-closed).
- `ux_audit_correlation_action` UNIQUE từng phần `(correlation_id, action)` → tái dùng correlation-id cho cùng action
  sẽ 409/500 ở tầng DB; driver luôn sinh UUID mới.
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`),
  Chrome `/usr/bin/google-chrome --no-sandbox`.
- Per-project scope write check (#37) và CLOSED→WO guard (JOB slices) chỉ ghi nhận trong docs, chưa enforce — đúng bounded decisions của slice.
