# PRJ-SRS-003 — E2E Evidence: Khu vực / hạng mục dự án (issue #34)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-003.cjs`, run chuẩn hóa realistic = **8/8 PASS**).
> Các run cũ (2026-09-07, mã `E2E3-*`, khu vực `Khu E2E3 Alpha/Beta`) xem §4a — identifiers cũ chỉ còn trong lịch sử/audit.
> **Trạng thái tổng:** **8/8 PASS** — không phát hiện bug sản phẩm #34.
> **Phạm vi:** file dưới `docs/evidence/prj-srs-003/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md):** creds `@vinacons.vn`, mã run `VDA3-*`
> (Vinacons Dự Án 3), khu vực realistic (`Khu hành chính - Khối A`, `Khu kho vận - Khối B`),
> lý do tiếng Việt (`…(đợt T9/2026)`). Assert semantics giữ nguyên (rename before/after,
> duplicate 409, deactivate idempotent). Audit area có `entity_type=PROJECT`,
> **`entity_id` = project id** (không phải area id). `audit_logs` append-only —
> các dòng audit cũ giữ identifier cũ là có chủ ý.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | 0005 + 0006 polish (case-insensitive) đã apply từ trước (`ux_project_areas_active_name_ci (project_id, lower(name)) WHERE is_active`) |

> Stack chạy đúng **canonical ports** (`3000/3001/19006/5432/6379` trên `127.0.0.1`); không rebuild cho run này (không đổi product code).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` (member COORDINATOR của VDA3-B cho S6) |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` (manager của VDA3-A/B → đọc detail, write 403 cho S6) |

Seed VDA3 (driver tạo, cleanup cuối run): `VDA3-A` (`Trung tâm hội nghị Sông Hồng`, S1–S8:
create/dup/rename/deactivate/idempotent/perms/404/activeOnly), `VDA3-B` (`Khu căn hộ Flora Anh Đào`,
S6 cross-PM). Manager cả 2 = thang.nguyen.
Không reset password — login gốc còn hiệu lực.
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production. Creds trong driver env-overridable (`E2E_ADMIN_PASS`/`E2E_PM_PASS`/`E2E_WORKER_PASS`, default giữ giá trị bảng trên để driver chạy được ngay)._

## 3. Seed / cleanup

- **Cleanup (driver chạy đầu + cuối mỗi run, audit giữ nguyên — append-only, guard cấm DELETE/UPDATE):** id-based theo
  `projectIds` trong `e2e-vars.json` cũ + file `seed-003.sql` (xóa `work_orders` → `attachments` →
  `project_areas` → `project_members` → `projects` có `code LIKE 'VDA3-%'`, kèm fallback cửa sổ 12h;
  re-runnable). Đã verify sau run quyết định: `VDA3-% rest=0`.
- **Lưu ý DDL (§4a F1):** `audit_logs` có trigger append-only + partial unique `ux_audit_correlation_action` → mỗi request trong driver kèm correlation UUID mới; audit area có `entity_type=PROJECT`, **`entity_id` = project id** (không phải area id) — driver query theo project.

## 4. Kịch bản & kết quả (run chuẩn hóa realistic, 8/8 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-003/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN tạo `VDA3-A` (manager thang.nguyen) + tạo area `Khu hành chính - Khối A` qua UI (`Đã thêm khu vực…`) → list hiện tên; `GET areas` có row `isActive:true`; psql `Khu hành chính - Khối A\|true`; audit `PRJ_PROJECT_AREA_ADDED` actor admin + `after_data.name` đúng | 🟢 PASS | `S1-created.png` + HTTP/DB §5 |
| S2 | Tạo lại `Khu hành chính - Khối A` (UI + API) → UI field error `#area-add-name-error` (`…đã tồn tại trong dự án`), API **409** `AREA_DUPLICATE`; active rows = 1 | 🟢 PASS | `S2-duplicate.png` + §5 |
| S3 | Đổi tên qua UI (`Đổi tên` → `Lưu` → `Đã đổi tên khu vực…`) → list `Khu hành chính - Khối A (mở rộng)`; psql name mới; audit `PRJ_PROJECT_AREA_UPDATED` `before/after` đủ, count `+1` | 🟢 PASS | `S3-renamed.png` + §5 |
| S4 | Ngừng sử dụng qua UI (confirm inline + reason `Gộp khu hành chính để tối ưu mặt bằng (đợt T9/2026)`, counter `/500`) → `Đã ngừng sử dụng…` + badge `Ngừng sử dụng`; psql `is_active=false` (**row còn — no hard delete**); audit `UPDATED` reason đủ | 🟢 PASS | `S4-deactivated.png` + §5 |
| S5 | `PATCH isActive:false` lần 2 → 200 `alreadyInactive:true`; audit `UPDATED 2→2` (không tăng) | 🟢 PASS | HTTP/DB §5 |
| S6 | Worker1 (role WORKER, manager A): UI read-only note + **0 nút** (`Thêm khu vực`/`Đổi tên`/`Ngừng sử dụng`); API POST + PATCH → **403**; PM chỉ member B → POST/PATCH area vào A → **403** (ID tampering) | 🟢 PASS | `S6-worker-readonly.png` + §5 |
| S7 | `PATCH` areaId UUID lạ → **404** `Không tìm thấy khu vực trong dự án` | 🟢 PASS | HTTP §5 |
| S8 | Tạo `Khu kho vận - Khối B` → `GET` default `total=2`; `GET ?activeOnly=true` `total=1 [Khối B]` toàn `isActive:true`; UI toggle `Chỉ hiện khu vực đang sử dụng` → chỉ Khối B | 🟢 PASS | `S8-activeonly.png` + §5 |

**Tổng: 8 PASS / 0 FAIL / 8 mục.**

### 4a. Fixes & findings lịch sử (runs 2026-09-07, mã `E2E3-*` — tên cũ trước chuẩn hóa)

**Không có fix sản phẩm nào.** Tất cả FAIL đều thuộc driver/assert:

- **F1 — audit `entity_id` là project id, không phải area id (đã fix):** audit area dùng `entity_type=PROJECT` + `entity_id=<projectId>` (đúng A4/tx-embedded design của api-slice) — driver query `entity_id=<areaId>` nên rỗng. Fix: query theo `entity_id=idA` + lọc `after_data->>'name'`. Ảnh hưởng S1, S3, S4 run cũ; S5 fail cascade (biến `auditUpdatedAfterS4=null`). Không phải bug sản phẩm.
- **F2 — SQL `->>` vs `||` precedence (đã fix, S3):** `before_data->>'name'||'| '` bị parse thành `->> ('name'||'| ')` → `operator does not exist: text ->> unknown`. Fix: ngoặc `(before_data->>'name')||…`. Không phải bug sản phẩm.
- **Ghi nhận (đúng thiết kế, không fix):** row deactivate giữ `before.name=after.name` (chỉ lật `isActive`), reason lưu ở audit row; worker1 là manager nhưng role WORKER → write 403 (role-guard đúng A4: ADMIN+PM mới write); `activeOnly` default off, list luôn kèm inactive (badge xám).

## 5. HTTP + DB outputs thật (run chuẩn hóa)

```
baseline audit=1083
S1  UI 'Đã thêm khu vực "Khu hành chính - Khối A"…'
    GET areas: {name:Khu hành chính - Khối A|isActive:true}
    psql: Khu hành chính - Khối A|true (name|is_active)
    audit: 11111111-…|PRJ_PROJECT_AREA_ADDED (actor admin, after_data.name đúng)
S2  UI field #area-add-name-error '…đã tồn tại trong dự án'
    API dup → 409 {"code":"AREA_DUPLICATE"}; psql active rows=1
S3  UI 'Đã đổi tên khu vực thành "Khu hành chính - Khối A (mở rộng)"'
    psql name=Khu hành chính - Khối A (mở rộng)
    audit: before|after đủ; UPDATED +1
S4  UI 'Đã ngừng sử dụng khu vực "…" — lịch sử vẫn được giữ' + badge Ngừng sử dụng
    psql is_active=false (row còn — không hard delete)
    audit UPDATED reason='Gộp khu hành chính để tối ưu mặt bằng (đợt T9/2026)'
S5  API lần 2: 200 alreadyInactive=true; audit UPDATED 2→2 (không tăng)
S6  worker UI note 'Chỉ ADMIN và PROJECT_MANAGER…' + 0 nút write
    worker POST=403 PATCH=403; pm-ngoài-A POST=403 PATCH=403
S7  PATCH fake UUID → 404 {"message":"Không tìm thấy khu vực trong dự án"}
S8  default total=2 [Khối A (mở rộng),Khối B]
    activeOnly=true total=1 [Khu kho vận - Khối B] (toàn isActive:true); UI toggle đúng
cleanup: VDA3-% rest=0, audit 1083→1097 (tăng do ADDED/UPDATED hợp lệ; audit giữ nguyên)
```

## 6. Cách tái sinh

```bash
# 1. Stack đã chạy canonical ports — nếu cần rebuild từ working tree:
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự cleanup id-based + VDA3-% đầu/cuối run, audit giữ nguyên)
node docs/evidence/prj-srs-003/e2e-driver-prj-003.cjs
# 3. Seed/cleanup thủ công (nếu cần): xem seed-003.sql
```

## 7. Rủi ro / ghi chú

- ~~Case-sensitivity duplicate race (ghi trong api-slice) không covered ở E2E — cần 2 request đồng thời khác case; 409 path đã có unit test.~~ **ĐÃ ĐÓNG bởi 0006 (polish P2-2):** expression unique index `(project_id, lower(name)) WHERE is_active` ép case-insensitive ở mức DB.
- `AREA_CODE_DUPLICATE` (409 per-field code) không covered ở E2E — UI map field đã có component test (`ProjectAreas.spec.tsx` 409-per-field); E2E S2 cover `AREA_DUPLICATE` name.
- Kích hoạt lại (`isActive:true`, nút `Kích hoạt lại`) không bấm ở E2E — cùng đường PATCH đã verify qua S3/S4/S5; component test cover render.
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`), Chrome `/usr/bin/google-chrome --no-sandbox`.
- `ux_audit_correlation_action` UNIQUE từng phần → driver sinh UUID correlation mới mỗi request.
```
