# orchestrate run r-mttylm1r-b589z7

- mode: fanout | agent: session-53388f77-905b-46ab-9594-7d3017dea139 | provider: spawn
- concurrency: 6 | durationMs: 1992257 | aborted: false
- startedAt: 2026-09-09T10:32:12.255Z | finishedAt: 2026-09-09T11:05:24.512Z

## Plan JOB-SRS-005 #45 [via planner] [completed] {xkiro/z-ai/glm-5.3-flash}

Cả hai reviewer trả `NEEDS-REVISION` với các phát hiện bổ trợ nhau (reviewer 1 bắt blocker mobile-jest hỏng + mâu thuẫn unknown-query-key; reviewer 2 bắt thiếu area/trade name refs + mâu thuẫn projectId). Tôi đã tự kiểm chứng lại các fact công cụ. Dưới đây là kế hoạch tổng hợp cuối cùng.

---

# KẾ HOẠCH TRIỂN KHAI CUỐI CÙNG — Issue #45 [JOB-SRS-005] Must — Xem Job Board

Repo: `/home/trung/Documents/2026/project/buildflow`, branch `main @ 61ed2be` (HEAD = `feat(job,web): job board open/close with publish gate, idempotent replay, audit`). Vertical slice: backend → contract docs → mobile UI → test → evidence → docker rebuild → đóng issue.

---

## 1. Goal và acceptance criteria

**Goal:** Worker mở Job Board trên Mobile, thấy danh sách Work Order còn trống mà mình được phép truy cập (available: chưa assign, còn cửa sổ, đúng trạng thái, đúng project scope) — API thật + Mobile UI thật (không mock screen) + pagination + pull-to-refresh + test + evidence + docs, đủ DoD trong `gh issue view 45`.

**AC map 1-1 với 8 checkbox nghiệm thu của issue:**

| # | Checkbox issue | Tiêu chí kế hoạch |
|---|---|---|
| AC1 | Worker đúng scope thấy available jobs | Endpoint list trả chỉ WO thuộc project worker là ACTIVE member, state `AVAILABLE` server-derived; chứng minh bằng e2e in-memory + driver real-DB |
| AC2 | Assigned/expired/canceled/out-of-scope bị loại | Predicates SQL server-side (WHERE) loại: active assignment (PENDING_ACCEPTANCE/ACTIVE), window hết hạn, status ≠ OPEN, CANCELLED, ngoài scope |
| AC3 | Refresh sau worker khác claim cập nhật đúng | Pull-to-refresh re-fetch; WO có assignment mới biến khỏi response tiếp theo (driver: seed assignment qua psql — claim write là #47, ghi rõ là mô phỏng) |
| AC4 | Pagination/filter + permission trên Mobile | Offset pagination "Tải thêm" + permission states; **phần filter là #46 — deviation ghi có trong ENDPOINTS §20 + comment issue** |
| AC5 | Quyền: đúng role/scope pass, sai role/project/sửa ID/URL không bypass | e2e matrix: anon 401; không membership → 200 empty; worker P1 không thấy WO P2; endpoint không có param scope nào để sửa URL mở rộng quyền |
| AC6 | Validation + trạng thái sai; lỗi nêu nguyên nhân | `limit`/`offset` sai → 400 `fieldErrors` + message tiếng Việt actionable; UI render nguyên nhân + retry |
| AC7 | Retry/double-submit khi có ghi dữ liệu | **N/A-trung thực:** slice read-only, không ghi — chứng minh "repeated GET không tạo audit/notification" bằng delta-count; non-application ghi trong §20 |
| AC8 | Integration/E2E UI dùng API thật | Driver: login thật → API thật → Postgres thật → Expo UI → screenshots `docs/evidence/job-srs-005/shots/`, ≥2 lần ALL-PASS liên tiếp |

**DoD:** backend + validation + scope xong; Mobile screen thật với đủ states loading/empty/success/error/permission/retry; E2E UI→API→DB→UI với dữ liệu demo + bằng chứng; unit + integration + negative/permission test pass; docs (API.md, ENDPOINTS.md, MOBILE.md) đồng bộ cùng change; issue chỉ đóng khi cả backend lẫn mobile xong.

---

## 2. Current repository facts (đã verify, kèm file:line)

### Backend (`src/api`, NestJS hexagonal)

- **F1** `deriveJobBoardState` thuần domain: `ASSIGNED` nếu `hasActiveAssignment` hoặc status ∈ {ASSIGNED, IN_PROGRESS} → `EXPIRED` nếu board mở && `now > until` → `SCHEDULED` nếu board mở && `now < from` → `AVAILABLE` nếu board mở && status OPEN → `CLOSED` còn lại; `now` injectable. `src/api/src/modules/job/domain/service/work-order-job-board.policy.ts:126-154` (`now` tại :133).
- **F2** Port: `WorkOrderFilter` {projectIds/projectId/status/search/limit/offset} (`work-order-repository.port.ts:47-59`); `search()` trả `{entities, total}` (`:96`); batch tùy chọn `hasActiveAssignmentByWorkOrderIds?(ids): Promise<Set<string>>` — MỘT query, status `PENDING_ACCEPTANCE|ACTIVE` (`:156-162`); batch ref `findWorkTypeRefs`/`findProjectRefs` trả `Map<string, WorkOrderListRef>` (`:102-104`, shape `WorkOrderListRef` `{id, code, name}` tại `:41-45`).
- **F3** PG adapter: `search()` WHERE động + `COUNT` total + page `ORDER BY updated_at DESC LIMIT/OFFSET` (`pg-work-order.repository.ts:151-192`); `WORK_ORDER_COLUMNS` đã gồm `job_board_open, job_board_open_from, job_board_open_until` (`:61`); open-guard dùng `NOT EXISTS assignment` tương đương (`:336-338`).
- **F4** Read-scope precedent: `SearchWorkOrdersUseCase` gọi `ProjectScopeService.resolveAccessibleProjectIds` trước (`search-work-orders.use-case.ts:51-55`); ADMIN → `null` unrestricted (chỉ debug-log); membership rỗng → `{[], 0}` **không 403** (`:57-60`); `projectId` ngoài scope → 403 generic anti-leak (`:61-63`). Scope service: `src/api/src/modules/iam/application/service/project-scope.service.ts:155-172`.
- **F5** Controller: `@UseGuards(JwtAuthGuard)` class-level (`work-orders.controller.ts:107-108`); `workOrderActor(req)` (`:41-47`); `getMeta` (`:49-58`); list GET validate `limit` 1-100 / `offset` ≥0 qua `filterError` → 400 + `fieldErrors` (`:170-186`); controller đọc `@Query()` từng param, **không có cơ chế 400 cho query key lạ** (key lạ bị bỏ qua — quyết định BD4 bên dưới dựa trên đây); read endpoint không audit.
- **F6** Mapper: `toWorkOrderResponse` trả `jobBoard: { open, openFrom, openUntil, hasActiveAssignment, state }` chỉ khi caller truyền `hasActiveAssignment` (`work-order.mapper.ts:45-64`); `toWorkOrderListResponse` KHÔNG enrich jobBoard (`:76-91`). Không có field `areaName`/`tradeName` nào trong job module (grep → 0 hits) — card hiện chỉ có thể render `areaId`/`requiredTradeId` dạng uuid nếu không thêm batch ref.
- **F7** ENDPOINTS §17 dòng :437: contract list hiện tại `200 { data, total, limit, offset }` + `Cache-Control: no-store`; membership rỗng → 200 empty; `projectId` ngoài scope → 403 generic. §19 :483-502, **(h) tại :498**: "Bỏ enrichment `jobBoard` trên list `GET /work-orders` (scope creep, chưa consumer — defer `#45`)". `GET /api/v1/work-orders/:id` cho phép **bất kỳ ACTIVE member nào kể cả WORKER** (`:438`, controller doc `work-orders.controller.ts:91-92`) — điều kiện cần cho preview screen (BD5).
- **F8** Migration 0001: `job_board_open` cột (`0001_dbd_v2_1_baseline.sql:236`), `ix_work_orders_job_board` (~:866), bảng `assignments` + CHECK status + `source` enum `SELF_ACCEPT` (`:287-317`), `ux_assignments_current ON assignments(work_order_id) WHERE status IN ('PENDING_ACCEPTANCE','ACTIVE')` (`:881-883`). **Không cần migration mới.**

### Mobile (`src/mobile` — Expo 51, Expo Router, jest-expo)

- **F9** Route pattern: `app/projects/index.tsx` restore session qua `getSession()` (`src/storage/session.ts:8`, key `buildflow.auth.v1`) → render feature screen từ `src/features/<name>/`; `app/_layout.tsx:1-8` đăng ký `Stack.Screen`.
- **F10** Client: `src/mobile/src/api/client.ts` — `API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'` (`:7`); `LoginError(message, status, code?, fieldErrors?)` (`:24-31`); precedent list + `cache: 'no-store'` + error copy tiếng Việt theo status trong `listProjects`/`toProjectError` (`:280-310`).
- **F11** Screen pattern `src/features/projects/ProjectListScreen.tsx:1-80`: loading (ActivityIndicator + accessibilityLabel), 401 → re-login, error → box + "Thử lại", empty → hint + retry, FlatList; test pattern mock client module (`ProjectListScreen.test.tsx:1-60`).
- **F12** Entry point precedent: `ProfileScreen.tsx:162-168` có nút `router.push('/eligibility')` và `router.push('/projects')`.
- **F13** Chưa có `src/features/job-board`; không có WorkOrderPreviewScreen (`ls src/mobile/src/features` → chỉ auth/eligibility/profile/projects).
- **F14** `docs/architecture/MOBILE.md` §8 "Checklist thêm screen" (`:126-134`); WORK-ROUTING.md:27-32 (mobile không import web/api), :18/:53 (fan-out contract cùng change).

### Toolchain + hạ tầng (verify trực tiếp session này)

- **F15** Trong `src/api`: **cả hai** `pnpm --config.verify-deps-before-run=false typecheck` (exit 0) và `npm run typecheck` (exit 0) đều chạy được (cả `package-lock.json` lẫn `pnpm-lock.yaml` tồn tại). Plain `pnpm run` (không flag) fail vì verify-deps tự trigger install.
- **F16** ⚠️ **Mobile jest đang HỎNG SẴN trên main @ 61ed2be**: `pnpm run test` trong `src/mobile` → 8/8 suites fail parse `SyntaxError: Unexpected identifier 'ErrorHandler'` từ `node_modules/.pnpm/@react-native+js-polyfills@0.74.87/.../error-guard.js` — jest-expo default `transformIgnorePatterns` không khớp layout pnpm (`jest.config.js:1-6` không có override). 0 test chạy được. **Phải fix trước khi viết test mobile mới.**
- **F17** Docker stack (`infra/docker/compose.yaml`): postgres, redis, api :3000, web :3001, mobile :19006 — healthy; psql `docker exec buildflow-postgres-1 psql -U buildflow -d buildflow` (precedent `docs/evidence/job-srs-004/JOB-SRS-004-E2E.md:29`); `GET /api/v1/status` tồn tại (`src/api/status/status.controller.ts`).
- **F18** Evidence pattern #44: `docs/evidence/job-srs-004/` gồm `e2e-driver-job-srs-004.cjs`, `e2e-vars-*.json`, `run-*.stdout.log`, `JOB-SRS-004-E2E.md`, `shots/`; spec in-memory gắn nhãn trung thực "KHÔNG phải real-DB proof" (precedent `src/api/test/work-order-job-board.e2e.spec.ts:12-17`).

---

## 3. Bounded decisions (đã chốt, kèm phương án bị loại)

**BD1 — Pagination: OFFSET** (`limit` 1-100 default 20, `offset` ≥0 default 0), parity §17; thẻ `ORDER BY updated_at DESC, id DESC` (thêm tiebreak `id` cho deterministic — chỉ trên path job-board, không retrofit `search()`).
*Loại:* cursor (idiom thứ hai, không consumer cần). *Drift offset khi có insert giữa 2 lần "Tải thêm" là inherent — ghi 1 câu trong §20; refresh reset offset 0.*

**BD2 — Worker ngoài scope / không membership / inactive → `200 { data: [], total: 0 }`, KHÔNG 403; endpoint KHÔNG nhận bất kỳ filter param nào (`projectId`/`status`/`search` cấm — là của #46).**
Anti-leak parity §17 (:437, `search-work-orders.use-case.ts:57-60`); "sửa ID/URL không bypass" giữ bằng construction (không có param scope để sửa). Worker inactive → JWT chết/hết hạn → 401 ở guard; không re-check user status per-request (không thuộc read surface hiện có — OQ1). Khi #46 thêm `projectId`, bắt buộc tái dùng 403-generic §17.
*Loại:* 403 cho membership rỗng (leak sự khác biệt giữa "không quyền" và "hết việc").

**BD3 — Route: endpoint MỚI `GET /api/v1/job-board`** (controller riêng `JobBoardController` trong job module, `JwtAuthGuard`, `Cache-Control: no-store`), KHÔNG phải flag trên `GET /work-orders?jobBoard=available`.
Lý do: (a) worker board và coordinator list khác consumer, khác predicate (available phải lọc trong SQL — gắn flag làm đổi COUNT/ORDER semantics của `search()` chung mà web #41-44 đang dùng = rủi ro regression); (b) khác item shape (không `createdBy`, thêm `jobBoard.state`, có area/trade refs); (c) "sửa URL không bypass" giữ đơn giản. §19(h) (:498) là *defer quyết định*, không mệnh lệnh dùng cùng route — §20 ghi rõ deferral này được discharge bởi BD3.
*Loại:* flag trên list chung (contaminate SQL dùng chung, DTO fork).

**BD4 — Unknown query key → BỎ QUA (ignore), KHÔNG 400.** Parity precedent `work-orders.controller.ts:155-186` (đọc `@Query()` từng param, key lạ lặng lẽ bỏ qua); không tạo cơ chế ValidationPipe-query mới cho 1 endpoint. Chỉ `limit`/`offset` GIÁ TRỊ sai → 400 `fieldErrors`. Test AC5 assert key lạ bị ignore (không có tác dụng mở quyền), không assert 400.

**BD5 — Availability predicate: server-side SQL WHERE (KHÔNG post-filter), `now` capture MỘT lần trong use case, truyền vào cả SQL lẫn `deriveJobBoardState`.** Predicates:
```sql
WHERE w.status = 'OPEN'
  AND w.job_board_open = true
  AND (w.job_board_open_from IS NULL OR w.job_board_open_from <= $now)
  AND (w.job_board_open_until IS NULL OR w.job_board_open_until > $now)   -- strict
  AND NOT EXISTS (SELECT 1 FROM public.assignments a
                  WHERE a.work_order_id = w.id
                    AND a.status IN ('PENDING_ACCEPTANCE','ACTIVE'))
  [AND w.project_id = ANY($scope::uuid[])]        -- chỉ non-ADMIN
ORDER BY w.updated_at DESC, w.id DESC
LIMIT $n OFFSET $m
-- + COUNT(*) trên cùng WHERE cho total
```
`NOT EXISTS` PHẢI trong WHERE (post-filter phá `total` và page). Biên `until == now`: SQL loại (conservative, chặt hơn policy đúng 1 instant µs) — ghi trong §20, badge không liên quan vì row không trả về. Sau page-SQL, use case gọi batch `hasActiveAssignmentByWorkOrderIds(pageIds)` và derive `jobBoard.state` trên tập đó — item bị claim giữa page-SQL và enrichment được serve với `state: 'ASSIGNED'` (thực thi "báo rõ" + "trả status/window version để UI tránh stale action").

**BD6 — Response shape item (không PII thừa):**
`{ id, code, title, projectId, projectName, areaId, areaName, workTypeId, workTypeName, requiredTradeId?, requiredTradeName?, priority, plannedStartAt, plannedEndAt, plannedHeadcount, version, jobBoard: { open, openFrom, openUntil, state } }`
Envelope `200 { data, total, limit, offset }` + `no-store`. **`createdBy` bị loại chủ đích** (issue: "Không hiển thị dữ liệu cá nhân không cần thiết"). `areaName`/`requiredTradeName` từ 2 batch ref mới `findAreaRefs`/`findTradeRefs` mirror `findProjectRefs` (F6 — nếu không, card render uuid, vi phạm bullet Must "location" và "skill summary" — finding MAJOR của review). Không trả boolean `hasActiveAssignment` trên item list (thừa — `state` đã encode).

**BD7 — Card CTA "Xem chi tiết": preview screen TỐI THIỂU read-only trong #45, KHÔNG nút "Nhận việc" bao giờ.** Issue có bullet Must "Card hiển thị … và CTA xem chi tiết" + flow step 4; constraint #47 là *detail view + claim CTA* đầy đủ. Giải dungtrung: card CTA → `app/job-board/[id].tsx` + `WorkOrderPreviewScreen` mỏng, gọi **endpoint có sẵn** `GET /api/v1/work-orders/:id` (WORKER được đọc — F7 :438), hiện cùng fields + `jobBoard.state`; `state ≠ 'AVAILABLE'` → banner trạng thái, không action. #47 sẽ thay/mở rộng screen. ⚠️ **Đây là điểm Lead cần biết: nếu Lead muốn hẹp hơn, fallback = hoãn CTA hoàn toàn (phương án Plan-2) + ghi deviation vào §20 + comment issue — mọi task khác không đổi.**

**BD8 — Audit/notification: không có** cho read endpoint (parity §17). AC7 xử lý trung thực: e2e assert audit/notification count không đổi sau N GET; non-application ghi trong §20. Driver psql assert audit theo **delta before/after** (tránh đếm nhầm write của #44 chạy song song).

**BD9 — AC4 filter deviation** ghi ở ENDPOINTS §20 + **comment trên issue #45** (không chỉ PR comment) khi mở PR; precedent #44 AC4 (`docs/plans-job-srs-004.md:143`).

---

## 4. Task DAG tuyến tính

Chuỗi cứng: **T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12**. T5 (contract docs) trước consumer code (WORK-ROUTING.md:53); T9 (mobile test) chạy xanh TRƯỚC T11 (evidence) để không chụp evidence cũ; T10 (docker rebuild) trước T11.

| # | Task | Files dự kiến | Acceptance criteria | Build on |
|---|---|---|---|---|
| **T0** | **Fix mobile jest infra (hỏng sẵn, F16):** thêm `transformIgnorePatterns` trong `jest.config.js` che phủ layout pnpm `node_modules/.pnpm/…` (js-polyfills, react-native, expo, expo-router ESM). Không đổi dependency | `src/mobile/jest.config.js` | `pnpm run test` trong src/mobile chạy được 8 suite hiện hữu (0 fail parse); KHÔNG cite là phần nghiệp vụ #45 khi đóng issue | F16 |
| **T1** | **Port:** thêm `JobBoardFilter {projectIds?: string[]; limit: number; offset: number; now: Date}` + `searchJobBoard(filter): Promise<{entities, total}>`; thêm batch `findAreaRefs(ids)` + `findTradeRefs(ids)` mirror `findProjectRefs` (kiểm tra tên cột code/name của `project_areas`/`trades` trong 0001 trước khi viết) | `src/api/src/modules/job/domain/repository/work-order-repository.port.ts` | Port compile; method tùy chọn để in-memory fake không vỡ | F2 |
| **T2** | **PG adapter:** implement `searchJobBoard` đúng BD5 (WHERE đầy đủ, NOT EXISTS, COUNT cùng WHERE, `ORDER BY updated_at DESC, id DESC`); implement `findAreaRefs` (`public.project_areas`), `findTradeRefs` (`public.trades`) — 1 query `= ANY($1::uuid[])` mỗi loại | `src/api/src/modules/job/infrastructure/database/pg-work-order.repository.ts` | Spec unit: từng nhánh WHERE loại đúng assigned/expired/scheduled/cancelled/wrong-status/out-of-scope; total = đúng số available qua pages; ids rỗng → map rỗng; `search()` cũ không đổi | F3, F8 |
| **T3** | **Use case `SearchJobBoardUseCase`** (mới): scope-first mirror F4 (ADMIN `null` unrestricted; membership rỗng → `{[],0}` early-return); capture `now = new Date()` MỘT lần; gọi `searchJobBoard`; batch `hasActiveAssignmentByWorkOrderIds(pageIds)` + `findWorkTypeRefs`/`findProjectRefs`/`findAreaRefs`/`findTradeRefs`; derive `jobBoard.state` per-item với cùng `now`. Register provider | `src/api/src/modules/job/application/use-case/search-job-board.use-case.ts` (+ spec), `job.module.ts` | Spec unit: ADMIN/member/empty-membership; state derived với now chung; không tx/audit | F1, F4 |
| **T4** | **Controller + mapper:** `JobBoardController` `@Controller('api/v1/job-board')`, `JwtAuthGuard`, `@Header('Cache-Control','no-store')`; `GET` parse `limit`/`offset` qua `filterError` → 400 fieldErrors (key lạ ignore — BD4); tái dùng `workOrderActor` (extract helper chung nếu tránh duplicate). Mapper mới `toJobBoardItemResponse` (shape BD6, không `createdBy`) | `src/api/src/modules/job/api/rest/controller/job-board.controller.ts` (mới, + spec), `presentation/mapper/job-board.mapper.ts` (mới, + spec) | 200 envelope; 400 limit/offset; anon 401; header no-store; item không chứa `createdBy` | F5, F6 |
| **T5** | **Contract docs (trước consumer):** ENDPOINTS.md **§20 "Job Board list — JOB-SRS-005 (#45) bounded decisions"**: bảng endpoint (JWT mọi user đăng nhập; scope = ACTIVE-membership, ADMIN unrestricted; query `limit/offset`; envelope + item shape; lỗi 400/401; `no-store`); BD1-BD9 với phương án bị loại; ghi rõ §19(h) discharged bởi BD3; note "list không phải authorization — claim re-check server-side ở #47/#48"; note biên `until == now`. API.md: dòng endpoint + permission table | `docs/architecture/ENDPOINTS.md`, `docs/architecture/API.md` | Mỗi decision có justification + rejected alternative | F7 |
| **T6** | **Mobile API client:** types `JobBoardItem`/`JobBoardPage`; `fetchJobBoard(token, {limit?, offset?})` → `${API_URL}/api/v1/job-board?...`, `cache: 'no-store'`; error mapping mirror `toProjectError` (401 session-dead, 403 generic, network → message kết nối); test adapter | `src/mobile/src/api/client.ts` (+ `job-board.test.ts`) | Test: URL/query, headers, error map per status; không import web/api | F10 |
| **T7** | **Mobile UI:** route `app/job-board/index.tsx` (session-restore mirror `app/projects/index.tsx`) + `app/job-board/[id].tsx`; đăng ký `Stack.Screen` title "Bảng việc" trong `_layout.tsx`; `features/job-board/JobBoardScreen.tsx`: FlatList + `RefreshControl` (pull-to-refresh reset offset 0) + `onEndReached` pagination (dừng khi loaded === total, khoá khi đang load); states loading/empty ("Chưa có việc nào đang nhận — kéo xuống để làm mới")/error+retry/401 re-login/403; `JobBoardCard.tsx`: code/title/projectName/workTypeName/**areaName**/requiredTradeName/priority/planned times/window + state badge + CTA "Xem chi tiết" → `/job-board/[id]`; **không render chữ "Nhận việc" trong mọi state**; `WorkOrderPreviewScreen.tsx` mỏng gọi `GET /work-orders/:id`, banner khi state ≠ AVAILABLE; nút entry "Job Board" trên `ProfileScreen` (mirror :162-168) | `src/mobile/app/job-board/{index,[id]}.tsx`, `app/_layout.tsx`, `src/mobile/src/features/job-board/{JobBoardScreen,JobBoardCard,WorkOrderPreviewScreen}.tsx`, `src/mobile/src/features/profile/ProfileScreen.tsx` | MOBILE.md §8 checklist tick được: đủ states, feature interface tách, a11y label mọi control, không native dep mới, chỉ RN primitives | F9, F11, F12, BD7 |
| **T8** | **API tests:** unit use-case (scope tree, empty membership, now-capture, batching); spec PG (predicates, pagination); mapper spec (shape, không createdBy, state derived). **Integration IN-MEMORY** `src/api/test/job-board-list.e2e.spec.ts` — header trung thực "IN-MEMORY, KHÔNG phải real-DB proof" (F18): anon 401 / membership rỗng 200 empty / chỉ AVAILABLE đúng scope / seed 4 lớp loại trừ (assignment ACTIVE, until quá khứ, from tương lai, status READY, CANCELLED, WO project ngoài scope) → chỉ row available trả về / limit-offset sai 400 fieldErrors / list lại sau khi chèn assignment → item biến, total giảm / unknown query key bị ignore / 3 GET liên tiếp audit/notification count không đổi (AC7) | specs trong `src/api/src/modules/job/**`, `src/api/test/job-board-list.e2e.spec.ts` | AC1/2/3/5/6/7 covered; suite xanh | T1-T4 |
| **T9** | **Mobile tests** (chạy xanh trước evidence): `JobBoardScreen.test.tsx` mock client — loading/list render (code, title, projectName, badge AVAILABLE)/empty/error+retry gọi lại/401 copy/Tải thêm append page 2 (mock 2 pages)/pull-refresh refetch/assert **không có "Nhận việc"**/state ≠ AVAILABLE render banner; `JobBoardCard.test.tsx` (fields, CTA điều hướng, không claim); `WorkOrderPreviewScreen.test.tsx` (states, banner non-AVAILABLE, không claim) | `src/mobile/src/features/job-board/*.test.tsx` | Mọi state DoD được assert; `pnpm run test` xanh | T0, T6, T7 |
| **T10** | **Docker rebuild + smoke:** `docker compose -f infra/docker/compose.yaml build api mobile && up -d`; health; smoke `GET /api/v1/job-board` bằng worker JWT qua container MỚI; mobile :19006 render Job Board | `infra/docker/compose.yaml` (build only, không sửa) | Tất cả services healthy; endpoint 200 từ container mới (chống stale-image) | T4 |
| **T11** | **Evidence real-DB:** `docs/evidence/job-srs-005/`: `e2e-driver-job-srs-005.cjs` (login worker + PM qua API thật → PM mở board trên ≥2 WO demo (1 available, 1 gán assignment seed, 1 window tương lai, 1 hết hạn) → worker xem list trên Expo web :19006 qua API thật → psql asserts (excerpt inline, seed assignment theo CHECK `assignee_type='USER'`, `source='SELF_ACCEPT'`, `status='PENDING_ACCEPTANCE'`; audit assert theo **delta before/after**) → worker pull-to-refresh → item biến → screenshots `shots/`); `e2e-vars-*.json`; `run-*.stdout.log`; `JOB-SRS-005-E2E.md` (≥2 lần ALL-PASS liên tiếp; ghi rõ in-memory specs KHÔNG phải real-DB proof; ghi rõ claim được mô phỏng ở DB vì claim là #47); helper get-token nếu script smoke tham chiếu | `docs/evidence/job-srs-005/**` | Driver chứng minh UI→API→DB→UI; psql excerpt cho thấy 4 lớp loại trừ tồn tại trong DB nhưng vắng trong response | T8, T9, T10 |
| **T12** | **MOBILE.md fan-out** + issue: thêm mục Job Board (route, states, entry, contract pointer §20) + tick §8; comment issue #45 ghi AC4 deviation + BD7 scope note | `docs/architecture/MOBILE.md` + issue comment | WORK-ROUTING fan-out (:18) thoả | T7 |

---

## 5. Test mapping 1-1 (8 checkbox + DoD)

| Issue | Test/proof cụ thể | File | Loại |
|---|---|---|---|
| AC1 đúng scope thấy available | use-case spec scope-first; e2e in-memory worker thấy đúng WO project mình, state AVAILABLE; driver real-DB trả đúng tập available | `search-job-board.use-case.spec.ts`, `job-board-list.e2e.spec.ts`, driver | unit + e2e in-memory + real-DB |
| AC2 loại trừ 4 lớp | e2e seed 6 row tiêu cực (assignment ACTIVE / until quá khứ / from tương lai / READY / CANCELLED / ngoài scope) → response chỉ còn row available; PG spec từng nhánh WHERE; psql excerpt chứng minh row tồn tại nhưng vắng response | e2e + PG spec + driver | unit + e2e + evidence |
| AC3 refresh sau claim | e2e: list → chèn assignment → list lại → item biến, `total` giảm; driver: psql INSERT → refresh trên UI → card biến (screenshot); mobile test: mock page 1 có item, refetch không có → list cập nhật | e2e + driver + mobile test | cả ba |
| AC4 pagination + permission Mobile | mobile: "Tải thêm" append đúng trang 2 theo `total`, refresh reset offset 0; e2e: window limit/offset chính xác (3 row, limit 2 → 2/1). Filter = deviation BD9 | `JobBoardScreen.test.tsx` + e2e | mobile unit + e2e (deviation ghi rõ) |
| AC5 quyền | e2e matrix: anon 401; membership rỗng → 200 `{[],0}`; worker P1 không nhận row P2; không có param scope để tamper; unknown query key ignore (không mở quyền); ADMIN thấy tất cả | `job-board-list.e2e.spec.ts` + driver | e2e + evidence |
| AC6 lỗi nêu nguyên nhân | `limit=0/101/abc`, `offset=-1` → 400 `fieldErrors` + message; mobile render đúng message/code + "Thử lại" | controller spec + mobile test | unit + mobile |
| AC7 retry/double-submit | N/A-trung thực + proof: e2e audit/notification count không đổi sau N GET (delta); mobile retry = retry button + pull-refresh (GET idempotent) | e2e AC7 | e2e (non-application trong §20) |
| AC8 UI dùng API thật | driver trên stack đã rebuild: Expo web :19006 → API :3000 → Postgres → UI; ≥2 ALL-PASS + shots | `docs/evidence/job-srs-005/` | evidence |
| DoD UI states | mobile specs assert từng state loading/empty/success/error/permission(401+403)/retry | mobile specs | mobile unit |
| DoD không claim button | mobile test assert "Nhận việc" không render trong mọi state; e2e assert item state ≠ AVAILABLE không có trong payload | mobile + e2e | cả hai |
| DoD không PII thừa | mapper spec assert không `createdBy`/email | mapper spec | unit |
| DoD stale-action | item có `version` + `state`; preview re-read `GET :id` — test: item bị claim giữa list→preview hiện banner non-AVAILABLE | preview test + e2e | mobile + e2e |
| DoD docs đồng bộ | T5 + T12 cùng PR | docs | docs |
| DoD không đóng khi thiếu UI | slice dọc duy nhất, PR link cả backend + mobile | process | — |

---

## 6. Dependencies và constraints

- **Thứ tự cứng:** T0 độc lập, chạy đầu (mobile test hiện 0/8 chạy được — F16); T1→T2→T3→T4 tuần tự; **T5 contract trước T6/T7 consumer** (WORK-ROUTING.md:53); T8 sau T4, T9 sau T7 (và T0); **T10 rebuild trước T11 evidence**; T9 xanh trước T11 (tránh evidence cũ).
- **Ranh giới:** mobile không import `src/web`/`src/api` (WORK-ROUTING.md:28); chỉ RN primitives (RefreshControl, FlatList, Pressable); không migration mới (F8); CLAIM không triển khai — chỉ list + pagination + refresh; KHÔNG đụng stash/reflog/commit trước 61ed2be.
- **Cùng change:** producer API + consumer mobile + docs API.md/ENDPOINTS.md/MOBILE.md trong một PR.
- **Toolchain:** `pnpm` dùng binary với `--config.verify-deps-before-run=false` (F15, cả api lẫn mobile); `npm run` là fallback hợp lệ trong `src/api` (F15). Mobile jest phải qua T0.

## 7. Rủi ro và câu hỏi mở (kèm bằng chứng)

1. **Mobile jest hỏng sẵn** (F16, verify trực tiếp: 8/8 suites fail parse) — nếu không fix T0, mọi mobile test + DoD "unit test pass" vô nghĩa. Đã thành task T0.
2. **BD7 (preview screen) giáp ranh #47** — reviewer đánh giá MAJOR cần Lead ack. Screen mỏng, tái dùng endpoint có sẵn (F7 :438); fallback là hoãn CTA + deviation. **Đây là điểm duy nhất tôi đề xuất Lead xác nhận trước khi engineer bắt đầu T7.**
3. **Biên thời `until == now`**: SQL strict `>` loại đúng 1 instant mà policy badge tính AVAILABLE (policy :143) — thực tế vô hại (µs), đã ghi trong §20; `now` capture một lần triệt tiêu lệch clock chính (BD5).
4. **Mô phỏng claim bằng psql INSERT cho AC3** — chứng minh refresh semantics chứ không phải round-trip claim (claim là #47); seed phải thoả CHECK 0001:287-317 (`assignee_type='USER'`, `source='SELF_ACCEPT'`, `status='PENDING_ACCEPTANCE'`); ghi rõ trong `JOB-SRS-005-E2E.md`.
5. **Stale docker image mobile** → T10 bắt buộc rebuild `api` + `mobile` trước evidence (precedent AT7, plan-004 T10).
6. **Drift offset pagination** khi có insert giữa các lần tải — inherent BD1, refresh reset offset 0; ghi §20.
7. **OQ1 (không chặn):** inactive/suspended có cần hard-block per-request? Read surface hiện tại không re-check user status (JWT expiry + scope filter gánh); nếu reviewer đòi, thuộc IAM cross-module — không phải #45. Ghi flag trong PR.
8. **AC4/AC7 deviation** có thể bị chất vấn khi review issue — đã ghi BD9/BD8 vào §20 + comment issue.

## 8. Lệnh verify chính xác và kết quả mong đợi

```bash
cd /home/trung/Documents/2026/project/buildflow

# ── API (pnpm binary + flag, đã verify exit 0; npm run là fallback) ──
cd src/api
pnpm --config.verify-deps-before-run=false typecheck          # exit 0
pnpm --config.verify-deps-before-run=false lint               # exit 0
pnpm --config.verify-deps-before-run=false test               # exit 0 — suite cũ + unit/mapper/PG mới
pnpm --config.verify-deps-before-run=false test -- job-board-list.e2e.spec.ts   # exit 0 (IN-MEMORY)
cd ../..

# ── Mobile (SAU T0) ──
cd src/mobile
/home/trung/.local/bin/pnpm run typecheck                     # exit 0 (đã verify trên main)
/home/trung/.local/bin/pnpm run lint                          # exit 0
/home/trung/.local/bin/pnpm run test                          # exit 0 — 8 suite cũ + job-board mới (hiện fail: 8/8 parse error → T0)
/home/trung/.local/bin/pnpm run build                         # expo export --platform web thành công
cd ../..

# ── Docker rebuild + smoke (T10) ──
docker compose -f infra/docker/compose.yaml build api mobile
docker compose -f infra/docker/compose.yaml up -d
docker compose -f infra/docker/compose.yaml ps                # api/web/mobile/postgres/redis Up (healthy)
curl -s http://localhost:3000/api/v1/status | head            # 200 JSON
TOKEN=<worker-jwt-từ-driver-vars>
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/job-board?limit=20&offset=0"
# → 200 {"data":[{...,"jobBoard":{"open":true,...,"state":"AVAILABLE"}}],"total":N,"limit":20,"offset":0}
#    và KHÔNG item nào state != AVAILABLE
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/job-board?limit=0"            # → 400
curl -s -o /dev/null -w '%{http_code}\n' \
  "http://localhost:3000/api/v1/job-board"                    # → 401
# Unknown key bị ignore (BD4):
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/job-board?projectId=<uuid-ngoài-scope>"   # → 200 (param ignored)

# ── psql asserts trong driver (T11) ──
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "SELECT id,status,job_board_open,job_board_open_from,job_board_open_until FROM work_orders WHERE id='<id>';"
docker exec buildflow-postgres-1 psql -U buildflow -d buildflow -c \
  "SELECT work_order_id,status FROM assignments WHERE work_order_id='<id>';"

# ── Evidence (T11, sau T10) ──
node docs/evidence/job-srs-005/e2e-driver-job-srs-005.cjs     # ALL-PASS ×2 liên tiếp; shots/ đầy
```

**Trạng thái đóng issue:** tất cả lệnh exit 0; `docs/evidence/job-srs-005/` đầy đủ (≥2 ALL-PASS + psql excerpts + shots); ENDPOINTS §20 / API.md / MOBILE.md cùng PR; comment issue ghi AC4/AC7 deviation + BD7 scope note; issue #45 đóng chỉ khi backend + mobile đều được chứng minh.

---

**Tóm tắt tổng hợp cho Lead:** giữ của Plan 1 — endpoint mới `GET /api/v1/job-board` (BD3), preview screen tối thiểu (BD7 — cần Lead ack), `findAreaRefs`/`findTradeRefs`, single-clock `now`; giữ của Plan 2 — fix jest mobile T0 (blocker thật, đã verify), tiebreak `id DESC`, seed CHECK cho driver, delta-based audit assert; giải quyết xung đột từ review — unknown query key = ignore (BD4), `until == now` loại conservative và ghi §20, mobile test chạy trước evidence.

