# PRJ-SRS-001 — E2E Evidence: Tạo và cập nhật dự án (issue #32)

> **Loại bằng chứng:** Browser E2E thật (UI → API → PostgreSQL → UI) + HTTP-level checks bằng token thật, screenshot trong repo.
> **Ngày chạy:** 2026-09-07 UTC (`e2e-driver-prj-001.cjs`, 3 runs: run 1 = 2/11 do 4 lỗi driver + 2 cascade + 3 hành vi scope cần mã hóa (§4a F1–F4);
> run 2 = 10/11 do 1 lỗi selector driver (§4a F5); run 3 sau fix selector = **11/11 PASS**).
> **Trạng thái tổng:** **11/11 PASS** — không phát hiện bug sản phẩm #32; 3 hành vi ngoài scope #32 được ghi nhận (§4a F2–F4, không fix).
> **Phạm vi:** file mới dưới `docs/evidence/prj-srs-001/` — **không commit**, không đụng GitHub.

---

## 1. Môi trường

| Hạng mục | Giá trị |
| --- | --- |
| Repo | `/home/trung/Documents/2026/project/buildflow` |
| Commit HEAD | `4edd786` — `chore(mobile): native device smoke proof + follow-up fixes (#31 known issues)` (+ working tree chưa commit của API/Web slice #32) |
| API base | `http://localhost:3000` (container `buildflow-api-1`, healthy) |
| Web base | `http://localhost:3001` (container `buildflow-web-1`, healthy, rebuild từ working tree) |
| PostgreSQL | `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` |
| Browser | Google Chrome headless qua playwright-core (launch `/usr/bin/google-chrome --no-sandbox`) |
| DB migrations | không migration mới trong slice này (dùng bảng `projects` + `audit_logs` sẵn có) |

> ⚠️ **Stack đã rebuild từ working tree cho E2E này** (image cũ chưa có route prj — working tree chứa module `src/api/src/modules/prj/` + web routes `/projects/new`, `/projects/[id]/edit` chưa commit).
> Rebuild: `up -d --build api web` → probe `POST /api/v1/projects` (anon) **401 đúng contract**, web `/projects` **200**.
> **Port-restore note:** trước rebuild đã kiểm tra `docker compose ps` + `docker ps` — stack đang chạy đúng **canonical ports** (`3000/3001/19006/5432/6379` trên `127.0.0.1`), KHÔNG có stack alternate-port nào (không thấy `3100/3101/31906/5433/6380`). Vì vậy không cần `down/up` khôi phục — rebuild trực tiếp từ `infra/docker/compose.yaml`, compose giữ nguyên port mapping sau rebuild (đã verify lại bằng `compose ps`).

## 2. Tài khoản

| Email | Vai trò | Password E2E |
| --- | --- | --- |
| `admin@example.com` | ADMIN | `E2EAdmin@2025` (giữ từ ORG-SRS-001/002) |
| `pm@example.com` | PROJECT_MANAGER | `E2EPm@2025` (giữ từ ORG-SRS-003) |
| `worker1@example.com` | WORKER | `E2EWorker@2025` (dùng cho 403 + scope read) |

Seed E2E1 (driver tạo qua UI/API, cleanup cuối run): `E2E1-A` (ADMIN tạo, manager worker1),
`E2E1-PM` (PM tạo, manager worker2 → sửa thành worker1 ở S5), `E2E1-D`/`E2E1-D2` (S9 double-submit),
`E2E1-C` (S11 correlation), 21× `E2E1-PG-NN` (S10 pagination, tạo qua API).
Không reset password — cả 3 login gốc đều còn hiệu lực.
> _Note: Throwaway E2E-only demo credentials (seed/reset per evidence docs). Never production._

## 3. Seed / cleanup

- **Cleanup (driver chạy đầu + cuối mỗi run, audit giữ nguyên — append-only):** file `seed-001.sql`
  (xóa `project_members`/`attachments`/`project_areas`/`work_orders` tham chiếu → `projects` có `code LIKE 'E2E1-%'`).
  Đã verify sau run quyết định: `E2E1-% rest=0`; 4 projects có sẵn (`PRA/PRB/PRC/E2E4-PRJ`) không bị đụng.
- **Manager pool:** worker profiles ACTIVE qua `GET /api/v1/workers` — `worker1` (`33333333-…`, Nguyễn Văn Thợ)
  + `worker2` (`44444444-…`, Lê Văn Thợ). S7 toggle `worker2` INACTIVE qua SQL rồi restore ACTIVE ngay trong scenario.
- **Lưu ý DDL (ghi nhận, không phải bug):** bảng `projects` KHÔNG có cột `updated_by` (P7 cấm migration trong slice) —
  `updatedBy` là response-level (= actor PATCH, = createdBy khi CREATE). S5 verify `updatedBy` qua response PATCH
  + `actor_user_id` của audit `PRJ_PROJECT_UPDATED` thay vì cột DB.

## 4. Kịch bản & kết quả (run 3 — run quyết định, 11/11 PASS)

**Ký hiệu:** 🟢 PASS · 🔴 FAIL · 📸 ảnh trong `docs/evidence/prj-srs-001/shots/`

| # | Bước (UI → HTTP → DB verify) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| S1 | ADMIN tạo `E2E1-A` qua `/projects/new` (đủ fields, manager worker1) → detail hiện code/tên/`Nháp`/Nguyễn Văn Thợ; psql đúng code/name/address/manager_id/created_by=`11111111-…`/DRAFT/dates; audit `PRJ_PROJECT_CREATED` actor admin | 🟢 PASS | `S1-created/detail.png` + HTTP/DB §5 |
| S2 | PM tạo `E2E1-PM` qua UI (audit actor pm); worker ở `/projects/new`: pool manager 403 → select còn 1 option → client chặn (`Quản lý…không được để trống`, 0 POST); worker API POST 403 `Không có quyền truy cập`; anon POST 401 | 🟢 PASS | `S2-pm-created/worker-blocked.png` + §5 |
| S3 | Tạo `e2e1-a` (khác case) → 409 `PROJECT_CODE_DUPLICATE` tại field code, form giữ code/name/address, `count(lower(code))=1` | 🟢 PASS | `S3-duplicate.png` + §5 |
| S4 | Submit rỗng → 4 field errors client; end<start → lỗi `plannedEndDate` client + server 400; POST thiếu name → 400 (array-shape, xem §4a F3); `count(E2E1-V)=0` | 🟢 PASS | `S4-required/daterange.png` + §5 |
| S5 | PM PATCH `E2E1-PM` (name/address/manager→worker1) → 200 `updatedBy`=pm; ADMIN detail thấy tên mới; psql đúng; audit `PRJ_PROJECT_UPDATED` actor pm + before/after `name`; PATCH `code` → 400 fieldErrors; PM mở UI edit → 403 iam scope (§4a F4) | 🟢 PASS | `S5-updated/pm-edit-403.png` + §5 |
| S6 | PATCH `status: ACTIVE` → 400 fieldErrors `status`; psql status vẫn `DRAFT` | 🟢 PASS | HTTP/DB §5 |
| S7 | Toggle worker2 INACTIVE (SQL) → create + PATCH với manager đó → 400 `managerId`; restore ACTIVE OK; `count(E2E1-IN)=0` | 🟢 PASS | HTTP/DB §5 |
| S8 | Worker PATCH → 403, name không đổi; GET list=200 rows=0 (không thấy `E2E1-A`); GET detail=403; UI worker `/projects` = empty-scope `Bạn chưa là thành viên dự án nào` | 🟢 PASS | `S8-worker-list.png` + §5 |
| S9 | Nút submit disable + `aria-busy` khi request bay; concurrent double POST → `201+409 PROJECT_CODE_DUPLICATE`, counts D=1 D2=1 | 🟢 PASS | `S9-created.png` + §5 |
| S10 | Seed 21 `E2E1-PG-NN`: search → `Tổng 21` + `Trang 1/2↔2/2`; filter ACTIVE→rỗng, DRAFT→21; row link `/projects/:id` đúng; worker scoped (empty + CTA tạo ẩn) | 🟢 PASS | `S10-search-page1/filter/worker-scoped.png` |
| S11 | POST/PATCH kèm `X-Correlation-Id` → audit `correlation_id` khớp cả CREATED + UPDATED; response KHÔNG echo header (`x-correlation-id=null` — ghi nhận); corr xấu → 400 strict, không row | 🟢 PASS | HTTP/DB §5 |

**Tổng: 11 PASS / 0 FAIL / 11 mục.**

### 4a. Fixes & findings — run 1 (2/11) → mã hóa hiểu biết scope → run 2 (10/11) → fix selector → run 3 (11/11)

**Không có fix sản phẩm nào.** Mọi FAIL run 1 đều là lỗi driver hoặc hành vi ngoài scope #32 (đã verify bằng probe độc lập):

- **F1 — race driver (đã fix trong driver):** sau POST redirect `/projects`, rows load async → assert body-text ngay lập tức thấy thiếu `E2E1-A`. Fix: đợi `Tạo dự án thành công` trước redirect + đợi CODE text sau redirect (S1/S2/S9). Không phải bug sản phẩm.
- **F2 — worker fail-closed ở tầng selector (ghi nhận, KHÔNG fix — đúng thiết kế):** `GET /api/v1/workers` require ADMIN/PM (ORG-SRS-005) nên worker bị 403 ở pool manager → select chỉ còn placeholder → client chặn submit, 0 POST ra server. Giả định task ("worker submit → 403 UI") không xảy ra được theo nghĩa đen; fail-closed giữ nguyên ở 2 tầng (selector + API POST 403). File:line tham chiếu: `src/web/src/features/projects/components/ProjectForm.tsx:62-79` (catch → `setManagers([])`), API guard `src/api/src/modules/org/api/rest/controller/workers.controller.ts` (requireRoles ADMIN/PM).
- **F3 — 400 array-shape khi thiếu property (ghi nhận, KHÔNG fix — đúng contract đã unit-test):** POST thiếu `name` → Nest `ValidationPipe` trả `{message: [...3 chuỗi...]}` thay vì `{fieldErrors}` (use-case chỉ thấy field đã present). Web client đã classify array → field errors (`projects.ts:163-173`, có unit test). Driver chấp nhận cả 2 shape. File:line: `src/api/src/modules/prj/api/rest/presentation/dto/project.dto.ts:54-56` (`UpdateProjectDto.name` optional → use case shape) vs DTO create required.
- **F4 — PM tạo xong không đọc được chính dự án đó (ghi nhận, KHÔNG fix — iam-owned, defer #37):** iam reads scope member/manager-only; creator không auto-member → PM list `[]` + detail 403 `Không có quyền truy cập dự án này` (verify bằng curl độc lập). Vì vậy S5 dùng PM PATCH qua API (write role-only, đúng scope #32 — 200 + audit) và ghi nhận UI edit/detail 403 của PM. File:line: `src/api/src/modules/iam/application/use-case/get-project.use-case.ts:36-43` (`scope.assertAccess` ném 403), `src/api/src/modules/iam/application/use-case/list-projects.use-case.ts` (scope filter). Scope-write chi tiết thuộc #37 (PRJ-SRS-006).
- **F5 — lỗi selector driver (đã fix trong driver):** S10 run 2 dùng `a[href^="/projects/"]` dính CTA `Tạo dự án` (`/projects/new`). Fix: scope `.bf-table a[href^="/projects/"]` → run 3 row link đúng `/projects/0352f244-…`. Không phải bug sản phẩm.

## 5. HTTP + DB outputs thật (run 3)

```
baseline audit=555
S1  UI 'Tạo dự án thành công' → /projects có E2E1-A; detail đủ code/tên/Nháp/Nguyễn Văn Thợ
    psql: E2E1-A|Công trình E2E Một|Số 1, đường E2E, Quận 1|33333333-…|11111111-…|DRAFT|2026-10-01|2027-03-31
    audit: 11111111-…|PRJ_PROJECT_CREATED|PROJECT (entity 0352f244-…)
S2  PM tạo E2E1-PM (audit actor 22222222-…); worker GET /workers=403 → 1 option → 'Quản lý dự án không được để trống', 0 POST
    worker API POST=403 {"message":"Không có quyền truy cập"}; anon POST=401 {"message":"Phiên hết hạn, vui lòng đăng nhập lại"}
S3  'e2e1-a' → 409 {"code":"PROJECT_CODE_DUPLICATE"} tại field code; form giữ e2e1-a/Tên khác/Địa chỉ khác; count lower=1
S4  client: 4 required + 'Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi'; server thiếu name=400 array-shape, end<start=400 fieldErrors.plannedEndDate; count E2E1-V=0
S5  PM PATCH → 200 name/address/managerId=w1 updatedBy=22222222-…; PM UI edit → 'Không có quyền'; ADMIN detail tên mới
    psql: Công trình E2E Hai Sửa|Số 2 mới, đường E2E, Quận 2|33333333-…|DRAFT; audit 22222222-…|PRJ_PROJECT_UPDATED + before/after name=true
    PATCH code → 400 fieldErrors.code
S6  PATCH status → 400 fieldErrors.status; psql status=DRAFT
S7  worker2 INACTIVE → create + PATCH 400 fieldErrors.managerId; restore ACTIVE; count E2E1-IN=0
S8  worker PATCH=403; name='Công trình E2E Một' nguyên; GET list=200 rows=0 (thấy E2E1-A=false); GET detail=403; UI empty-scope
S9  button {disabled:true, busy:'true', text:'Đang xử lý…'}; concurrent POST 201+409 PROJECT_CODE_DUPLICATE; counts D=1 D2=1
S10 search 'E2E1-PG' → Tổng 21 + Trang 1/2↔2/2; ACTIVE→'Không có dự án...' DRAFT→21; row link /projects/0352f244-…; worker empty + CTA ẩn
S11 audit CREATED corr=7bb24438-… UPDATED corr=02bac94d-…; echo header POST=null PATCH=null; corr xấu 400, count E2E1-CB=0
cleanup: E2E1-% rest=0, audit 555→589 (tăng do tạo/sửa entity là hợp lệ; audit giữ nguyên; users worker1/worker2/pm/admin đều ACTIVE)
```

## 6. Cách tái sinh

```bash
# 1. Rebuild stack từ working tree (gồm fix §4a nếu có)
DOCKER_CONFIG=/tmp/bfhome/.docker DOCKER_HOST=unix:///home/trung/.docker/desktop/docker.sock \
  docker compose -f infra/docker/compose.yaml up -d --build api web
# 2. Chạy driver (tự cleanup E2E1-% đầu/cuối run, audit giữ nguyên)
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
- P9 (post-E2E fix, issue #32): CREATE giờ auto-add manager làm ACTIVE member `MANAGER` trong cùng tx → manager-visible qua iam scope (note §4a F4 cập nhật: creator-PM visibility vẫn defer #37 khi creator ≠ manager).
