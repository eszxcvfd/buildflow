# PRJ-SRS-004 — E2E Evidence (bổ sung A/B/C/D, issue #35)

> **Ghi chú Run 2:** đây là lần chạy thứ hai (run 2) trên stack commit `098272d` (web rebuild từ HEAD, xem §1).
> Run 2 đã ghi đè tại chỗ 5 ảnh trùng tên với run 1 (`A4-validation`, `B4-excluded`, `C1-pm-created`, `C1-pm-list`, `D1-audit`).
> Cặp report/ảnh run 1 (`PRJ-SRS-004-E2E.md`) cho 5 tên này đã bị thay thế — chỉ S1–S9 của run 1 giữ nguyên giá trị.

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-004.cjs`, **13/13 PASS**).
> **Trạng thái tổng:** **13/13 PASS** — không phát hiện bug sản phẩm #35.
> **Phạm vi:** file mới `e2e-driver-prj-004.cjs`, `e2e-vars-prj-004.json`,
> shots `A*/B*/C*/D*`, report này — **không commit**, không đụng GitHub.
>
> **Quan hệ với `PRJ-SRS-004-E2E.md` (S1–S9, đã commit trong `098272d`):**
> report này BỔ SUNG, không thay thế — S1–S9 cover vertical slice
> (create/detail/edit-bump/conflict/deactivate/picker/inactive-detail/
> trade-400/duration-priority-preview); A/B/C/D cover các nhánh còn lại:
> duplicate-409 UI (A3), client-validation duration (A4), alreadyInState (B2),
> reactivate (B3), picker exclusion qua `?status=ACTIVE` (B4), PM create (C1),
> worker 403 UI (C2), anon 401 (C3), audit-logs UI filter (D1).
> Đặt tên file addendum (thay vì ghi đè `PRJ-SRS-004-E2E.md`) và vars riêng
> (`e2e-vars-prj-004.json`) để không đè bằng chứng S1–S9.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` (branch `main`) |
| Commit HEAD | `098272d` — `feat(prj,web): work-type catalog (PRJ-SRS-004, #35)` (working tree sạch trừ evidence uncommitted) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy — **rebuild từ HEAD**, đã serve form mới) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` (migration 0007 đã apply) |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |

> Web container được rebuild sạch (`compose build web` + `up -d web`, service
> `web`, context `../../src/web`) vì image cũ chưa serve form mới
> (`#worktype-duration`/`#worktype-priority`/panel `Xem trước cấu hình` —
> đã verify bằng browser trước/sau rebuild: `0/0/false` → `1/1/true`).
> Lưu ý build: `~/.docker` read-only trong môi trường chạy → dùng
> `DOCKER_CONFIG=/tmp/dockercfg BUILDX_CONFIG=/tmp/buildx2
> DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock`.

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN (`11111111-…`) | `E2EAdmin@2025` |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER (`22222222-…`) | `E2EPm@2025` |
| `thang.nguyen@vinacons.vn` | WORKER (`33333333-…`) | `E2EWorker@2025` |

> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Không seed cố định:** mã `WT-E2E-<digits>` (`D6=650616` ở run quyết định —
  T1 `WT-E2E-650616`, TX `WT-E2E-X650616`, PM `WT-E2E-P650616`, A4
  `WT-E2E-V650616`). Tên hiển thị realistic, không chứa `E2E`.
- **Cleanup (đầu + cuối run, prefix `code LIKE 'WT-E2E-%'`, audit giữ nguyên):**
  đã verify sau run quyết định: `WT-E2E-% rest=0`.
- **Audit:** append-only; run quyết định `audit 2201→2211` (+10 =
  CREATED×3 + UPDATED×1 + STATUS_CHANGED×3 của run + audit các lượt đăng nhập).

## 4. Kịch bản & kết quả (run quyết định, 13/13 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-004/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| A1 | ADMIN login → `/work-types` list loads (toolbar `Tổng:` + table) | 🟢 PASS | `A1-list.png` |
| A2 | Dialog Thêm mới: code/name/group/trade ACTIVE (`THO-CAT`)/2 fields/`duration 120`/`priority HIGH` → panel **Xem trước cấu hình** hiện `120 phút`/`Cao`/chips `Diện tích (m²)`+`Ảnh nghiệm thu` → submit → toast + row hiện trong list; API `duration=120 priority=HIGH v1 fields=2`; psql + audit `PRJ_WORK_TYPE_CREATED` actor admin | 🟢 PASS | `A2-preview.png`, `A2-created.png` + §5 |
| A3 | Tạo trùng mã → UI field error ở **Mã** `Mã loại công việc đã tồn tại` (dialog không crash, đóng bình thường); API POST trùng → **409** `WORK_TYPE_CODE_DUPLICATE`; `rows=1` | 🟢 PASS | `A3-duplicate.png` + §5 |
| A4 | `duration='abc'` → lỗi client-side `Thời lượng mặc định phải là số nguyên dương (phút)`, dialog ở lại, không submit; `count=0` | 🟢 PASS | `A4-validation.png` + §5 |
| A5 | Detail: `Phiên bản cấu hình v1` + API `usage.workOrders=0`; dialog Sửa prefill đúng (code + `duration=120`) + preview hiện; đổi tên → toast + detail mới; API `configVersion=2`; psql `code\|name\|2\|true`; audit `PRJ_WORK_TYPE_UPDATED` actor admin | 🟢 PASS | `A5-detail.png`, `A5-edit-prefill.png`, `A5-updated.png` + §5 |
| B1 | StatusDialog `Ngừng hoạt động` + reason `Tạm ngừng cho E2E` → success + badge `Ngừng hoạt động`; psql `is_active=false`; audit `STATUS_CHANGED` reason đủ | 🟢 PASS | `B1-deactivated.png` + §5 |
| B2 | DEACTIVATE lặp → **200** `alreadyInState:true`; audit `STATUS_CHANGED` count `1→1` (không dòng mới) | 🟢 PASS | `B4-…`/`B2-already.png` + §5 |
| B3 | StatusDialog `Kích hoạt lại` + reason → `Đã kích hoạt lại` + badge `Hoạt động`; API `status=ACTIVE` | 🟢 PASS | `B3-reactivated.png` + §5 |
| B4 | Tạo TX → deactivate → `GET /api/v1/work-types?status=ACTIVE` (`total=5`): KHÔNG chứa TX, vẫn chứa T1 đã reactivate, toàn row `ACTIVE`; detail TX hiện `Bị chặn` → chứng minh inactive bị loại khỏi picker giao dịch mới | 🟢 PASS | `B4-excluded.png` + §5 |
| C1 | PM login → list đọc được (thấy T1) + tạo `WT-E2E-P650616` qua dialog → hiện trong list; audit `PRJ_WORK_TYPE_CREATED` actor PM (`22222222-…`) — đúng matrix §13 (ADMIN+PM write) | 🟢 PASS | `C1-pm-list.png`, `C1-pm-created.png` + §5 |
| C2 | Worker: API `GET`=**403**; UI `/work-types` hiện alert `Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)` + nút `Thử lại` | 🟢 PASS | `C2-worker403.png` + §5 |
| C3 | Anonymous `GET /api/v1/work-types` → **401** | 🟢 PASS | HTTP §5 |
| D1 | `/admin/audit-logs?entityType=WORK_TYPE` (deep-link filter) → table hiện `PRJ_WORK_TYPE_CREATED` + `PRJ_WORK_TYPE_STATUS_CHANGED` + actor rút gọn `11111111` (admin) / `22222222` (PM) | 🟢 PASS | `D1-audit.png` + §5 |

**Tổng: 13 PASS / 0 FAIL / 13 mục. Screenshots A/B/C/D: 16 files.**

### 4a. Lịch sử fixes (driver — không fix sản phẩm)

- **F1 — dialog flake (đã fix):** form re-render khi trades load + preview live
  có thể detach node giữa chừng (`domSetValue failed`, submit `detached`).
  Fix: mọi tương tác trong dialog scope vào `.bf-dialog` (bài học F2 của driver
  S1–S9: `worktype-group` trùng id với filter sau lưng), click qua DOM
  (`dlgClick`), fill retry toàn khối (`fillCreateForm`, 3 attempts).
- **F2 — `dlg().waitForFunction is not a function` (đã fix):** `waitForFunction`
  là method của Page, không phải Locator — chuyển sang
  `page.waitForFunction` với selector `.bf-dialog #worktype-trade`. Lỗi driver
  thuần túy, không phải bug sản phẩm.
- **Ghi nhận (đúng thiết kế, không fix):** `reason` NULL ở audit CREATED/UPDATED
  khi không truyền reason (W7 — reason chỉ ghi khi có); `alreadyInState` không
  sinh audit (W5); worker `GET` → 403 trước mọi logic khác.

## 5. HTTP + DB outputs thật (run quyết định, D6=650616)

```
baseline: audit=2201, trade ACTIVE dùng cho requiredTrade: THO-CAT — Tho cat gach
A1  login admin → list loads (toolbar Tổng + table)
A2  preview đủ 'Xem trước cấu hình' + '120 phút' + 'Cao' + chips Diện tích (m²)/Ảnh nghiệm thu
    tạo WT-E2E-650616 → API {defaultDurationMinutes:120|defaultPriority:HIGH|configVersion:1|fields:2}
    audit: 11111111-…|PRJ_WORK_TYPE_CREATED (actor admin)
A3  UI field Mã 'Mã loại công việc đã tồn tại' (dialog không crash)
    API dup → 409 {"code":"WORK_TYPE_CODE_DUPLICATE"}; psql rows(WT-E2E-650616)=1
A4  UI 'Thời lượng mặc định phải là số nguyên dương (phút)'; dialog ở lại; psql rows(WT-E2E-V650616)=0
A5  detail v1 + API usage.workOrders=0; prefill code + duration=120 + preview đủ
    đổi tên → API {name mới|configVersion:2}
    psql: WT-E2E-650616|Ốp lát tường vệ sinh 650616 (cập nhật)|2|t
    audit: 11111111-…|PRJ_WORK_TYPE_UPDATED (actor admin)
B1  UI 'Đã chuyển sang Ngừng hoạt động' + badge; psql is_active=false
    audit STATUS_CHANGED reason='Tạm ngừng cho E2E'
B2  API lần 2: 200 alreadyInState=true; audit STATUS_CHANGED 1→1 (không dòng mới)
B3  UI 'Đã kích hoạt lại' + badge Hoạt động; API status=ACTIVE
B4  TX WT-E2E-X650616 tạo (201) → INACTIVE (200)
    GET ?status=ACTIVE total=5: loại trừ TX, giữ T1, toàn ACTIVE
C1  PM đọc list (thấy T1) + tạo WT-E2E-P650616 → audit CREATED actor 22222222-… (PM)
C2  worker API GET=403; UI alert 403 + nút Thử lại
C3  anon GET /api/v1/work-types → 401
D1  audit UI đủ PRJ_WORK_TYPE_CREATED/STATUS_CHANGED + actor 11111111/22222222
```

psql verbatim (trước cleanup):

```sql
SELECT code, name, config_version, is_active FROM work_types WHERE code LIKE 'WT-E2E-%' ORDER BY code;
-- WT-E2E-650616|Ốp lát tường vệ sinh 650616 (cập nhật)|2|t
-- WT-E2E-P650616|Sơn nước mặt tiền 650616|1|t
-- WT-E2E-X650616|Đổ bê tông lót 650616|1|f

SELECT action, entity_type, reason FROM audit_logs WHERE entity_type='WORK_TYPE' ORDER BY created_at DESC LIMIT 10;
-- PRJ_WORK_TYPE_CREATED|WORK_TYPE|
-- PRJ_WORK_TYPE_STATUS_CHANGED|WORK_TYPE|Giữ mẫu kiểm chứng picker loại trừ inactive
-- PRJ_WORK_TYPE_CREATED|WORK_TYPE|
-- PRJ_WORK_TYPE_STATUS_CHANGED|WORK_TYPE|Mở lại sau E2E
-- PRJ_WORK_TYPE_STATUS_CHANGED|WORK_TYPE|Tạm ngừng cho E2E
-- PRJ_WORK_TYPE_UPDATED|WORK_TYPE|
-- PRJ_WORK_TYPE_CREATED|WORK_TYPE|
-- PRJ_WORK_TYPE_STATUS_CHANGED|WORK_TYPE|Giữ mẫu kiểm chứng picker loại trừ inactive
-- PRJ_WORK_TYPE_CREATED|WORK_TYPE|
-- PRJ_WORK_TYPE_UPDATED|WORK_TYPE|
```

```
cleanup: WT-E2E-% rest=0, audit 2201→2211 (tăng do CREATED/UPDATED/STATUS_CHANGED hợp lệ; audit giữ nguyên)
```

## 6. Ghi chú forward-ref + tính năng mới

- (a) **JOB-side là forward-ref sang JOB-SRS-001/002 (#41/#42)** vì module
  work-order chưa tồn tại: `inactive type not selectable for NEW Work Orders
  via UI create`, `publish enforces required data server-side`,
  `config snapshot on work_orders`. API đã expose `usage.workOrders` +
  `configVersion` cho việc này (ENDPOINTS §14 W6). Bằng chứng E2E này chỉ tới
  được contract: B4 (`?status=ACTIVE` loại trừ inactive — chính picker mà JOB
  sẽ đọc), A5 (`usage.workOrders=0` hôm nay), B1 (`warning` kèm khi WO tham
  chiếu — chưa trigger được vì chưa có WO).
- (b) **Form mới + preview:** A2 (nhập `120`/`HIGH` → preview `120 phút`/`Cao`/
  chips → lưu đúng DB), A4 (validation `abc` chặn submit client-side), A5
  (edit prefill `duration=120` + preview hiện) — xem thêm S9 ở report S1–S9
  (đổi duration/priority không bump version, đúng W4).

## 7. Cách tái sinh

```bash
# 1. Stack canonical ports; nếu web chưa serve form mới thì rebuild đúng service web:
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml build web
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d web
# 2. Chạy driver (tự cleanup prefix WT-E2E-% đầu/cuối run, audit giữ nguyên):
node docs/evidence/prj-srs-004/e2e-driver-prj-004.cjs
# 3. Vars run quyết định: docs/evidence/prj-srs-004/e2e-vars-prj-004.json
```

## 8. Rủi ro / ghi chú

- Driver ghi vars riêng (`e2e-vars-prj-004.json`) để không đè `e2e-vars.json`
  của driver S1–S9 (file đó + report S1–S9 đã commit trong `098272d`).
- Trong lúc chạy task, file driver `e2e-driver-prj-004.cjs` (bản đầu) đã bị
  xóa khỏi working tree bởi tác nhân khác (không rõ) — đã viết lại đầy đủ +
  cứng hóa (dialog-scope, retry) và **13/13 PASS** trên stack hiện tại
  (`098272d`, api/web rebuild 5 phút trước run). Lead quyết định giữ/gộp/đổi
  tên report này với `PRJ-SRS-004-E2E.md`.
- `warning` khi deactivate/config-đổi trong khi WO tham chiếu không covered
  (chưa có WO — xem §6a); case-race `ux_work_types_code` xem report S1–S9 §8.
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path
  `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome
  --no-sandbox`. Writes kèm `X-Correlation-Id` UUID mới mỗi request.
