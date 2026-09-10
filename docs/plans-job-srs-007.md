# orchestrate run r-mtuvbvfu-c2qcs6

- mode: fanout | agent: session-53388f77-905b-46ab-9594-7d3017dea139 | provider: spawn
- concurrency: 6 | durationMs: 1210603 | aborted: false
- startedAt: 2026-09-10T01:48:25.194Z | finishedAt: 2026-09-10T02:08:35.797Z

## Plan JOB-SRS-007 #47 [via planner] [completed] {xkiro/z-ai/glm-5.3-flash}

Mọi dữ kiện chịu tải đã được kiểm chứng trực tiếp. Dưới đây là kế hoạch cuối cùng sau tổng hợp (Stage 3).

---

# KẾ HOẠCH TRIỂN KHAI CUỐI — Issue #47 [JOB-SRS-007] Must — Xem chi tiết công việc còn trống

**Lưu ý minh bạch về quy trình:** 2 worker lập kế hoạch chạy đủ (Plan 1, Plan 2). 2 worker review Stage 2 bị lỗi ở phía tôi (placeholder không được dán nội dung plan → cả hai từ chối review) và tôi đã dùng hết quota đúng 4 lần gọi `subagent_fork`, nên không gọi lại được. Cross-review đã do tôi tự thực hiện trên cả hai plan, đối chiếu trực tiếp với code; 2 worker review đã trả về bộ ground-truth đã kiểm chứng (dùng dưới đây) và tôi đã tự xác minh lại 3 dữ kiện then chốt bằng lệnh đọc (migration 0007, route order, migration 0011).

## 1. Mục tiêu và tiêu chí nghiệm thu

**Mục tiêu:** Worker mở detail một công việc còn trống từ Job Board trên Mobile, thấy đủ thông tin hiện hành để quyết định tự nhận việc. Slice dọc: backend → docs → mobile UI → test → evidence → docker/registry.

**AC (từ issue, đã đọc `gh issue view 47` đầy đủ):**
- Worker mở detail từ Job Board; API re-check visibility + trả phiên bản hiện hành (AC-1).
- Hiển thị: thời gian + cửa sổ nhận việc, địa điểm, project/area/type, mô tả/hướng dẫn, skill/eligibility requirement, checklist liên quan, dữ liệu cần chuẩn bị, availability/state (AC-2).
- CTA "Nhận việc" khi available; HÀNH ĐỘNG claim là #48 — CTA render theo state (AC-3).
- State đổi → UI thông báo + tải lại (re-fetch), không gửi command cũ (AC-4).
- Chỉ hiện detail trong project scope; không lộ PII không cần (AC-5).
- Checklist/type reference lỗi → báo configuration issue, không hiển thị sai (AC-6).
- Permission mất → không render stale detail (AC-7).
- 8 checkbox test trong issue map 1-1 (mục 3 dưới).

**Non-goals:** hành động claim (#48), eligibility check (#49), one-winner (#50), web side, mọi thay đổi contract open/close/filters của #44–#46, không tham chiếu stash/reflog trước `61ed2be` (WIP #51).

## 2. Dữ kiện repo hiện tại (đã xác minh, có evidence)

| # | Dữ kiện | Evidence |
|---|---|---|
| F1 | `GET /api/v1/work-orders/:id` (#41): non-ADMIN → `findById` rồi `ProjectScopeService.assertProjectMemberScope` — mọi ACTIVE member kể cả WORKER đọc được; non-member/id-missing → 403 generic (anti-leak) | `src/api/src/modules/job/application/use-case/get-work-order.use-case.ts:42-56` |
| F2 | Response detail hiện có `createdBy` + `jobBoard{open, openFrom, openUntil, hasActiveAssignment, state}` với `state = deriveJobBoardState ∈ ASSIGNED\|EXPIRED\|SCHEDULED\|AVAILABLE\|CLOSED` | `work-order.mapper.ts:45,53-67`; `work-order-job-board.policy.ts:21` |
| F3 | List job board (#45/#46) chủ đích OMIT `createdBy` — tiền lệ PII BD6; port có enricher optional `findAreaRefs?/findTradeRefs?/findProjectRefs/findWorkTypeNameById` | `job-board.mapper.ts:8-13`; `docs/architecture/ENDPOINTS.md:512,533`; `work-order-repository.port.ts:127-161` |
| F4 | BD3 (#45): worker board và coordinator là consumer/shape khác → route riêng là tiền lệ đã duyệt | `ENDPOINTS.md:516` |
| F5 | `work_orders` có `description, instructions, planned_start_at/end_at, due_at, job_board_open/from/until, planned_headcount, required_trade_id, work_type_id, area_id, version`; `custom_fields` jsonb thêm bởi migration 0011 | `0001_dbd_v2_1_baseline.sql:217-270`; `0011_wo_custom_fields.sql:24` |
| F6 | `work_types` có `required_fields jsonb NOT NULL DEFAULT '[]'` (danh sách dữ liệu bắt buộc) + `work_type_group` + `config_version` | `0007_prj_srs004_work_types.sql:21-23` (tự xác minh) |
| F7 | `checklist_templates` (`work_type_id` nullable FK, `purpose ∈ PRE_START\|INSPECTION\|WORK_DONE`, `status ∈ DRAFT\|ACTIVE\|INACTIVE`, unique `(code,version)`) + `checklist_template_items` (title/description/answer_type/is_required/is_blocking/requires_photo/min/max); index `(work_type_id, purpose, status)` | `0001_dbd_v2_1_baseline.sql:415-456,938-941` |
| F8 | KHÔNG có checklist module — `src/api/src/modules` chỉ có iam/job/org/prj; cần read path mới | liệt kê thư mục (tự xác minh) |
| F9 | `JobBoardController` hiện có `@Get('filter-options')` :70 và `@Get()` :80 — `@Get(':id')` mới phải khai báo SAU cả hai tránh nuốt route | `job-board.controller.ts:62,70,80` (tự xác minh) |
| F10 | Mobile: `app/job-board/[id].tsx` restore session → `WorkOrderPreviewScreen` (#45, mỏng: fields + banner khi state ≠ AVAILABLE, có loading/401/404/error/null, KHÔNG 403 branch, KHÔNG claim); client `fetchWorkOrderPreview` → `GET /api/v1/work-orders/:id` | `WorkOrderPreviewScreen.tsx:24-29,52-129`; `client.ts:589-601` |
| F11 | Seed demo: `checklist_templates` 5 dòng (ACTIVE per-work-type + 1 generic NULL-work-type + 1 DRAFT), `checklist_template_items`, `work_orders` đa trạng thái | `docs/evidence/demo-data/seed-realistic-operations.sql:243-262` |
| F12 | Pattern evidence/verify: driver `.cjs` + vars + run logs + shots trong `docs/evidence/job-srs-00X/`; plan registry `docs/plans-job-srs-006.md` + `PLANS.md:37-44`; verify `pnpm --config.verify-deps-before-run=false` trong `src/api`/`src/mobile`; docker rebuild trước evidence | `docs/plans-job-srs-006.md:135,181-205` |
| F13 | Optimistic lock convention: `expectedVersion` → 409 `WORK_ORDER_CONFLICT` (#43/#44) — #48 sẽ dùng | `work-orders.controller.ts:97-99` |

## 3. Thiết kế (phần (1) của brief)

### 3.1 API — endpoint MỚI `GET /api/v1/job-board/:id` (theo Plan 1, BD-C)

**Quyết định:** thêm `@Get(':id')` vào `JobBoardController` (khai báo SAU `filter-options` và `GET ''` — F9), use case mới `job-board-detail.use-case.ts`, mapper mới `toJobBoardDetailResponse`.

**Lý do loại phương án của Plan 2** (`?include=detail` trên `GET /work-orders/:id`): đó là contract fork có điều kiện trên endpoint dùng chung web #41–#43 — omission `createdBy` theo query param là thay đổi shape có điều kiện của contract đã document (`ENDPOINTS.md` §17), rơi đúng ranh giới cấm; đồng thời nhân đôi ma trận test permission. BD3 (F4) đã duyệt nguyên tắc consumer/shape khác → route riêng; #45 BD7 đã defer quyết định detail chính là slice này. Endpoint mới là additive-only, không đụng contract nào hiện hữu.

**Response shape 200 (`Cache-Control: no-store`, JWT):**
```jsonc
{
  "id","code","title","status","priority",
  "projectId","projectName",          // findProjectRefs
  "areaId","areaName",                // findAreaRefs
  "workTypeId","workTypeName","workTypeDescription","workTypeRequiredFields", // F6 — dữ liệu cần chuẩn bị
  "requiredTradeId","requiredTradeName", // findTradeRefs — skill requirement
  "plannedStartAt","plannedEndAt","dueAt","plannedHeadcount",
  "jobBoard": { "open","openFrom","openUntil","state" },   // deriveJobBoardState, không hasActiveAssignment
  "description","instructions",
  "customFields": {},                 // dữ liệu chuẩn bị do coordinator nhập (0011:24)
  "checklists": [ { "id","code","name","purpose","version","description",
    "items": [ { "sequenceNo","title","description","answerType","isRequired","isBlocking","requiresPhoto","minValue","maxValue" } ] } ],
  "version","createdAt","updatedAt"
}
```
**Chủ đích OMIT:** `createdBy` (PII — kéo dài BD6 sang detail; F3), `requestKey` (parity `work-order.mapper.ts:18-21`), boolean `hasActiveAssignment` (state đã encode — parity list).

### 3.2 Authz read rule
Giữ nguyên rule #41 (F1): JwtAuthGuard → use case: non-ADMIN `findById` (null → 403 generic) → `assertProjectMemberScope` → MỚI fetch related data (issue: "Authorization trước fetch toàn bộ related data"). ADMIN bypass qua scope service (missing → 404). WORKER ACTIVE member đã đủ quyền đọc — **không cần RBAC grant mới**. Endpoint mới chạy đúng predicate này, không yếu hơn.

### 3.3 State-change semantics
Không ETag/If-Match (state phụ thuộc clock — `EXPIRED/SCHEDULED` derive tại read-time với `now` capture, version không chứng minh được freshness; F2). `Cache-Control: no-store`. Mobile: fetch lúc mount + focus (`useFocusEffect`) + pull-refresh; giữ data cũ khi re-fetch; nếu `state`/`version` đổi so với lần render CTA → banner "Trạng thái công việc đã thay đổi" + re-render CTA. 403 trên bất kỳ re-fetch → **xóa detail, render forbidden screen** (AC-7; screen hiện thiếu branch 403 — F10). `version` trả về để #48 dùng `expectedVersion` (F13).

### 3.4 CTA theo state matrix

| state | CTA | Banner |
|---|---|---|
| `AVAILABLE` | Nút chính "Nhận việc", enabled. **onPress = re-fetch re-check** (tái dùng `load()`); nếu vẫn AVAILABLE → hint nội bộ "Chức năng nhận việc sẽ khả dụng ở bản cập nhật tiếp theo (#48)" — không có network command mới, không route ảo (không vi phạm "không dùng màn hình tạm") | — |
| `SCHEDULED` | ẩn | "Chưa tới thời điểm nhận việc — mở lúc {openFrom}" |
| `EXPIRED` | ẩn | "Cửa sổ nhận việc đã hết — làm mới hoặc liên hệ điều phối" |
| `ASSIGNED` | ẩn | "Công việc đã có người nhận" |
| `CLOSED` | ẩn | "Công việc hiện không nhận" |
| `jobBoard` vắng (defensive) | ẩn | fail-closed coi như CLOSED |

CTA chỉ derive từ `state` server — hint, không phải security (issue §1).

### 3.5 Configuration-error path
- **Config error thực sự (defensive):** `workTypeId` không resolve được work type (`findWorkTypeNameById` → null) → **409 `{ code: "JOB_BOARD_CONFIG_INVALID", message actionable }`**, withheld toàn bộ detail (AC-6 "không hiển thị sai"). Lưu ý FK `work_type_id NOT NULL` (F5) khiến này gần bất khả ở DB — đây là nhánh defensive/wiring.
- **KHÔNG phải config error:** checklist resolve về 0 template → empty state "Không có checklist liên quan được cấu hình" (work type hợp lệ có thể không có checklist; DRAFT/INACTIVE = chưa publish, không phải lỗi); area/trade inactive → vẫn hiện tên (refs query không lọc `is_active`, parity port F3). Checklist items không thể dangle (FK, F7).
- Mobile: 409 → banner config-issue riêng + "Về bảng việc", không toast generic.

**Bounded decisions chốt:**
- **BD-1 (endpoint):** route mới `GET /api/v1/job-board/:id` — loại `?include=detail` (3.1 trên).
- **BD-2 (PII):** OMIT `createdBy` trên worker detail; không đụng `GET /work-orders/:id`.
- **BD-3 (checklist rule):** `status='ACTIVE' AND (work_type_id = WO.workTypeId OR work_type_id IS NULL)`, **mọi purpose** (PRE_START/INSPECTION/WORK_DONE — "checklist liên quan" nghĩa đầy đủ, worker cần biết cả nghiệm thu trước khi nhận); nhiều ACTIVE version cùng `code` → lấy `version` cao nhất (unique `(code,version)` F7); items batch 1 query `= ANY($1)` `ORDER BY template_id, sequence_no`. Phương án loại: PRE_START-only (hẹp hơn SRS), tính empty là CONFIG_ERROR (Plan 2 — mâu thuẫn chữ "reference lỗi").
- **BD-4 (CTA #48 boundary):** enabled khi AVAILABLE + re-check onPress + hint #48; loại ẩn CTA (mất "CTA Nhận việc nếu available"), loại disabled (lẫn unavailable), loại stub route.
- **BD-5 (state):** re-fetch, không ETag (3.3).
- **BD-6 (screen):** nâng cấp `WorkOrderPreviewScreen.tsx` tại chỗ (giữ tên file/export, 1 consumer duy nhất `[id].tsx:5,41`, giữ state machine #45 làm regression base).
- **BD-7 (port):** 3 optional method mới trên `WorkOrderRepositoryPort` (`findWorkTypeDetailById?`, `findActiveChecklistTemplatesByWorkTypeId?`, `findChecklistItemsByTemplateIds?`) — caller fail-closed 500 khi thiếu (mirror F001 `get-work-order.use-case.ts:77-83`); không tạo checklist module (F8).

## 4. Task DAG có thứ tự (phần (2) của brief)

```
T1 (backend domain/port/adapter) → T2 (use case/controller/mapper) → T3 (docs contract)
                                                        ├→ T4 (api tests) ─┐
                                                        └→ T5 (mobile client+UI+tests) ─┤
T3 → T5;  T4 + T5 → T6 (docker + evidence real-DB) → T7 (PLANS registry + đóng issue)
```

| Task | What | Files in scope | AC | Build on |
|---|---|---|---|---|
| **T1** | Policy thuần `job-board-detail.policy.ts` (rule BD-3, classify config error, không I/O) + 3 optional port methods + PG adapter | `src/api/src/modules/job/domain/service/job-board-detail.policy.ts` (mới), `domain/repository/work-order-repository.port.ts`, `infrastructure/database/pg-work-order.repository.ts` | Policy pure, unit-test được; query khớp DDL F7; batch không N+1 | Batching `findAreaRefs/findTradeRefs`; fail-closed F001 |
| **T2** | Use case (scope-first → enrich song song: refs + work type detail F6 + checklists + `hasActiveAssignmentByWorkOrderIds` + derive state với 1 `now` capture) + `@Get(':id')` khai báo sau `:70,:80` + `toJobBoardDetailResponse` | `application/use-case/job-board-detail.use-case.ts` (mới), `api/rest/controller/job-board.controller.ts`, `presentation/mapper/job-board.mapper.ts` | Worker ACTIVE member 200 đủ shape; non-member 403 generic; ADMIN missing 404; 409 config; response không có `createdBy` | `GetWorkOrderUseCase` scope block; `SearchJobBoardUseCase` now-capture + fail-closed |
| **T3** | Docs contract: `ENDPOINTS.md` §20.2 mới (route, shape, error table, CTA matrix, BD-1..7, note cho #48 "claim command phải re-read detail"); `API.md`, `MOBILE.md`, `NETCODE.md` check-line | `docs/architecture/ENDPOINTS.md,API.md,MOBILE.md,NETCODE.md` | §20.2 cross-ref BD3/BD6/BD7 discharge; ghi rõ §17 `GET /work-orders/:id` KHÔNG đổi | Pattern §20/§20.1 của #45/#46 |
| **T4** | Unit policy + unit use case (scope matrix, empty checklists, 409, fail-closed, now-capture) + mapper spec (shape + assert OMIT `createdBy`) + controller spec (forward, 400 UUID sai, no-store, `/filter-options` vẫn 200 — R1) + PG spec 2 query mới (seed ACTIVE per-type + generic NULL + DRAFT — F11) + e2e IN-MEMORY `job-board-detail.e2e.spec.ts` (permission matrix, state đổi giữa 2 GET, audit delta 0) | `.../job-board-detail.policy.spec.ts` (mới), `job-board-detail.use-case.spec.ts` (mới), `job-board.mapper.spec.ts`, `job-board.controller.spec.ts`, `pg-work-order-job-board.repository.spec.ts`, `src/api/test/job-board-detail.e2e.spec.ts` (mới) | Toàn bộ xanh; regression `job-board-list/filters.e2e.spec.ts` + `work-orders.e2e.spec.ts` xanh | Pattern `job-board-list.e2e.spec.ts`, `work-order-job-board.e2e.spec.ts` |
| **T5** | Mobile: client `fetchJobBoardDetail` (type `JobBoardDetail`, error map 401/403/404/409 phân biệt — 403 phải thành permission state, không generic) + nâng cấp screen tại chỗ: sections Thời gian/cửa sổ · Địa điểm · Project/Loại/Yêu cầu (requiredTradeName + requiredFields) · Mô tả · Hướng dẫn · Chuẩn bị (requiredFields ↔ customFields) · Checklist (badge required/blocking/photo, purpose label, empty state) · banner theo matrix 3.4 · banner state-changed · branch 403 xóa detail · 409 config banner · refresh + focus re-fetch; giữ route `[id].tsx` + test mở rộng | `src/mobile/src/api/client.ts` (+ `client.test.ts`/`job-board.test.ts`), `src/mobile/src/features/job-board/WorkOrderPreviewScreen.tsx`, `WorkOrderPreviewScreen.test.tsx` | Không hard-code data; CTA chỉ theo `state`; 403 không render stale; mobile typecheck/lint/test xanh | State machine #45 (`:52-129`), `Field/formatDateTime`, dedupe guard #46 |
| **T6** | Docker rebuild api+mobile → healthy; driver real-DB `e2e-driver-job-srs-007.cjs` (login worker ba.nguyen, board → "Xem chi tiết", assert sections khớp API, WO non-available, deep-link out-of-scope id → forbidden, psql chèn assignment giữa 2 quan sát → state đổi) + vars + ≥2 run ALL-PASS + shots suffix `-S7R*` + `JOB-SRS-007-E2E.md` + psql asserts (state/version, checklist rows, audit delta 0) | `docs/evidence/job-srs-007/*` (mới) | ≥2 run ALL-PASS; logs force-added (gitignore exception như #46); docker ps healthy :3000/:19006 | Driver #46, seed F11, `PLANS.md:43` |
| **T7** | `docs/plans-job-srs-007.md` (plan + BD + AC map) + entry `PLANS.md` + comment issue #47 link PR; chỉ đóng issue khi backend + UI + evidence đủ (DoD) | `docs/plans-job-srs-007.md`, `PLANS.md` | Registry đủ trường scope/proof/status như `PLANS.md:37-44` | `docs/plans-job-srs-006.md` |

## 5. Test mapping 1-1 với 8 checkbox (phần (3) của brief)

| # | Checkbox issue | Test | Assert chính |
|---|---|---|---|
| 1 | Detail đúng field và scope | `job-board.mapper.spec.ts`, `job-board-detail.use-case.spec.ts`, `job-board-detail.e2e.spec.ts`, driver S1 | Đủ mọi section 3.1; mọi field thuộc project của WO; predicate scope identical list path |
| 2 | State change trước claim cập nhật CTA | e2e (chèn assignment giữa 2 GET → AVAILABLE→ASSIGNED) + `WorkOrderPreviewScreen.test.tsx` | GET-2 state ASSIGNED; UI banner + CTA biến mất + thông báo; không có command nào gửi |
| 3 | Related data ngoài scope bị loại | policy spec + use case spec | Checklist chỉ theo `workTypeId` WO (+generic NULL), chỉ ACTIVE; worker của project khác → 403, không emit related data |
| 4 | Loading/error/retry + deep-link authorization | `WorkOrderPreviewScreen.test.tsx`, e2e, driver | Deep-link anon → login; foreign id → 403 forbidden (detail xóa); lỗi tạm → retry; loading/null states giữ từ #45 |
| 5 | Quyền: đúng role/scope pass; sai role/project/sửa ID không bypass | e2e matrix: worker-member 200; outsider 403 (kể cả id missing); ADMIN missing 404; anon 401; UUID sai 400 | Scope enforce server-side trong use case; route không có param scope client-supply |
| 6 | Validation + trạng thái không hợp lệ; lỗi nêu nguyên nhân | controller spec + e2e 409 `JOB_BOARD_CONFIG_INVALID` + mobile test banner từng state | 403/404/409 có message tiếng Việt nêu nguyên nhân + code; 400 là stock Nest (pipe-level, trước use-case — không message VI custom, residual F009); UI render banner phân biệt theo cause |
| 7 | Retry/double-submit khi có ghi dữ liệu | Slice READ-ONLY — xử lý trung thực theo tiền lệ BD8 (#45): e2e assert audit/notification delta = 0 qua N GET + retry; mobile generation-guard không chồng request | Không tạo bản ghi nghiệp vụ/audit/notification nào; retry test thật của claim thuộc #48 (ghi chú trên issue + plan doc) |
| 8 | Integration/E2E UI dùng API thật | Driver `job-srs-007` real-DB ≥2 run + `JOB-SRS-007-E2E.md` | UI → API thật → PostgreSQL thật → UI (shots); state đổi sau biến động DB phản ánh trên re-fetch |

## 6. Dependencies và constraints

- **Thứ tự cứng:** T3 (contract) chốt trước T5 (mobile consumer) theo `WORK-ROUTING.md` §5 — contract change route từ API/Contract rồi fan-out. T6 cần T4+T5 xanh + docker rebuild. Không migration mới (mọi cột đã có: F5–F7).
- **Ranh giới:** không sửa `GET /api/v1/work-orders/:id`, `GET /api/v1/job-board` (list/filters), open/close — regression suite bắt buộc xanh; không đọc stash/reflog trước `61ed2be`; web không đụng.
- **Lane:** cross-workspace Contract lane — `src/api` owns contract, `src/mobile` consumer, docs owner `ENDPOINTS.md`/`API.md`/`MOBILE.md`/`NETCODE.md`.

## 7. Rủi ro và câu hỏi chưa giải (mỗi mục có evidence)

1. **Route-order regression (R1):** `@Get(':id')` khai báo trước `filter-options` sẽ nuốt route — evidence F9. Mitigation: khai báo sau cùng + controller spec assert `/filter-options` vẫn 200.
2. **Checklist resolution là product guess (BD-3):** có nên hiển thị checklist WORK_DONE trước khi nhận không — SRS chỉ nói "checklist liên quan". Đã chốt inclusive; nếu reviewer phản đối là đổi 1 dòng policy + spec, gọn trong T1.
3. **`customFields`/`requiredFields` jsonb free-form (R4):** do coordinator nhập, đã hiện với member trên web detail; rủi ro dữ liệu cá nhân nếu project lạm dụng — chấp nhận residual, ghi trong §20.2.
4. **Demo data window (R5):** seed có WO đa trạng thái (F11) nhưng window còn hạn cần psql provision trước driver (tiền lệ `JOB-SRS-006-E2E.md`).
5. **Focus-refetch double-fire (R6):** `useFocusEffect` + mount fetch có thể double — cần generation/busy-guard (tiền lệ #46), có test T5.
6. **PG-spec wiring cho 3 method mới:** file in-memory adapter dùng bởi e2e spec chưa định vị chính xác (unverified) — executor định vị khi implement; PG spec thật đã có pattern `pg-work-order-job-board.repository.spec.ts`.
7. **Unverified:** cách web #41 render `createdBy` (web out of scope, không cần trả lời vì không đụng shape cũ); định dạng check-line `NETCODE.md` chính xác — executor mirror #46.

## 8. Lệnh xác minh và kết quả kỳ vọng (phần (6) của brief)

```bash
cd src/api && pnpm --config.verify-deps-before-run=false typecheck && \
pnpm --config.verify-deps-before-run=false lint && \
pnpm --config.verify-deps-before-run=false test                 # xanh, gồm T4 + regression #41–#46
cd src/api && pnpm --config.verify-deps-before-run=false test -- job-board-detail.e2e.spec.ts
cd src/mobile && pnpm --config.verify-deps-before-run=false typecheck && \
pnpm --config.verify-deps-before-run=false lint && \
pnpm --config.verify-deps-before-run=false test                 # xanh, gồm screen detail + client
docker compose -f infra/docker/compose.yaml build api mobile && \
docker compose -f infra/docker/compose.yaml up -d && \
docker compose -f infra/docker/compose.yaml ps                  # api :3000, mobile :19006 Up (healthy)
node docs/evidence/job-srs-007/e2e-driver-job-srs-007.cjs R1    # ALL-PASS; lặp R2 → 2 run ALL-PASS
# curl smoke: GET /api/v1/job-board/<wo-id> với token worker-in-scope → 200 có checklists[], KHÔNG createdBy;
#             token worker ngoài project → 403; id sai UUID → 400
# psql asserts: audit_logs/notifications delta = 0 qua N GET; checklist seed 5/5 nguyên vẹn
```

**Tóm tắt tổng hợp Plan 1 vs Plan 2:** giữ của Plan 1 — endpoint mới (BD-1, tránh contract fork trên endpoint web dùng chung), 409 withhold toàn bộ khi type-ref lỗi, CTA hint-only mở rộng bằng re-check onPress (gộp ý hay của Plan 2), evolve screen tại chỗ; nhận của Plan 2 — `work_types.required_fields`/`config_version` (0007:21-23) vào response "dữ liệu cần chuẩn bị", pin "nhiều ACTIVE version cùng code → version cao nhất", branch defensive `jobBoard` vắng = CLOSED. Loại của Plan 2 — rule PRE_START-only và tính checklist-rỗng là CONFIG_ERROR (mâu thuẫn chữ "reference lỗi" của issue).

