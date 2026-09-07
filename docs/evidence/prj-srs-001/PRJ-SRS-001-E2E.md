# PRJ-SRS-001 — E2E Evidence: Tạo và cập nhật dự án (issue #32)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-08 UTC (`e2e-driver-prj-001.cjs`, run chuẩn hóa realistic = **11/11 PASS**).
> Các run cũ (2026-09-07, mã `E2E1-*`) xem §4a — identifiers cũ chỉ còn trong lịch sử/audit.
> **Trạng thái tổng:** **11/11 PASS** — không phát hiện bug sản phẩm #32; 3 hành vi ngoài scope #32 được ghi nhận (§4a F2–F4, không fix).
> **Phạm vi:** file dưới `docs/evidence/prj-srs-001/` — **không commit**, không đụng GitHub.
>
> **Chuẩn hóa realistic (docs/demo-data.md):** creds `@vinacons.vn`, mã run `VDA1-*`
> (Vinacons Dự Án 1), tên/địa chỉ tiếng Việt thực tế. Manager UUIDs giữ nguyên
> (`11111111-…`=hoang.anh, `33333333-…`=thang.nguyen/Nguyễn Văn Thắng,
> `44444444-…`=hau.le) vì DB canonical đã đổi tên. `audit_logs` append-only —
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
| DB migrations | không migration mới trong slice này (dùng bảng `projects` + `audit_logs` sẵn có) |

> Stack chạy đúng **canonical ports** (`3000/3001/19006/5432/6379` trên `127.0.0.1`); không rebuild cho run này (không đổi product code).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `hoang.anh@vinacons.vn` | ADMIN | `E2EAdmin@2025` |
| `quoc.tran@vinacons.vn` | PROJECT_MANAGER | `E2EPm@2025` |
| `thang.nguyen@vinacons.vn` | WORKER | `E2EWorker@2025` (dùng cho 403 + scope read) |

Seed VDA1 (driver tạo qua UI/API, cleanup cuối run): `VDA1-A` (ADMIN tạo, manager worker1),
`VDA1-PM` (PM tạo, manager hau.le → sửa thành thang.nguyen ở S5), `VDA1-D`/`VDA1-D2` (S9 double-submit),
`VDA1-C` (S11 correlation), 21× `VDA1-PG-NN` (S10 pagination, tạo qua API, tên pool `PG_NAMES`).
Không reset password — cả 3 login gốc đều còn hiệu lực.
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Cleanup (driver chạy đầu + cuối mỗi run, audit giữ nguyên — append-only):** id-based theo
  `projectIds` trong `e2e-vars.json` cũ + file `seed-001.sql` (xóa `project_members`/`attachments`/
  `project_areas`/`work_orders` tham chiếu → `projects` có `code LIKE 'VDA1-%'`, kèm fallback
  cửa sổ 12h; re-runnable). Đã verify sau run quyết định: `VDA1-% rest=0`; 4 projects
  canonical (`PRA/PRB/PRC/PRD`) không bị đụng.
- **Manager pool:** worker profiles ACTIVE qua `GET /api/v1/workers` — thang.nguyen (`33333333-…`,
  Nguyễn Văn Thắng) + hau.le (`44444444-…`, Lê Văn Hậu). S7 toggle hau.le INACTIVE qua SQL
  rồi restore ACTIVE ngay trong scenario.
- **Lưu ý DDL (ghi nhận, không phải bug):** bảng `projects` KHÔNG có cột `updated_by` (P7 cấm migration trong slice) —
  `updatedBy` là response-level (= actor PATCH, = createdBy khi CREATE). S5 verify `updatedBy` qua response PATCH
  + `actor_user_id` của audit `PRJ_PROJECT_UPDATED` thay vì cột DB.

## 4. Kịch bản & kết quả (run chuẩn hóa realistic, 11/11 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-001/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN tạo `VDA1-A` (`Trung tâm hội nghị Sông Hồng`) qua `/projects/new` (manager thang.nguyen) → detail hiện code/tên/`Nháp`/Nguyễn Văn Thắng; psql đúng code/name/address/manager_id/created_by=`11111111-…`/DRAFT/dates; audit `PRJ_PROJECT_CREATED` actor admin | 🟢 PASS | `S1-created/detail.png` + HTTP/DB §5 |
| S2 | PM tạo `VDA1-PM` (`Khu căn hộ Flora Anh Đào`) qua UI (audit actor pm); worker ở `/projects/new`: pool manager 403 → select còn 1 option → client chặn (`Quản lý…không được để trống`, 0 POST); worker API POST 403 `Không có quyền truy cập`; anon POST 401 | 🟢 PASS | `S2-pm-created/worker-blocked.png` + §5 |
| S3 | Tạo `vda1-a` (khác case) → 409 `PROJECT_CODE_DUPLICATE` tại field code, form giữ code/name/address, `count(lower(code))=1` | 🟢 PASS | `S3-duplicate.png` + §5 |
| S4 | Submit rỗng → 4 field errors client; end<start → lỗi `plannedEndDate` client + server 400; POST thiếu name → 400 (array-shape, xem §4a F3); `count(VDA1-V)=0` | 🟢 PASS | `S4-required/daterange.png` + §5 |
| S5 | PM PATCH `VDA1-PM` (name `…(mở rộng)`/address/manager→thang.nguyen) → 200 `updatedBy`=pm; ADMIN detail thấy tên mới; psql đúng; audit `PRJ_PROJECT_UPDATED` actor pm + before/after `name`; PATCH `code` → 400 fieldErrors; PM mở UI edit → 403 iam scope (§4a F4) | 🟢 PASS | `S5-updated/pm-edit-403.png` + §5 |
| S6 | PATCH `status: ACTIVE` → 400 fieldErrors `status`; psql status vẫn `DRAFT` | 🟢 PASS | HTTP/DB §5 |
| S7 | Toggle hau.le INACTIVE (SQL) → create + PATCH với manager đó → 400 `managerId`; restore ACTIVE OK; `count(VDA1-IN)=0` | 🟢 PASS | HTTP/DB §5 |
| S8 | Worker PATCH → 403, name không đổi; GET list=200 rows=3 (thấy `VDA1-A` — manager auto-member P9); GET detail=200; UI worker `/projects` hiện rows (không còn empty-scope vì manager-member) | 🟢 PASS | `S8-worker-list.png` + §5 |
| S9 | Nút submit disable + `aria-busy` khi request bay; concurrent double POST → `201+409 PROJECT_CODE_DUPLICATE`, counts D=1 D2=1 | 🟢 PASS | `S9-created.png` + §5 |
| S10 | Seed 21 `VDA1-PG-NN` (tên realistic pool): search `VDA1-PG` → `Tổng 21` + `Trang 1/2↔2/2`; filter ACTIVE→rỗng, DRAFT→21; row link `/projects/:id` đúng; worker scoped (CTA tạo ẩn) | 🟢 PASS | `S10-search-page1/filter/worker-scoped.png` |
| S11 | POST/PATCH kèm `X-Correlation-Id` → audit `correlation_id` khớp cả CREATED + UPDATED; response KHÔNG echo header (`x-correlation-id=null` — ghi nhận); corr xấu → 400 strict, không row | 🟢 PASS | HTTP/DB §5 |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. Fixes & findings lịch sử (runs 2026-09-07, mã `E2E1-*` — tên cũ trước chuẩn hóa)

**Không có fix sản phẩm nào.** Mọi FAIL run 1 đều là lỗi driver hoặc hành vi ngoài scope #32 (đã verify bằng probe độc lập):

- **F1 — race driver (đã fix trong driver):** sau POST redirect `/projects`, rows load async → assert body-text ngay lập tức thấy thiếu mã. Fix: đợi `Tạo dự án thành công` trước redirect + đợi CODE text sau redirect (S1/S2/S9). Không phải bug sản phẩm.
- **F2 — worker fail-closed ở tầng selector (ghi nhận, KHÔNG fix — đúng thiết kế):** `GET /api/v1/workers` require ADMIN/PM (ORG-SRS-005) nên worker bị 403 ở pool manager → select chỉ còn placeholder → client chặn submit, 0 POST ra server. Giả định task ("worker submit → 403 UI") không xảy ra được theo nghĩa đen; fail-closed giữ nguyên ở 2 tầng (selector + API POST 403). File:line tham chiếu: `src/web/src/features/projects/components/ProjectForm.tsx:62-79` (catch → `setManagers([])`), API guard `src/api/src/modules/org/api/rest/controller/workers.controller.ts` (requireRoles ADMIN/PM).
- **F3 — 400 array-shape khi thiếu property (ghi nhận, KHÔNG fix — đúng contract đã unit-test):** POST thiếu `name` → Nest `ValidationPipe` trả `{message: [...3 chuỗi...]}` thay vì `{fieldErrors}` (use-case chỉ thấy field đã present). Web client đã classify array → field errors (`projects.ts:163-173`, có unit test). Driver chấp nhận cả 2 shape. File:line: `src/api/src/modules/prj/api/rest/presentation/dto/project.dto.ts:54-56` (`UpdateProjectDto.name` optional → use case shape) vs DTO create required.
- **F4 — PM tạo xong không đọc được chính dự án đó (ghi nhận, KHÔNG fix — iam-owned, defer #37):** iam reads scope member/manager-only; creator không auto-member → PM list `[]` + detail 403 `Không có quyền truy cập dự án này` (verify bằng curl độc lập). Vì vậy S5 dùng PM PATCH qua API (write role-only, đúng scope #32 — 200 + audit) và ghi nhận UI edit/detail 403 của PM. File:line: `src/api/src/modules/iam/application/use-case/get-project.use-case.ts:36-43` (`scope.assertAccess` ném 403), `src/api/src/modules/iam/application/use-case/list-projects.use-case.ts` (scope filter). Scope-write chi tiết thuộc #37 (PRJ-SRS-006).
- **F5 — lỗi selector driver (đã fix trong driver):** S10 run 2 dùng `a[href^="/projects/"]` dính CTA `Tạo dự án` (`/projects/new`). Fix: scope `.bf-table a[href^="/projects/"]` → run 3 row link đúng. Không phải bug sản phẩm.
- **S8 note (run chuẩn hóa):** worker GET list giờ thấy 3 rows + detail 200 (thay vì `rows=0`/403 như run cũ) — do P9 CREATE auto-add manager làm ACTIVE member `MANAGER` trong cùng tx → manager-visible qua iam scope. Driver assert đúng scope hiện tại ([200,403,404]) và ghi nhận thực tế.

## 5. HTTP + DB outputs thật (run chuẩn hóa)

```
baseline audit=1011
S1  UI 'Tạo dự án thành công' → /projects có VDA1-A; detail đủ code/tên/Nháp/Nguyễn Văn Thắng
    psql: VDA1-A|Trung tâm hội nghị Sông Hồng|Số 1, đường Sông Hồng, Hà Nội|33333333-…|11111111-…|DRAFT|2026-10-01|2027-03-31
    audit: 11111111-…|PRJ_PROJECT_CREATED|PROJECT (entity 39b14642-…)
S2  PM tạo VDA1-PM (audit actor 22222222-…); worker GET /workers=403 → 1 option → 'Quản lý dự án không được để trống', 0 POST
    worker API POST=403 {"message":"Không có quyền truy cập"}; anon POST=401 {"message":"Phiên hết hạn, vui lòng đăng nhập lại"}
S3  'vda1-a' → 409 {"code":"PROJECT_CODE_DUPLICATE"} tại field code; form giữ vda1-a/Tên khác/Địa chỉ khác; count lower=1
S4  client: 4 required + 'Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi'; server thiếu name=400 array-shape, end<start=400 fieldErrors.plannedEndDate; count VDA1-V=0
S5  PM PATCH → 200 name/address/managerId=w1 updatedBy=22222222-…; PM UI edit → 'Không có quyền'; ADMIN detail tên mới
    psql: Khu căn hộ Flora Anh Đào (mở rộng)|Số 2 mới, đường Anh Đào, Thủ Đức|33333333-…|DRAFT; audit 22222222-…|PRJ_PROJECT_UPDATED + before/after name=true
    PATCH code → 400 fieldErrors.code
S6  PATCH status → 400 fieldErrors.status; psql status=DRAFT
S7  hau.le INACTIVE → create + PATCH 400 fieldErrors.managerId; restore ACTIVE; count VDA1-IN=0
S8  worker PATCH=403; name='Trung tâm hội nghị Sông Hồng' nguyên; GET list=200 rows=3 (thấy VDA1-A=true); GET detail=200; UI có rows
S9  button {disabled:true, busy:'true', text:'Đang xử lý…'}; concurrent POST 201+409 PROJECT_CODE_DUPLICATE; counts D=1 D2=1
S10 search 'VDA1-PG' → Tổng 21 + Trang 1/2↔2/2; ACTIVE→'Không có dự án...' DRAFT→21; row link /projects/39b14642-…; worker CTA tạo ẩn
S11 audit CREATED corr=2e600dd7-… UPDATED corr=30dfecb0-…; echo header POST=null PATCH=null; corr xấu 400, count VDA1-CB=0
cleanup: VDA1-% rest=0, audit 1011→1045 (tăng do tạo/sửa entity là hợp lệ; audit giữ nguyên; users đều ACTIVE)
```

## 6. Cách tái sinh

```bash
# 1. Stack đã chạy canonical ports — nếu cần rebuild từ working tree:
DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự cleanup id-based + VDA1-% đầu/cuối run, audit giữ nguyên)
node docs/evidence/prj-srs-001/e2e-driver-prj-001.cjs
# 3. Seed/cleanup thủ công (nếu cần): xem seed-001.sql
```

## 7. Rủi ro / ghi chú

- `GET /projects` chỉ hỗ trợ `limit`/`offset`, trả mảng summary (không search/status/total) → UI fetch `{limit:100}`
  rồi lọc + phân trang phía client; S10 seed 21 projects để chứng minh phân trang 2 trang thật.
- `GET :id` trả summary 7 trường → detail hiện `—` cho address/timezone/dates (ghi footnote trong UI);
  full profile verify qua POST/PATCH response + psql.
- Pre-check trùng mã case-insensitive chặt hơn DB btree (race `ABC`/`abc` cùng lúc vẫn lọt — như crews).
- Playwright import kiểu `docs/evidence/org-srs-008` (absolute path `playwright-core` trong `@playwright/mcp`),
  Chrome `/usr/bin/google-chrome --no-sandbox`.
- P9 (post-E2E fix, issue #32): CREATE giờ auto-add manager làm ACTIVE member `MANAGER` trong cùng tx → manager-visible qua iam scope (S8 run chuẩn hóa đã phản ánh: worker-manager thấy rows).
