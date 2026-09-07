# PRJ-SRS-003 — E2E Evidence: Khu vực / hạng mục dự án (issue #34)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-07 UTC (`e2e-driver-prj-003.cjs`, 2 runs: run 1 = 4/8 do 2 lỗi driver (§4a F1–F2); run 2 sau fix = **8/8 PASS**; run 3 re-verify sau polish slice P2/P3 (migration 0006 + 5 code/doc fix) = **8/8 PASS**, audit `810→824`).
> **Trạng thái tổng:** **8/8 PASS** — không phát hiện bug sản phẩm #34.
> **Phạm vi:** file mới dưới `docs/evidence/prj-srs-003/` — **không commit**, không đụng GitHub.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `bed7980` — `feat(prj): project member management + manager-membership sync (PRJ-SRS-005, #36)` (+ working tree chưa commit của API/Web slice #34) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy, rebuild từ working tree) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | **0005 mới trong slice này + 0006 polish (case-insensitive)** — đã apply trong container trước run quyết định (`npm run db:migrate`: `apply 0005…` / run 3: `apply 0006_prj_srs003_area_name_ci.sql`; `schema_migrations` 0001–0006 đủ; index `ux_project_areas_active_name_ci (project_id, lower(name)) WHERE is_active` đã verify qua `pg_indexes`) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** (image cũ chưa có `POST|GET /projects/:id/areas` + `PATCH …/areas/:areaId` và `ProjectAreas.tsx` — working tree chứa use-cases + panel chưa commit).
> Rebuild: `up -d --build api web` → probe `POST /api/v1/projects` (anon) **401 đúng contract**, route areas đã map trong log khởi động (`Mapped {/api/v1/projects/:projectId/areas, POST|GET}` + `PATCH …/:areaId`).
> **Port note:** trước rebuild đã kiểm tra `docker compose ps` — stack đang chạy đúng **canonical ports** (`3000/3001/19006/5432/6379` trên `127.0.0.1`), KHÔNG có stack alternate-port nào. Vì vậy không cần `down/up` khôi phục — rebuild trực tiếp từ `infra/docker/compose.yaml`, compose giữ nguyên port mapping sau rebuild (đã verify lại bằng `compose ps`: api/web `Up (healthy)`).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `admin@example.com` | ADMIN | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `pm@example.com` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003; member COORDINATOR của E2E3-B cho S6) |
| `worker1@example.com` | WORKER | `E2EWorker@2025` (manager của E2E3-A/B → đọc detail, write 403 cho S6) |

Seed E2E3 (driver tạo, cleanup cuối run): `E2E3-A` (S1–S8: create/dup/rename/deactivate/idempotent/perms/404/activeOnly), `E2E3-B` (S6 cross-PM). Manager cả 2 = worker1.
Không reset password — login gốc còn hiệu lực.
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production. Creds trong driver env-overridable (`E2E_ADMIN_PASS`/`E2E_PM_PASS`/`E2E_WORKER_PASS`, default giữ giá trị bảng trên để driver chạy được ngay)._

## 3. Seed / cleanup

- **Cleanup (driver chạy đầu + cuối mỗi run, audit giữ nguyên — append-only, guard cấm DELETE/UPDATE):** file `seed-003.sql`
  (xóa `work_orders` → `attachments` → `project_areas` → `project_members` → `projects` có `code LIKE 'E2E3-%'`).
  Đã verify sau run quyết định: `E2E3-% rest=0`.
- **Probe thủ công trước driver** (đã xóa): `PROBE3-X` + area `Khu A` (verify 0005 + UUID correlation; audit `PRJ_PROJECT_AREA_ADDED` còn lại, truy vấn theo `entity_id` nên không lẫn vào E2E3).
- **Lưu ý DDL (§4a F1):** `audit_logs` có trigger append-only + partial unique `ux_audit_correlation_action` → mỗi request trong driver kèm correlation UUID mới; audit area có `entity_type=PROJECT`, **`entity_id` = project id** (không phải area id) — driver query theo project.

## 4. Kịch bản & kết quả (run 2 — run quyết định, 8/8 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-003/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN tạo `E2E3-A` (manager worker1) + tạo area `Khu E2E3 Alpha` qua UI (`Đã thêm khu vực…`) → list hiện tên; `GET areas` có row `isActive:true`; psql `Khu E2E3 Alpha\|true`; audit `PRJ_PROJECT_AREA_ADDED` actor admin + `after_data.name=Alpha` | 🟢 PASS | `S1-created.png` + HTTP/DB §5 |
| S2 | Tạo lại `Khu E2E3 Alpha` (UI + API) → UI field error `#area-add-name-error` (`…đã tồn tại trong dự án`), API **409** `AREA_DUPLICATE`; active rows `(A,Alpha)=1` | 🟢 PASS | `S2-duplicate.png` + §5 |
| S3 | Đổi tên qua UI (`Đổi tên` → `Lưu` → `Đã đổi tên khu vực…`) → list `Khu E2E3 Alpha Đổi Tên`; psql name mới; audit `PRJ_PROJECT_AREA_UPDATED` `before=Alpha\|after=Alpha Đổi Tên`, count `+1` | 🟢 PASS | `S3-renamed.png` + §5 |
| S4 | Ngừng sử dụng qua UI (confirm inline + reason `Gộp khu E2E3 để kiểm thử`, counter `/500`) → `Đã ngừng sử dụng…` + badge `Ngừng sử dụng`; psql `is_active=false` (**row còn — no hard delete**); audit `UPDATED` reason đủ | 🟢 PASS | `S4-deactivated.png` + §5 |
| S5 | `PATCH isActive:false` lần 2 → 200 `alreadyInactive:true`; audit `UPDATED 2→2` (không tăng) | 🟢 PASS | HTTP/DB §5 |
| S6 | Worker1 (role WORKER, manager A): UI read-only note + **0 nút** (`Thêm khu vực`/`Đổi tên`/`Ngừng sử dụng`); API POST + PATCH → **403**; PM chỉ member B → POST/PATCH area vào A → **403** (ID tampering) | 🟢 PASS | `S6-worker-readonly.png` + §5 |
| S7 | `PATCH` areaId UUID lạ → **404** `Không tìm thấy khu vực trong dự án` | 🟢 PASS | HTTP §5 |
| S8 | Tạo `Khu E2E3 Beta` → `GET` default `total=2 [Alpha2,Beta]`; `GET ?activeOnly=true` `total=1 [Beta]` toàn `isActive:true`; UI toggle `Chỉ hiện khu vực đang sử dụng` → chỉ Beta | 🟢 PASS | `S8-activeonly.png` + §5 |

**Tổng: 8 PASS / 0 FAIL / 8 mục.**

### 4a. Fixes & findings — run 1 (4/8) → run 2 (8/8)

**Không có fix sản phẩm nào.** Tất cả FAIL đều thuộc driver/assert:

- **F1 — audit `entity_id` là project id, không phải area id (đã fix):** audit area dùng `entity_type=PROJECT` + `entity_id=<projectId>` (đúng A4/tx-embedded design của api-slice) — driver query `entity_id=<areaId>` nên rỗng. Fix: query theo `entity_id=idA` + lọc `after_data->>'name'`. Ảnh hưởng S1, S3, S4 run 1; S5 fail cascade (biến `auditUpdatedAfterS4=null`). Không phải bug sản phẩm.
- **F2 — SQL `->>` vs `||` precedence (đã fix, S3):** `before_data->>'name'||'| '` bị parse thành `->> ('name'||'| ')` → `operator does not exist: text ->> unknown`. Fix: ngoặc `(before_data->>'name')||…`. Không phải bug sản phẩm.
- **Ghi nhận (đúng thiết kế, không fix):** row deactivate giữ `before.name=after.name` (chỉ lật `isActive`), reason lưu ở audit row; worker1 là manager nhưng role WORKER → write 403 (role-guard đúng A4: ADMIN+PM mới write); `activeOnly` default off, list luôn kèm inactive (badge xám).

## 5. HTTP + DB outputs thật (run 2)

```
baseline audit=792
S1  UI 'Đã thêm khu vực "Khu E2E3 Alpha"…'
    GET areas: {name:Khu E2E3 Alpha|isActive:true}
    psql: Khu E2E3 Alpha|true (name|is_active)
    audit: 11111111-…|PRJ_PROJECT_AREA_ADDED (actor admin, after_data.name=Alpha)
S2  UI field #area-add-name-error '…đã tồn tại trong dự án'
    API dup → 409 {"code":"AREA_DUPLICATE"}; psql active (A,Alpha)=1
S3  UI 'Đã đổi tên khu vực thành "Khu E2E3 Alpha Đổi Tên"'
    psql name=Khu E2E3 Alpha Đổi Tên
    audit: before|after = Khu E2E3 Alpha| Khu E2E3 Alpha Đổi Tên; UPDATED +1
S4  UI 'Đã ngừng sử dụng khu vực "…" — lịch sử vẫn được giữ' + badge Ngừng sử dụng
    psql is_active=false (row còn — không hard delete)
    audit UPDATED reason='Gộp khu E2E3 để kiểm thử'
S5  API lần 2: 200 alreadyInactive=true; audit UPDATED 2→2 (không tăng)
S6  worker UI note 'Chỉ ADMIN và PROJECT_MANAGER…' + 0 nút write
    worker POST=403 PATCH=403; pm-ngoài-A POST=403 PATCH=403
S7  PATCH fake UUID → 404 {"message":"Không tìm thấy khu vực trong dự án"}
S8  default total=2 [Khu E2E3 Alpha Đổi Tên,Khu E2E3 Beta]
    activeOnly=true total=1 [Khu E2E3 Beta] (toàn isActive:true); UI toggle đúng
cleanup: E2E3-% rest=0, audit 792→806 (tăng do ADDED/UPDATED hợp lệ; audit giữ nguyên)
```

## 6. Cách tái sinh

```bash
# 1. Rebuild stack từ working tree + apply migration 0005
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker exec buildflow-api-1 npm run db:migrate
# 2. Chạy driver (tự cleanup E2E3-% đầu/cuối run, audit giữ nguyên)
node docs/evidence/prj-srs-003/e2e-driver-prj-003.cjs
# 3. Seed/cleanup thủ công (nếu cần): xem seed-003.sql
```

## 7. Rủi ro / ghi chú

- ~~Case-sensitivity duplicate race (ghi trong api-slice) không covered ở E2E — cần 2 request đồng thời khác case; 409 path đã có unit test.~~ **ĐÃ ĐÓNG bởi 0006 (polish P2-2):** expression unique index `(project_id, lower(name)) WHERE is_active` ép case-insensitive ở mức DB — đã chứng minh trực tiếp bằng psql (`INSERT 'CaseProof Alpha'` ok → `INSERT 'caseproof alpha'` lỗi `23505 ux_project_areas_active_name_ci`, rollback sạch `CIPROOF-% rest=0`). Run 3 re-verify 8/8 PASS sau polish (baseline audit `810`, final `824`, `E2E3-% rest=0`); `e2e-vars.json` đã cập nhật theo run 3.
- `AREA_CODE_DUPLICATE` (409 per-field code) không covered ở E2E — UI map field đã có component test (`ProjectAreas.spec.tsx` 409-per-field); E2E S2 cover `AREA_DUPLICATE` name.
- Kích hoạt lại (`isActive:true`, nút `Kích hoạt lại`) không bấm ở E2E — cùng đường PATCH đã verify qua S3/S4/S5; component test cover render.
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- `ux_audit_correlation_action` UNIQUE từng phần → driver sinh UUID correlation mới mỗi request.
```

End of file - total 130 lines
