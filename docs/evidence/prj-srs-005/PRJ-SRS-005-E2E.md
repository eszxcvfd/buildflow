# PRJ-SRS-005 — E2E Evidence: Quản lý thành viên dự án (issue #36)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-07 UTC (`e2e-driver-prj-005.cjs`, run quyết định sau chuẩn hóa realistic = **11/11 PASS**).
> Lần chuẩn hóa realistic này đổi creds sang `@vinacons.vn`, mã runtime `E2E5-*` → `VDA5-*`
> (tên cũ trước chuẩn hóa — xem §4a), tái sử dụng tài khoản canonical `ba.nguyen@vinacons.vn`
> cho S9 thay vì tạo user mới. `audit_logs` append-only — các dòng audit cũ vẫn giữ
> identifier cũ (`admin@example.com`, `E2E5-*`, …) là có chủ ý (xem `docs/demo-data.md`).
> **Trạng thái tổng:** **11/11 PASS** — không phát hiện bug sản phẩm #36.
> **Phạm vi:** file mới dưới `docs/evidence/prj-srs-005/` — **không commit**, không đụng GitHub.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `3988129` — `feat(prj): project status lifecycle transitions (PRJ-SRS-002, #33)` (+ working tree chưa commit của API/Web slice #36) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy, rebuild từ working tree) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng bảng `project_members` + `audit_logs` sẵn có) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** (image cũ chưa có `GET|POST /projects/:id/members` — working tree chứa 3 use-cases + `ProjectMembers.tsx` chưa commit).
> Rebuild: `up -d --build api web` → probe `POST /api/v1/projects` (anon) **401 đúng contract**, `POST :id/members` với token ADMIN **201**.
> **Port-restore note:** trước rebuild đã kiểm tra `docker compose ps` — stack đang chạy đúng **canonical ports** (`3000/3001/19006/5432/6379` trên `127.0.0.1`), KHÔNG có stack alternate-port nào. Vì vậy không cần `down/up` khôi phục — rebuild trực tiếp từ `infra/docker/compose.yaml`, compose giữ nguyên port mapping sau rebuild (đã verify lại bằng `compose ps`: api/web `Up (healthy)`, rebuild xong `Created About a minute ago`).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` (canonical `docs/demo-data.md`) |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` (manager của VDA5-A/B/C/D → đọc detail, add/remove 403) |
| `hau.le@vinacons.vn` | WORKER | `E2EWorker2@2025` |
| `ba.nguyen@vinacons.vn` | WORKER | `E2E5W3@2025` — user id `98230b1d-…` (tài khoản canonical **tái sử dụng** cho S9 P11 — trước chuẩn hóa là `e2e5.worker3@example.com` tạo qua `POST /workers`; sau rename DB UUID giữ nguyên nên driver dùng luôn, không tạo user mới) |

Seed VDA5 (driver tạo, cleanup cuối run): `VDA5-A` = Trung tâm thương mại Vincom Thủ Đức (add/dup/remove/scope/guard), `VDA5-B` = Khu đô thị Sala Quận 2 (QC + UI race alreadyRemoved),
`VDA5-C` = Trường liên cấp Green Hill (WORKER + P11 manager swap), `VDA5-D` = Trung tâm chăm sóc khách hàng Vinacons (double-submit race). Manager cả 4 = worker1 (thang.nguyen).
Không reset password — login canonical còn hiệu lực (xem `docs/demo-data.md`).
> _Note: demo credentials theo `docs/demo-data.md` (fiction Vinacons). Never production._

## 3. Seed / cleanup

- **Cleanup (driver chạy đầu + cuối mỗi run, audit giữ nguyên — append-only, guard cấm DELETE/UPDATE):** file `seed-005.sql`
  (id-based theo `projectIds` trong `e2e-vars.json` của run trước + prefix `VDA5-%` + fallback
  cửa sổ 12h — canonical PRA/PRB/PRC/PRD không bị đụng).
  Đã verify sau run quyết định: `VDA5-% rest=0`.
- **Probe thủ công trước driver** (đã xóa, từ run gốc): `PROBE5-X` + `PROBE-DEL` (xóa projects, audit `PRJ_PROJECT_CREATED/ADDED/REMOVED/UPDATED` còn lại, truy vấn theo `entity_id` nên không lẫn vào VDA5).
- **Lưu ý DDL (§4a F2):** `audit_logs` có trigger append-only + partial unique `ux_audit_correlation_action` → mỗi request trong driver kèm correlation UUID mới; `GET /audit-logs` default `limit=20` (mới nhất trước) nên driver dùng `limit=100`.

## 4. Kịch bản & kết quả (run quyết định sau chuẩn hóa realistic, 11/11 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-005/shots/` (regenerate mới toàn bộ)

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN thêm worker2 (`ĐIỀU PHỐI`) vào `VDA5-A` qua UI (select user + role → `Đã thêm…`) → list hiện `Lê Văn Hậu · ĐIỀU PHỐI`; `GET members` có row `COORDINATOR/isActive`; psql `COORDINATOR\|true\|added_by=admin`; audit `PRJ_PROJECT_MEMBER_ADDED` actor admin; worker2 token `GET detail=200` (before-removal) | 🟢 PASS | `S1-added.png` + HTTP/DB §5 |
| S2 | Thêm lại worker2 (UI + API) → UI field error `Thành viên đã trong dự án` (`#member-add-user-error`), API **409** `MEMBER_DUPLICATE`; active rows `(A,worker2)=1`, không audit mới | 🟢 PASS | `S2-duplicate.png` + §5 |
| S3 | Thêm worker2 `QC` vào `VDA5-B` + `WORKER` vào `VDA5-C` → detail B badge `QC`, detail C badge `THÀNH VIÊN`; psql `[QC,WORKER]` | 🟢 PASS | `S3-badges.png` + §5 |
| S4 | Xóa worker2 khỏi `VDA5-A` qua UI (confirm inline + reason `Kết thúc giai đoạn 1 (đợt T9/2026)`, counter `/500`) → `Đã xóa…`; bật `Xem lịch sử` → badge `Đã rời` + `Giai đoạn: joined→left`; psql `is_active=false, left_at set`; audit `PRJ_PROJECT_MEMBER_REMOVED` có reason, count `+1` | 🟢 PASS | `S4-removed.png`, `S4-history.png` + §5 |
| S5 | worker2 token `GET /projects/:id` detail A: **200 (trước remove) → 403** `Không có quyền truy cập dự án này` (per-project scope — worker2 vẫn còn member ở B/C); admin `GET audit-logs entityId=A limit=100` đủ `ADDED+REMOVED`; worker2 query audit → **403** (audit admin-only) | 🟢 PASS | HTTP/DB §5 |
| S6 | `DELETE` lần 2 membership A → 200 `alreadyRemoved:true`, audit `REMOVED 1→1`; UI race trên B (mở confirm → API xóa trước → `Xác nhận xóa`) → notice `…đã rời dự án trước đó — không thay đổi gì thêm` | 🟢 PASS | `S6-already-removed.png` + §5 |
| S7 | `DELETE` membership của manager (worker1) ở A → **409** `MANAGER_MEMBER`; UI row manager badge `QUẢN LÝ` + hint `Đổi quản lý qua Sửa hồ sơ`, **0 nút** `Xóa khỏi dự án` | 🟢 PASS | `S7-manager-guard.png` + §5 |
| S8 | `POST members {projectRole:MANAGER}` → **400** `fieldErrors.projectRole` (`…chỉ đặt qua PATCH /projects/:id managerId`); UI select vai trò đúng 4 options (`ĐIỀU PHỐI/QC/THÀNH VIÊN/XEM`, không `MANAGER`) | 🟢 PASS | `S8-roles.png` + §5 |
| S9 | Edit form (`/projects/:id/edit`) đổi quản lý C → worker3 (ba.nguyen, tái sử dụng) → `Cập nhật dự án thành công`; psql worker3 `MANAGER\|true\|added_by=admin` (insert auto P11); worker1 `MANAGER\|true` untouched; worker3 token `GET detail=200`, `managerId=worker3` | 🟢 PASS | `S9-new-manager.png` + §5 |
| S10 | Worker1 (role WORKER): `POST members` → **403**, `DELETE` → **403**; UI detail hiện card `Không có quyền… (403)` (GET members cũng ADMIN+PM) | 🟢 PASS | `S10-worker403.png` + §5 |
| S11 | `VDA5-D`: 2× `POST` đồng thời (worker2 COORDINATOR) → **201+409**, active rows `=1` (unique `ux_project_members_active`); UI nút `Thêm vào dự án` disabled khi thiếu field | 🟢 PASS | `S11-form.png` + §5 |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. Lịch sử fixes + tên cũ trước chuẩn hóa

**Tên cũ trước chuẩn hóa realistic (2026-09-07):** mã `E2E5-A/B/C/D` (nay `VDA5-A/B/C/D`),
tên `Công trình E2E5-*` (nay pool Vincom Thủ Đức / Sala Q.2 / Green Hill / TT CSKH Vinacons),
`worker1@example.com` (nay `thang.nguyen@vinacons.vn` — Nguyễn Văn Thắng),
`Lê Văn Thợ` (nay `Lê Văn Hậu` — `hau.le@vinacons.vn`),
`e2e5.worker3@example.com` (nay `ba.nguyen@vinacons.vn` — Nguyễn Văn Ba, cùng UUID),
reason `Kết thúc giai đoạn 1 E2E5` (nay `… (đợt T9/2026)`). Các dòng `audit_logs` cũ giữ
nguyên tên cũ theo thiết kế append-only.

**Không có fix sản phẩm nào.** Tất cả FAIL trong các run gốc đều thuộc driver/assert:

- **F1 — `waitForSelector` option sai state (đã fix):** `<option>` trong `<select>` luôn `hidden` với Playwright → timeout dù option đã có (`Lê Văn Thợ · 44444444` — tên cũ trước chuẩn hóa — resolved to hidden). Fix: `{ state: 'attached' }` cho cả `#member-add-user option` lẫn `#project-manager option`. Ảnh hưởng S1–S4, S6–S9, S11 run 1. Không phải bug sản phẩm.
- **F2 — audit `limit` mặc định (đã fix):** `GET /audit-logs` default `limit=20`, mới nhất trước → `PROJECT_SCOPE_ADMIN_BYPASS` (ghi mỗi lần admin đọc detail, xem PRJ-SRS-002 §4a F2) đẩy `ADDED/REMOVED` khỏi trang. Fix: `limit=100`. Không phải bug sản phẩm.
- **F3 — S6 `memberIdA=null` (hệ quả F1):** S1 fail trước khi gán `memberIdA` → `DELETE …/members/null` → 400 ParseUUID. Tự hết sau fix F1. Không phải bug sản phẩm.
- **F4 — assert psql sai cast bool (đã fix, run 2→3):** `is_active::text` trả `true/false`, driver mong `t/f` (nhầm với output display không cast). Fix 3 asserts S1/S4/S9. Không phải bug sản phẩm.
- **Ghi nhận (đúng thiết kế, không fix):** P11 auto-insert KHÔNG sinh audit `MEMBER_ADDED` riêng — chỉ `PRJ_PROJECT_UPDATED` (`update-project.use-case.ts:173-223`); worker2 query `/audit-logs` → **403** (audit read admin-only, history quá khứ do admin query); `S10` worker1 `DELETE` → **403** (role-guard chạy trước `MANAGER_MEMBER`).

## 5. HTTP + DB outputs thật (run quyết định sau chuẩn hóa)

```
baseline audit=1115
S1  UI 'Đã thêm Lê Văn Hậu…ĐIỀU PHỐI' → list Lê Văn Hậu · ĐIỀU PHỐI
    GET members: {userId:4444…|COORDINATOR|isActive:true}
    psql: COORDINATOR|true|11111111-1111-4111-8111-111111111111 (role|is_active|added_by)
    audit: 11111111-…|PRJ_PROJECT_MEMBER_ADDED (actor admin)
    worker2 GET detail (before) = 200
S2  UI field #member-add-user-error 'Thành viên đã trong dự án'
    API dup → 409 {"code":"MEMBER_DUPLICATE"}; psql active (A,w2)=1
S3  B add QC → 201; C add WORKER → 201; UI badges QC / THÀNH VIÊN; psql [QC,WORKER]
S4  UI 'Đã xóa…' → history checkbox → 'Đã rời' + 'Giai đoạn: …'
    psql: false|set (is_active|left_at); audit REMOVED reason='Kết thúc giai đoạn 1 (đợt T9/2026)', count +1
S5  worker2 GET detail A: 200→403 {"message":"Không có quyền truy cập dự án này"}
    admin audit-logs (limit=100): 6 rows gồm ADDED+REMOVED; worker2 audit query=403
S6  API lần 2: 200 alreadyRemoved=true, audit REMOVED 1→1
    UI race B: notice '…đã rời dự án trước đó — không thay đổi gì thêm'
S7  manager del → 409 {"code":"MANAGER_MEMBER"}; UI hint + 0 nút Xóa
S8  POST MANAGER → 400 fieldErrors.projectRole ['Quản lý dự án chỉ đặt qua PATCH /projects/:id managerId']
    UI roles [— Chọn vai trò —/ĐIỀU PHỐI/QC/THÀNH VIÊN/XEM]
S9  UI 'Cập nhật dự án thành công'
    psql C: 98230b1d-…|MANAGER|true|11111111-… (worker3 auto, added_by admin)
    psql C: 33333333-…|MANAGER|true (worker1 cũ untouched)
    worker3 GET detail=200, managerId=worker3
    audit: PRJ_PROJECT_UPDATED (không MEMBER_ADDED riêng cho P11 — đúng thiết kế)
S10 worker1 POST=403 DELETE=403; UI card 'Không có quyền…(403)'
S11 race POST×2 → 201+409; psql active (D,w2)=1; UI submit disabled khi thiếu field
cleanup: VDA5-% rest=0, audit 1115→1139 (tăng do ADDED/REMOVED/UPDATED hợp lệ; audit giữ nguyên)
```

## 6. Cách tái sinh

```bash
# 0. Không cần chuẩn bị login — dùng tài khoản canonical docs/demo-data.md
#    (hoang.anh / quoc.tran / thang.nguyen / hau.le / ba.nguyen).
# 1. Stack đã chạy đúng canonical ports thì không cần rebuild (slice này không
#    đổi product code); nếu cần:
#    DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
#      docker compose -f infra/docker/compose.yaml up -d api web
# 2. Chạy driver (tự cleanup id-based + VDA5-% + 12h fallback đầu/cuối run, audit giữ nguyên)
node docs/evidence/prj-srs-005/e2e-driver-prj-005.cjs
# 3. Seed/cleanup thủ công (nếu cần): xem seed-005.sql
```

## 7. Rủi ro / ghi chú

- Per-project scope write check (#37) vẫn defer như API slice — S5 chỉ chứng minh read-scope (`GET detail` 403) + write role-guard (S10 403).
- `GET :id/members` dùng PROJECT_WRITE_ROLES (ADMIN+PM) thay vì read roles theo M5 binding — S10 chứng minh worker-manager bị 403 cả list; đúng defer đã record.
- P11 không audit `MEMBER_ADDED` riêng cho membership auto (chỉ `PRJ_PROJECT_UPDATED`) — đã verify là thiết kế (`update-project.use-case.ts:173-223`), ghi nhận để reviewer quyết có cần bổ sung.
- Không reset password, không tạo user (dùng 5 tài khoản canonical `docs/demo-data.md` nguyên trạng; cleanup member-history không chạm `users`).
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- `ux_audit_correlation_action` UNIQUE từng phần → driver sinh UUID correlation mới mỗi request.
- Chuẩn hóa realistic 2026-09-07 (xem `docs/demo-data.md`): creds → `@vinacons.vn`,
  mã runtime `E2E5-*` → `VDA5-*` (id-based cleanup + prefix + fallback 12h trong `seed-005.sql`),
  user S9 tái sử dụng `ba.nguyen@vinacons.vn` thay vì tạo mới. Tên cũ trước chuẩn hóa
  giữ trong §4a; `audit_logs` cũ giữ identifier cũ theo thiết kế append-only.
