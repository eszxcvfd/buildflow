# orchestrate run r-mtuaqwg8-55i0ox

- mode: fanout | agent: session-53388f77-905b-46ab-9594-7d3017dea139 | provider: spawn
- concurrency: 6 | durationMs: 1928112 | aborted: false
- startedAt: 2026-09-09T16:12:14.408Z | finishedAt: 2026-09-09T16:44:22.520Z

## Plan JOB-SRS-006 #46 [via planner] [completed] {xkiro/z-ai/glm-5.3-flash}

Tôi đã có đủ: 2 plan + 2 review + các kiểm chứng chéo của riêng tôi. Tổng hợp final plan (Stage 3) — giải quyết tường minh mọi mâu thuẫn giữa hai plan và các finding BLOCKER/MAJOR của reviewer.

---

# KẾ HOẠCH TRIỂN KHAI CUỐI CÙNG — Issue #46 [JOB-SRS-006] Must — Tìm kiếm và lọc Job Board

Repo `/home/trung/Documents/2026/project/buildflow`, branch `main @ 13f528b`. Vertical slice: **backend → docs → mobile UI → test → evidence → docker → đóng issue**. Plan này tổng hợp từ 2 plan độc lập + 2 review (cả hai NEEDS-REVISION, các finding đã được tôi kiểm chứng lại trực tiếp trên tree): mọi mâu thuẫn đã giải quyết tường minh ở phần thiết kế; comment cũ "đã merge" trên issue chỉ là prior-art signal — không khôi phục commit nào trước `61ed2be`.

---

## 1. Goal và acceptance criteria

**Goal:** Worker lọc Job Board theo **ngày, dự án, khu vực, loại công việc, kỹ năng** — filter kết hợp cho kết quả nhất quán, không bypass scope; refresh phản ánh trạng thái hiện tại; Mobile có filter sheet/chips multi-select + reset + giữ filter khi quay lại list + dedupe request (discharge follow-up #45). Kèm test map 1-1 với 8 checkbox và evidence E2E real-DB.

**AC map 1-1 với 8 checkbox issue:**

| # | Checkbox issue | Tiêu chí kế hoạch |
|---|---|---|
| AC1 | Từng filter, filter kết hợp và clear | 5 chiều filter (`dateFrom`/`dateTo`, `projectId`, `areaId` lặp được, `workTypeId` lặp được, `skill=mine`) AND-compose vào WHERE SQL (không post-filter); test riêng từng filter + kết hợp; clear (reset + xóa từng chip) trả về đúng tập baseline #45 |
| AC2 | Invalid date, out-of-scope project, inactive skill | Naive ISO/thiếu offset → `400 fieldErrors {dateFrom|dateTo}`; `dateFrom > dateTo` → `400` 2 field; `projectId` ngoài scope → `403` generic; `skill=mine` khi worker không có trade active → `200 {[], 0}` (không lỗi); `areaId`/`workTypeId` đúng UUID nhưng không tồn tại/inactive → `200 empty` |
| AC3 | Refresh/state change không hiển thị item sai | Refresh giữ filter hiện hành (re-fetch offset 0); WO bị claim (seed assignment qua psql — claim là #47, ghi rõ mô phỏng) biến khỏi response; stale response (generation cũ) bị bỏ qua |
| AC4 | Pagination/filter response tương thích giữa các module | `limit`/`offset` đúng trên filtered WHERE; `total` = COUNT trên cùng WHERE; envelope `{ data, total, limit, offset }` + `no-store` giữ nguyên; `filter-options` dùng cùng scope+availability predicate |
| AC5 | Quyền: đúng role/scope pass, sai role/project/sửa ID/URL không bypass | Matrix: anon 401; membership rỗng → 200 empty (BD2); worker PRA không thấy WO PRB dù gửi mọi filter; `projectId` ∉ scope → 403; không có param nào mở quyền (scope luôn server-side, client chỉ gửi `projectId` đơn) |
| AC6 | Validation + trạng thái không hợp lệ; lỗi nêu nguyên nhân | 400 `{statusCode, message, fieldErrors}` keyed đúng field, message tiếng Việt actionable; mobile render per-field + chặn gửi khi client-validate fail (mirror rule server) |
| AC7 | Retry/double-submit khi có ghi dữ liệu | **N/A-trung thực (BD8 parity):** slice read-only — assert delta audit/notification = 0 sau N GET có filter; mobile: generation dedupe + busy-guard chứng minh không request chồng |
| AC8 | Integration/E2E UI dùng API thật | Driver real-DB: login thật (PM quoc.tran MANAGER PRA+PRB; WORKER ba.nguyen WORKER/QC member PRA) → filter qua Expo UI → API thật → PostgreSQL thật → screenshots, ≥2 run ALL-PASS label mới, cleanup by id `rest=0` |

**DoD:** backend + validation + scope + stable sort; Mobile FilterSheet thật đủ states (loading/empty/empty-filtered/success/validation/error/401/403/retry/filter-loading); E2E UI→API→DB→UI với demo data + bằng chứng; unit + in-memory integration + negative/permission test; docs ENDPOINTS §20 + API.md + MOBILE.md đồng bộ; **discharge BD9 (:536) và follow-up dedupe (:540)**; `docs/plans-job-srs-006.md` checked-in + PLANS.md registry; issue chỉ đóng khi cả backend lẫn mobile xong, PR link đầy đủ. Out of scope: #47 (không nút claim ở mọi state), #48–#50, §19/#44 contract, full-text search (bounded decision BD-từ-chối).

---

## 2. Current repository facts (file:line, đã verify tại 13f528b)

### Backend (`src/api`, NestJS hexagonal, module `job`)
- **B1** Controller `GET /api/v1/job-board`: `job-board.controller.ts:40-95` — `JwtAuthGuard` :41, `no-store` :46, đọc từng param qua `@Query` :49-50, pre-check `/^\d+$/` :55-74, `filterError()` :17-19 → `400 {statusCode, message, fieldErrors}` (helper hiện hỗ trợ **1 field** — m5); unknown query key lặng lẽ ignore (BD4); doc-comment :26-39 ghi "KHÔNG nhận filter param" (phải sửa).
- **B2** Use case `search-job-board.use-case.ts:63-122`: scope-first `resolveAccessibleProjectIds` :64-67 (ADMIN → `null` unrestricted; membership rỗng → `empty(now)` :83-85, không 403 — BD2); `now` capture MỘT lần :81 (BD5); fail-closed port thiếu :90-93; 5 batch enrichment song song :108-120.
- **B3** Port: `JobBoardFilter {projectIds?, limit, offset, now}` `work-order-repository.port.ts:70-76`, `searchJobBoard?` :121.
- **B4** PG adapter `searchJobBoard` `pg-work-order.repository.ts:239-275`: WHERE status/board/window (`until` strict `>`)/`NOT EXISTS` assignment + `[project_id = ANY($n::uuid[])]` non-ADMIN; COUNT cùng WHERE :256-260; clamp :262-268; `ORDER BY w.updated_at DESC, w.id DESC` :270-273.
- **B5** Date precedent #44: `parsePlannedDateTime` `work-order.policy.ts:95`; `ISO_OFFSET_SUFFIX_RE` :98 + `assertIsoOffset` `work-order-job-board.policy.ts:96-125` — **module-private, chưa export** (m1); naive ISO → 400 `JOB_BOARD_WINDOW_INVALID`; so sánh UTC instant (§19(e), ENDPOINTS.md:498).
- **B6** Migration 0001: `work_orders` `project_id` :220, `area_id` :221, `work_type_id` :222, `required_trade_id` :223 (nullable), `planned_start_at`/`planned_end_at` timestamptz :229-230, CHECK :255-257; **không có `required_skills` trên work_orders** (chỉ template, 0008:41).
- **B7** Capability: `resource_trades` 0001:88-111 (`resource_type` USER/CREW, `skill_level` 1-5, `effective_from/to`, `is_active`); org repo đọc `resource_trades` với điều kiện `is_active = true` tại `pg-worker.repository.ts:43` và `findActiveTradesByUserId` port :28 / impl :217. **`OrgModule` KHÔNG có `exports`** (`org.module.ts` đóng class sau providers — đã verify) ⇒ cross-module DI `WORKER_REPOSITORY` không wireable mà không sửa org-lane.
- **B8** Nguồn options cho WORKER: `GET /trades` → 403 (API.md:302); `GET /work-types(/active)` → 403 (API.md:312); `GET /projects/:id/areas` member-read OK (API.md:310); `GET /projects` với WORKER không có row tường minh (unverified, không phụ thuộc).
- **B9** ENDPOINTS §20: BD2 mandate 403-generic khi #46 thêm `projectId` :515; BD4 :517; BD5 :518-532; BD9 :536; follow-up dedupe :540; BD1 sort + "refresh reset offset 0" :514. API.md:322 row ghi "không filter param scope để tamper" (phải sửa); MOBILE.md:60 deviation BD9 (phải sửa).

### Mobile (`src/mobile` — Expo Router, jest-expo)
- **B10** Routes ở **`src/mobile/app/job-board/`** (không phải `src/app`): `index.tsx`, `[id].tsx`. Screen `src/mobile/src/features/job-board/JobBoardScreen.tsx` (237 dòng): refresh = offset 0 :81-85; loadMore guard :87-91; states :97-164; moreError/refreshError :19-22; **không có generation dedupe**.
- **B11** Client `client.ts`: `fetchJobBoard` ~:474 (`no-store`), `FetchJobBoardParams` ~:443, `JobBoardItem` ~:415, `toJobBoardError` thread `fieldErrors` ~:457-471 (F006), `listProjects` ~:354.
- **B12** Test pattern: `jest.spyOn(client,'fetchJobBoard')` + `@testing-library/react-native` + accessibilityLabel; test hiện có assert "never renders a claim action" — giữ nguyên; mobile jest đã fix `transformIgnorePatterns` từ #45.
- **B13** Evidence pattern `docs/evidence/job-srs-005/`: driver playwright-core + Chrome headless, creds, seed UUIDs **:80-86** (PRA `10000000-…-0001`, PRB, AREA_KQ01, AREA_GAA03, WT_BTCT, TRADE_THOCAT, SEED_WORKER_ID :86) — giữ nguyên; cleanup id-based `rest=0` :297-308; **driver hardcode planned dates tuyệt đối** (:170-171 — driver mới phải tính theo now).
- **B14** **`ba.nguyen` (E2E WORKER) KHÔNG có row `resource_trades`** trong demo DB (docs/demo-data.md:35; owner trade seeded là tuan.pham/dong.trinh/lan.tran/hung.vo/phuc.dang — không dùng được do password/membership) ⇒ case skill=mine dương phải provision dữ liệu.
- **B15** Toolchain: không có root `package.json`; chạy **trong** `src/api`/`src/mobile`: `pnpm --config.verify-deps-before-run=false <script>` (đã verify ở plans-job-srs-005.md:64,162 — OQ1 của plan 2 resolved); `npm run` fallback trong `src/api`.

---

## 3. Thiết kế (6 quyết định, đã resolve mâu thuẫn giữa 2 plan)

### D1 — Query params chính thức + date filter áp lên PLANNED dates
Thêm **6 param** vào `GET /api/v1/job-board` (tất cả optional, absent/`''` = không filter — mirror `parsePlannedDateTime` coi `''` là null, m6):

| Param | Kiểu | Validation |
|---|---|---|
| `projectId` | uuid đơn | sai format → `400 fieldErrors {projectId}` |
| `areaId` | uuid, **lặp được** (`areaId=a&areaId=b`) | sai format bất kỳ phần tử → `400 {areaId}` |
| `workTypeId` | uuid, **lặp được** | sai format → `400 {workTypeId}` |
| `dateFrom`/`dateTo` | ISO-8601 datetime **bắt buộc kèm offset** (`Z`/`±hh:mm`/`±hhmm`) — mirror chặt #44 | naive ISO → `400 fieldErrors {dateFrom|dateTo}` code `JOB_BOARD_DATE_RANGE_INVALID`; cả hai present mà `from > to` (instant) → `400` **fieldErrors cả hai field** (mở rộng `filterError` hỗ trợ multi-field) |
| `skill` | enum duy nhất `mine` | giá trị khác → `400 fieldErrors {skill}` |

Multi-select resolution (MAJOR-1 review 1): **chấp nhận hướng Plan 2 — param lặp được cho area + workType** (khớp chips multi-select trên UI và prior-art), `projectId` đơn (picker single-select). Id đúng format nhưng không tồn tại/inactive → `200 empty` (filter, không phải resource fetch). Không cross-validate `areaId ∈ projectId` — AND semantics tự nhất quán (ghi BD).

**Date áp lên PLANNED dates, KHÔNG phải board window.** Lý do: SRS "lọc công việc **theo ngày**" = ngày worker muốn đi làm (kế hoạch); board window (`job_board_open_from/until`) là cửa sổ tuyển và đã bị availability predicate chặn quanh "hiện tại" (from ≤ now < until) nên lọc theo nó vô nghĩa nghiệp vụ. Semantics **overlap instant** (timezone-correct, không `::date` cast): `w.planned_start_at <= $dateTo AND COALESCE(w.planned_end_at, w.planned_start_at) >= $dateFrom`. **Row `planned_start_at IS NULL` bị loại khi có date filter** (conservative, ghi BD + test case). Loại: date-only `YYYY-MM-DD` (timezone ambiguity, phá mandate mirror #44); lọc lên window (sai ngữ nghĩa); naive ISO chấp nhận kèm default TZ (phá parity #44).

### D2 — SQL predicates AND-composed + skill `skill=mine` server-resolved
```sql
[AND w.project_id = $n::uuid]                       -- projectId (nếu gửi)
[AND w.area_id = ANY($n::uuid[])]                   -- areaId[] (nếu gửi)
[AND w.work_type_id = ANY($n::uuid[])]              -- workTypeId[] (nếu gửi)
[AND w.planned_start_at <= $n
     AND COALESCE(w.planned_end_at, w.planned_start_at) >= $n]  -- dateFrom/dateTo
[AND w.required_trade_id = ANY($n::uuid[])]         -- skill=mine → tradeIds của actor
```
COUNT chạy trên cùng WHERE; scope `project_id = ANY(scope)` giữ nguyên vị trí đầu — **filter không thể bypass**. Port mở rộng `JobBoardFilter` (+`projectId?, areaIds?, workTypeIds?, plannedFrom?, plannedTo?, requiredTradeIds?`).

**Scope tamper-proof:** non-ADMIN gửi `projectId` ∉ `resolveAccessibleProjectIds` → **`403` generic** (mandate BD2 :515, parity §17); ∈ scope → `AND w.project_id = $n` thay `ANY($scope)`. ADMIN → filter unrestricted (project không tồn tại → empty, không 404).

**Skill (không suy diễn từ UI):** `skill=mine` → use case resolve tradeIds của actor từ `public.resource_trades` (`resource_type='USER' AND user_id=$1 AND is_active=true` — **mirror đúng điều kiện org đã dùng tại `pg-worker.repository.ts:43`**, tránh drift semantics; effective-window/skill_level là eligibility claim-gate #48/#49). Worker không trade active → **early-return `200 empty`**. Match = `required_trade_id = ANY(tradeIds)`; **WO `required_trade_id IS NULL` bị loại khi skill=mine** (không xác nhận được match — ghi BD). Không nhận param `tradeId` tự do (`GET /trades` 403 cho WORKER sẽ ép UI suy diễn).

**Cross-module wiring (MAJOR-2 review 1, đã verify):** OrgModule không export gì ⇒ **default = thin port trong module `job`** + method PG adapter mới đọc thẳng `public.resource_trades` (precedent: job repo đã đọc chéo `assignments`; điều kiện mirror org :43). KHÔNG sửa `org.module.ts`.

### D3 — Stable sort: GIỮ `updated_at DESC, id DESC`
Tiebreak `id` đã deterministic; thêm filter không đổi ORDER BY ⇒ cùng filter cho cùng thứ tự giữa các page. Đổi sang `planned_start_at` = đổi UX #45, không index, SRS im lặng — scope creep. Drift offset khi `updated_at` đổi giữa 2 lần "Tải thêm" là inherent của offset pagination (BD1 :514) — mitigated bởi refresh reset offset 0 + generation dedupe (D5); đổi filter luôn fetch lại offset 0.

### D4 — Endpoint mới `GET /api/v1/job-board/filter-options`
Cần endpoint mới trong `JobBoardController` (cùng `JwtAuthGuard`, `no-store`, read-only không audit — parity BD8):
```
200 { projects: {id,name}[], areas: {id,name}[], workTypes: {id,name}[], trades: {id,name}[] }
```
Nguồn = **DISTINCT `project_id`/`area_id`/`work_type_id`/`required_trade_id` trên đúng WHERE availability+scope** (shared condition-builder với `searchJobBoard`), enrich name qua batch refs có sẵn (`findProjectRefs`/`findAreaRefs`/`findWorkTypeRefs`/`findTradeRefs`). KHÔNG áp filter người dùng lên options (option set tĩnh — tránh combinatorial API). Không leak (chỉ rút từ rows worker được thấy); membership rỗng → `200` 4 mảng rỗng (BD2 parity); ADMIN → toàn board. **Lý do không reuse:** WORKER 403 ở `/trades` và `/work-types` (B8); `/projects/:id/areas` per-project; ghép nguồn = N round-trip + lệch scope. Residual: option có thể hết kết quả sau claim → empty-filtered state cover (D5.6).

### D5 — Mobile: module-level filter store + FilterSheet + generation dedupe
1. **Filter state sống ở module-level store trong feature**: file mới `src/mobile/src/features/job-board/job-board-filter-state.ts` (plain get/set). Lý do (resolve mâu thuẫn Plan1-screen-state vs Plan2-store): Expo Router **remount** `JobBoardScreen` khi push `/job-board/[id]` rồi back → React state mất (reviewer 2 đã xác nhận) ⇒ screen-state không bảo đảm AC "giữ filter khi quay lại". Store scope = phiên app; caveat "mất khi restart app" ghi MOBILE.md. KHÔNG AsyncStorage (quá bền, filter cũ sống qua đổi contract).
2. **UI:** nút "Lọc" mở `JobBoardFilterSheet` (Modal mới): Dự án single-select (nguồn `filter-options.projects`), Khu vực multi-chips (`areas`), Loại công việc multi-chips (`workTypes`), toggle "Chỉ việc phù hợp kỹ năng của tôi" (`skill=mine`), Từ ngày/Đến ngày (client compose ISO có device offset, thí dụ `2026-02-10T00:00:00+07:00`), "Xoá bộ lọc" + "Áp dụng". Header list: **active-filter chips** (xóa từng điều kiện) + "Xóa tất cả" + **count** (`total`) khi đang filter.
3. **Chặn request chồng:** `filterLoading` disable Áp dụng/Làm thêm/RefreshControl; mở rộng busy-guard hiện có; chỉ 1 request in-flight.
4. **Dedupe (discharge follow-up :540):** `genRef` tăng ở MỌI trigger (initial/refresh/load-more/apply/reset); chụp `gen` trước await; sau await chỉ setState khi `gen === genRef.current` (ignore-stale, không AbortController). Stale response KHÔNG setState items/total nhưng vẫn reset cờ busy/spinner của chính request đó trong `finally`. Giữ hành vi F011/F012 (moreError/refreshError giữ list) cho request non-stale.
5. **Client validation mirror server:** `dateFrom > dateTo` → chặn gửi, field error trong sheet; sai format bị composer chặn.
6. **Empty-filtered ≠ empty-board:** ≥1 filter active + `data.length===0` → copy riêng + nút clear; empty-board giữ copy cũ. 403 out-of-scope giờ reachable → dùng nhánh 403 đã chuẩn bị (B10) + retry.
7. Client: mở `FetchJobBoardParams` (+6 filter, query builder lặp `workTypeId`/`areaId`), hàm mới `fetchJobBoardFilterOptions`, error mapping giữ F006.

### D6 — Discharge + bounded decisions trong docs
ENDPOINTS §20 thêm mục con **"§20.1 Filters — JOB-SRS-006 (#46)"**: bảng params + lỗi + BD mới: BD10 (contract 6 param + date=planned instant-overlap + NULL-planned loại + areaId/workTypeId lặp), BD11 (skill=mine trade-match, mirror org :43, bridge eligibility #48/#49), BD12 (403-generic out-of-scope — discharge ghi chú BD2), BD13 (filter-options scope-derived), BD14 (BD4 unknown-key + `''`=absent giữ nguyên), BD15 (**BD9 :536 DISCHARGED by #46**), BD16 (**follow-up :540 DISCHARGED — generation dedupe `JobBoardScreen`**), BD17 (**full-text search TỪ CHỐI có biên** — SRS chỉ liệt kê 5 chiều cấu trúc, BD2 cấm `search`, không AC nào đòi; nếu cần sẽ là slice riêng), BD18 (audit/notification không có — BD8 parity, AC7 delta=0). Đồng thời: sửa doc-comment controller :26-39 và use-case :50-51 bỏ câu "KHÔNG nhận filter param"; cập nhật API.md:322 + thêm row filter-options; MOBILE.md:60 thay câu deviation; **check NETCODE.md (expected no-op — auth/error shape không đổi, ghi 1 dòng xác nhận)**.

---

## 4. Task DAG (2 lane, thứ tự thực thi)

| # | Task | Files in scope | Acceptance | Builds on |
|---|---|---|---|---|
| **T0** | Persist plan + registry | tạo `docs/plans-job-srs-006.md` (plan này), cập nhật registry "Current plans" trong `PLANS.md`; check `docs/README.md` linkage | Plan checked-in trước khi implement (M3 review 2) | — |
| **T1** | Policy pure | mới `src/api/src/modules/job/domain/service/job-board-filter.policy.ts` + `.spec.ts`: parse `dateFrom/dateTo` (offset bắt buộc — **export `ISO_OFFSET_SUFFIX_RE`/`assertIsoOffset` từ `work-order-job-board.policy.ts:98` hoặc duplicate có comment**, m1), normalize uuid lặp, skill enum, from≤to, `''`=absent; error class `JobBoardFilterError(field[], message)` (m5) | Unit 100% ma trận: Z/±hh:mm/±hhmm/naive/number/`''`; uuid sai từng phần tử; skill lạ; from>to | B5 |
| **T2** | Port + adapter | `work-order-repository.port.ts` mở `JobBoardFilter` + method optional `findActiveTradeIdsByUserId?(userId): Promise<string[]>`; `pg-work-order.repository.ts` `searchJobBoard` :239-275 AND-compose 5 predicate (D2) + method mới đọc `resource_trades` (`resource_type='USER' AND is_active=true`, mirror org :43) | PG integration: từng predicate riêng + kết hợp + COUNT đúng + scope giữ; absent filter = hành vi #45 nguyên vẹn | T1, B3-B4 |
| **T3** | Use case + use case mới | `search-job-board.use-case.ts`: validate/truyền filter; `skill=mine` → resolve trades → rỗng early-return empty (giữ `now` :81); `projectId` ∉ scope non-ADMIN → `ForbiddenException` generic; method absent → **fail-closed 500** (mirror F002, m9). Mới `GetJobBoardFilterOptionsUseCase` (scope-first + 4 DISTINCT + enrich names) | Unit: scope tree, 403 out-of-scope, skill-empty, now-capture, fail-closed | T2 |
| **T4** | Controller + route | `job-board.controller.ts`: parse 6 param (`@Query` từng param — BD4 giữ; repeatable `areaId`/`workTypeId` qua raw query object), gọi policy → `filterError` multi-field; route `@Get('filter-options')`; sửa doc-comment :26-39 | Controller spec: 400 fieldErrors từng field + from>to 2-field; 403; unknown key ignore; `''` = absent; filter-options shape + no-store | T1-T3 |
| **T5** | In-memory e2e spec | mới `src/api/test/job-board-filters.e2e.spec.ts` (clone fixture từ `job-board-list.e2e.spec.ts` — const thật là `P2`, không có `P2_OUTSIDE`, m4): ma trận F1a-F1g, F2a-F2d, F3-F7 (§5); header trung thực "IN-MEMORY, không phải real-DB proof" | All green; case #45 cũ không fail | T4 |
| **T6** | Docs backend + mobile | ENDPOINTS §20.1 (D6: BD10-BD18, discharge BD9 + :540), API.md :322 + row filter-options, MOBILE.md :60, NETCODE.md check-line | BD9/:540 có chữ "DISCHARGED by #46"; không đụng §19 | T4 (contract chốt) |
| **M1** | Client | `src/mobile/src/api/client.ts`: `FetchJobBoardParams` + query builder lặp param + `fetchJobBoardFilterOptions` + fieldErrors | Typecheck; unit client (query string, error map) | T6 |
| **M2** | Store + Sheet | mới `job-board-filter-state.ts` + `JobBoardFilterSheet.tsx` + tests: sections D5.2, client date validation, reset/apply, accessibilityLabel | Sheet tests: multi-chips, single project, toggle skill, invalid date chặn, reset | M1 |
| **M3** | Screen | `JobBoardScreen.tsx`: mount-init từ store + ghi store, chips row + count + empty-filtered + 403 generic + gen-dedupe mọi trigger + filterLoading busy-guard; **giữ mọi test case cũ pass (vẫn không claim CTA)** | Screen tests mở rộng; không regression #45 | M2 |
| **M4** | Docker rebuild (TÁCH RIÊNG, trước evidence — M1 review 2) | `docker compose -f infra/docker/compose.yaml build api mobile && up -d`; health; smoke curl 3 case (§7) | api :3000 / mobile :19006 healthy; smoke đúng từ image mới | T6, M3 |
| **E1** | Evidence driver | mới `docs/evidence/job-srs-006/`: `JOB-SRS-006-E2E.md` + `e2e-driver-job-srs-006.cjs` (fork driver-005, GIỮ seed UUIDs :80-86, planned dates tính theo run-time now — m8, cleanup id-based `rest=0`, shots label `-R` mới): **provision trade cho ba.nguyen bằng INSERT `resource_trades` by-id qua psql + cleanup by-id, ghi rõ là simulated data provisioning** (M2 review 2 — worker không có trade sẵn); cases F1-F10; vars `e2e-vars-<label>.json` + `run-<label>.stdout.log` | **≥2 run ALL-PASS liên tiếp**; psql rest=0; seeded demo rows nguyên vẹn | M4 |
| **E2** | Đóng issue | Lead tick 8 checkbox + DoD, link PR backend + PR mobile/integration, comment tóm tắt + link evidence, đóng #46 | Chỉ đóng khi backend + mobile + evidence đủ | E1 |

DAG: T0 → T1→T2→T3→T4→T5→T6 (lane backend+docs); M1→M2→M3 (lane mobile, bắt đầu sau T6 — merge B trước M theo WORK-ROUTING:53); M4 → E1 → E2 tuần tự.

---

## 5. Test mapping 1-1 với 8 checkbox

| AC | File | Case | Assertion chính |
|---|---|---|---|
| AC1 | `job-board-filters.e2e.spec.ts` | F1a date in/out (planned overlap), F1b projectId, F1c areaId đơn+lặp, F1d workTypeId đơn+lặp, F1e skill=mine khớp/không khớp, F1f kết hợp cả 5, F1g clear = tập #45 | 200; `data`/`total` đúng tập; kết hợp = giao các tập đơn; `FilterSheet.test.tsx` apply/remove-từng-chip/reset |
| AC2 | cùng spec | F2a naive ISO → 400 `{dateFrom}` + message offset; F2b from>to → 400 2 field; F2c projectId PRB với worker PRA → 403 generic; F2d skill=mine không-trade/inactive → 200 empty; F2e id-đúng-format-không-tồn-tại → 200 empty | 400/403/200 đúng shape; mobile `client-invalid-date`: không gọi `fetchJobBoard` khi from>to |
| AC3 | cùng spec + mobile | F3 seed assignment (claim-sim psql) → list lại có filter → item biến, total giảm; mobile `stale-response-ignored` (resp 1 chậm filter cũ + resp 2 nhanh filter mới → chỉ render resp 2) | Response mới không chứa item claimed; stale không setState |
| AC4 | cùng spec + controller spec + client test | F4 page trên filtered WHERE (total COUNT đúng, page 2 ≠ page 1, NULL-planned loại khi có date filter); unknown key `foo=1` ignore; `workTypeId=a&workTypeId=b` parse đúng; client URL chứa param lặp | total/page/envelope/`no-store` đúng |
| AC5 | cùng spec + driver F5 | F5 anon 401 / membership rỗng 200-empty (cả list lẫn filter-options) / worker PRA không thấy PRB dù gửi mọi filter / ADMIN thấy tất cả / không param mở scope | Không case nào lộ row ngoài scope |
| AC6 | policy spec + controller spec + mobile | mọi 400 `fieldErrors` keyed + message tiếng Việt actionable; mobile `field-error-render` + `empty-filtered-distinct` | Shape + text đúng; UI render per-field |
| AC7 | cùng spec + mobile | F7 N GET (list + filter-options) → delta audit/notification = 0; mobile `no-overlapping-requests` (dedupe + busy-guard) | Delta 0; không request chồng |
| AC8 | `docs/evidence/job-srs-006/e2e-driver-job-srs-006.cjs` | F1 từng filter qua UI, F2 kết hợp, F3 reset, F4 date invalid chặn UI, F5 403 sửa-URL, F6 skill=mine đúng tập (sau provision trade) / ADMIN→empty, F7 board đóng giữa chừng → item biến với filter bật, F8 pagination stable, F9 giữ filter khi back in-app, F10 empty-filtered ≠ lỗi | ALL-PASS ×2, shots, API+DB thật |

---

## 6. Dependencies, constraints, risks

**Dependencies:** #45 (endpoint + screen + client hiện hữu) là nền — mọi thay đổi additive, absent-filter = hành vi #45 nguyên vẹn. Contract fan-out theo WORK-ROUTING: API chốt (T4) → docs (T6) → mobile (M1-M3). Docker rebuild bắt buộc **trước** evidence (M4 → E1). Claim (#47) chỉ mô phỏng bằng psql trong driver, ghi nhãn trung thực.

**Constraints giữ nguyên:** không nút claim; không đổi §19/#44; không migration; không full-text search (BD17); BD4 unknown-key + `''`=absent; BD8 read-only; seed UUIDs driver-005 :80-86 giữ nguyên, cleanup by id.

**Risks (mỗi mục có evidence):**
- **R1 — Provision trade trong driver đụng bảng org-owned:** INSERT `resource_trades` by-id + cleanup by-id, không đụng row seeded (B14, cleanup pattern driver-005 :297-308). Nếu thấy rủi ro, fallback: đổi sang worker khác có trade + membership — phải verify password/membership trước (chưa có evidence → giữ phương án INSERT).
- **R2 — filter memory:** store module-level giải quyết remount; vẫn verify thực nghiệm qua driver F9 (dry-run sớm ở E1).
- **R3 — ADMIN + `skill=mine` → empty** (admin không hồ sơ trade): hợp lệ conservative, ghi BD11 để không bị coi là bug.
- **R4 — WO `required_trade_id IS NULL` bị loại khi skill=mine:** chấp nhận có chủ đích, ghi BD11 (B6: cột nullable).
- **R5 — Regression dedupe trên #45:** giữ toàn bộ case test cũ + thêm stale case; moreError/refreshError chỉ cho request non-stale (B10).
- **R6 — DISTINCT filter-options scale:** bounded bởi scope+availability; index `ix_work_orders_job_board` có sẵn; ghi residual BD13.
- **R7 — `effective_to` của `resource_trades`:** job chỉ match `is_active=true` mirror org :43; drift với eligibility #49 đã ghi bridge BD11 — nếu reviewer #49 đòi effective-window, đổi ở slice đó, không mở rộng ở đây.

**Unresolved questions (không blocker):** (1) row phân quyền `GET /projects` cho WORKER chưa verify (B8) — design dùng `filter-options` làm nguồn picker duy nhất nên không phụ thuộc; (2) lý do owner reopen issue #46 sau lần merge cũ không ghi trong issue — Lead xác nhận với owner rằng biên scope này là mong muốn (plan author fresh từ tree 13f528b, không khôi phục commit).

---

## 7. Verification commands + expected results

```bash
# Backend (chạy TRONG src/api — plans-job-srs-005.md:64; npm run là fallback)
cd src/api && pnpm --config.verify-deps-before-run=false typecheck   # exit 0
cd src/api && pnpm --config.verify-deps-before-run=false lint        # 0 lỗi
cd src/api && pnpm --config.verify-deps-before-run=false test        # suites cũ + T1-T5 mới, all green
cd src/api && pnpm --config.verify-deps-before-run=false test -- job-board-filters.e2e.spec.ts   # IN-MEMORY green
cd src/api && pnpm --config.verify-deps-before-run=false test -- job-board-list.e2e.spec.ts      # regression #45 green

# Mobile (cùng pattern flag — F15 áp cả src/mobile)
cd src/mobile && pnpm --config.verify-deps-before-run=false typecheck && \
cd src/mobile && pnpm --config.verify-deps-before-run=false lint && \
cd src/mobile && pnpm --config.verify-deps-before-run=false test     # 0 lỗi; case cũ #45 + FilterSheet/Screen/store mới green; không test nào assert claim CTA

# Docker rebuild + health (trước evidence)
docker compose -f infra/docker/compose.yaml build api mobile && docker compose -f infra/docker/compose.yaml up -d
docker compose -f infra/docker/compose.yaml ps                       # api :3000, mobile :19006 Up (healthy)

# Smoke bằng JWT thật qua image mới:
#  GET /api/v1/job-board?workTypeId=<WT_BTCT>&skill=mine&dateFrom=<iso+offset>  → 200 filtered
#  GET /api/v1/job-board?projectId=<PRB>  (JWT worker PRA)                      → 403
#  GET /api/v1/job-board?dateFrom=2026-01-01T00:00:00                           → 400 fieldErrors {dateFrom}
#  GET /api/v1/job-board/filter-options (JWT worker PRA)                        → 200 4 mảng (PRA-scope)

# Evidence — ≥2 run ALL-PASS liên tiếp, label mới không đè history:
cd docs/evidence/job-srs-006
PLAYWRIGHT_CORE_PATH=<path>/playwright-core node e2e-driver-job-srs-006.cjs R1 2>&1 | tee run-R1.stdout.log
PLAYWRIGHT_CORE_PATH=<path>/playwright-core node e2e-driver-job-srs-006.cjs R2 2>&1 | tee run-R2.stdout.log
#   Expected: F1-F10 PASS mỗi run; psql cleanup rest=0; seeded demo rows nguyên vẹn

# Docs linkage
grep -n "DISCHARG" docs/architecture/ENDPOINTS.md | grep -i "bd9\|dedupe"   # BD9 :536 + follow-up :540 discharged by #46
grep -n "JOB_BOARD_DATE_RANGE_INVALID" docs/architecture/ENDPOINTS.md       # BD10 contract
grep -n "deviation BD9" docs/architecture/MOBILE.md                          # empty (đã xóa)
```

**Bước tiếp theo cho Lead:** hand T1→T6 (backend+docs lane) và M1→M3 (mobile lane, sau T6) — tối đa 2 agent/lần orchestrate; sau đó M4 → E1 → E2; một vòng review toàn change surface trước khi đóng issue #46.

