# orchestrate run r-mttqbayf-sdgxa4

- mode: fanout | agent: session-53388f77-905b-46ab-9594-7d3017dea139 | provider: spawn
- concurrency: 6 | durationMs: 2326580 | aborted: false
- startedAt: 2026-09-09T06:40:14.391Z | finishedAt: 2026-09-09T07:19:00.971Z

## Plan JOB-SRS-004 #44 [via planner] [completed] {xkiro/z-ai/glm-5.3-flash}

Both reviews converge. Synthesizing the final plan now — resolving the close-semantics conflict with verified evidence (field locks are status-keyed: `work-order-update.policy.ts:67,100-105`, and the command-endpoint precedent is `@HttpCode(200)` at `work-types.controller.ts:205-206`).

---

# KẾ HOẠCH TRIỂN KHAI CUỐI CÙNG — Issue #44 [JOB-SRS-004] Mở và đóng Job Board

**Repo:** `/home/trung/Documents/2026/project/buildflow`, `main @ 5890524`, working tree sạch. Vertical slice: backend → contract docs → web UI → test → evidence → docker rebuild. **Ngoài phạm vi:** #45–#50 (list/search/detail Job Board cho worker, claim/eligibility/one-winner), mobile.

Quyết định tranh chấp đã chốt (Plan 1 vs Plan 2, dựa trên review):
- **Close đưa WO `OPEN` → `READY`** (không giữ OPEN): field-lock của #43 khóa theo **status** (`work-order-update.policy.ts:67` `FULL_EDIT_STATUSES=['DRAFT','READY']`, `:100-105` nhánh OPEN) — giữ OPEN means lịch/skill khóa mãi, mâu thuẫn J7 ("đổi phải qua đóng board trước", ENDPOINTS §17). SRS.md:281 chỉ liệt kê chuyển tiếp chính, không cấm OPEN→READY; publish-check vẫn pass vì READY publishable (`work-order-publish-check.policy.ts:96`).
- **Bỏ nhánh "refresh cửa sổ khi đang mở"** (Plan 1 R6 bị review bác F1/F2): open khi board đang mở → window trùng đúng instant → `200 alreadyOpen`; window khác → `409 JOB_BOARD_ALREADY_OPEN` kèm hướng dẫn "đóng trước khi mở lại". Hết hạn cửa sổ → Close rồi Open (UI hướng dẫn rõ).
- **Response luôn `200`** (`@HttpCode(200)`) — mirror command precedent `POST /work-types/:id/status` (`work-types.controller.ts:205-206`).
- **Bỏ enrichment `jobBoard` trên list** `GET /work-orders` (F5 — scope creep, chưa có consumer; defer #45). Chỉ `GET :id` trả `jobBoard`.

## 1. Thiết kế ngắn gọn

### 1.1. State transitions

```
                POST :id/job-board/open
  DRAFT ─────────────────────────────────► OPEN  (job_board_open=true, from/until set, version+1)
  READY ─────────────────────────────────► OPEN  (như trên)          ← state_history DRAFT/READY→OPEN
  OPEN, board=false (re-open) ───────────► OPEN  (bật flag + window mới, status giữ nguyên, KHÔNG state_history)

                POST :id/job-board/close
  OPEN, board=true ──────────────────────► READY (job_board_open=false, from/until GIỮ NGUYÊN làm lịch sử, version+1)
  OPEN + có assignment (tương lai #47) ──► chỉ tắt flag, status không đổi, assignment KHÔNG đụng (AC3)
  board=false (đã đóng) ─────────────────► 200 { alreadyClosed: true } — không tx, không audit

  Open bị chặn: terminal/ASSIGNED/IN_PROGRESS → 400 WORK_ORDER_STATUS_NOT_OPENABLE;
                thiếu điều kiện công bố → 400 WORK_ORDER_NOT_PUBLISHABLE (+unmet[]);
                có assignment PENDING/ACTIVE → 409 JOB_BOARD_HAS_ASSIGNEE;
                board đang mở → 200 alreadyOpen (window trùng) / 409 JOB_BOARD_ALREADY_OPEN (window khác)
```
Hết hạn cửa sổ: **computed at read time** (không cron) — badge `EXPIRED` derive từ `job_board_open=true && until != null && now > until`; WO hết hạn vẫn OPEN+flag=true, recover = Close → Open (ghi trong docs). Cửa sổ: DB CHECK chỉ `until >= from` (`0001:259-261`), API strict `until > from` + `until` phải tương lai (`mirror INVALID_SCHEDULE_RANGE`, policy:353). Timezone: client gửi ISO-8601 có offset → parse thành instant (`parsePlannedDateTime`, `work-order.policy.ts:95`) → lưu `timestamptz`; mọi so sánh trên UTC instant server-side.

### 1.2. Endpoints (đặt trong `WorkOrdersController` hiện có)

| | POST `/api/v1/work-orders/:id/job-board/open` | POST `/api/v1/work-orders/:id/job-board/close` |
|---|---|---|
| Auth | JWT + write-scope project chứa WO (`assertProjectWriteScope` — ADMIN bypass audited hoặc ACTIVE member MANAGER/COORDINATOR; non-member **403 generic kể cả id missing**, ADMIN+missing → 404; mirror `update-work-order.use-case.ts:135-147`) | như open |
| Headers | strict `X-Correlation-Id` UUID, sai → 400 (`work-orders.controller.ts:58-66`) | như open |
| Body | `{ jobBoardOpenFrom?: ISO (default = now server), jobBoardOpenUntil?: ISO\|null (null = không hạn), expectedVersion?: int ≥1, reason?: string ≤500 }` — ValidationPipe `whitelist + forbidNonWhitelisted` | `{ expectedVersion?: int ≥1, reason?: string ≤500 }` |
| Response | `200` WO summary mở rộng + `alreadyOpen?: true` (window trùng) | `200` WO summary + `alreadyClosed?: true` |
| Lỗi | 400 `JOB_BOARD_WINDOW_INVALID` (fieldErrors `{jobBoardOpenFrom}`/`{jobBoardOpenUntil}`) / `WORK_ORDER_NOT_PUBLISHABLE` (+`unmet[]` catalog #42) / `WORK_ORDER_STATUS_NOT_OPENABLE` (fieldErrors `{status}`); 409 `JOB_BOARD_ALREADY_OPEN` / `JOB_BOARD_HAS_ASSIGNEE` / `WORK_ORDER_CONFLICT`; 403; 404; 401 | 409 `WORK_ORDER_CONFLICT`; 400 id/correlation; 403; 404; 401 |

**Thứ tự gate open (deterministic, đã xử lý blocker B1 của review):**
1. Scope-first → load WO + anti-leak 403/404 → normalize/validate window.
2. Pre-check board: `job_board_open=true` → so window: trùng đúng instant → `200 alreadyOpen` (idempotent, không tx/audit — precedent `alreadyInState` API.md §13; đáp ứng AC7); khác → `409 JOB_BOARD_ALREADY_OPEN` (message: đóng Job Board trước khi mở lại). **Đi trước readiness re-check** để path replay/409 không bị readiness chặn nhầm.
3. Pre-check assignment: có `assignments` PENDING_ACCEPTANCE/ACTIVE → `409 JOB_BOARD_HAS_ASSIGNEE` (điều kiện mirror `ux_assignments_current`, `0001:881-883`).
4. Pre-check status: terminal/ASSIGNED/IN_PROGRESS/CANCELLED → `400 WORK_ORDER_STATUS_NOT_OPENABLE`.
5. **Readiness re-check tại thời điểm ghi (J6 — ENDPOINTS §17: "Publish/assign command ở #44/#47 phải re-check server-side tại thời điểm ghi")**, qua read-port có sẵn (`JOB_PUBLISH_CHECK_READ_PORT` + `evaluatePublishReadiness`): nếu status ∈ DRAFT/READY → full catalog; nếu status `OPEN` (re-open sau khi đóng board) → **lọc bỏ `INVALID_STATUS_FOR_PUBLISH`** (các điều kiện dự án/lịch/skill/required-field vẫn bắt buộc). `unmet` ≠ rỗng → `400 WORK_ORDER_NOT_PUBLISHABLE` + `unmet[]`.
6. Tx: `SELECT … FOR UPDATE` → re-run policy trên row tươi → guarded UPDATE:
```sql
UPDATE public.work_orders
   SET job_board_open = true, job_board_open_from = $2, job_board_open_until = $3,
       status = 'OPEN', version = version + 1, updated_at = CURRENT_TIMESTAMP
 WHERE id = $1 [AND version = $4] AND job_board_open = false
   AND status IN ('DRAFT','READY','OPEN')
   AND NOT EXISTS (SELECT 1 FROM public.assignments a
                   WHERE a.work_order_id = work_orders.id
                     AND a.status IN ('PENDING_ACCEPTANCE','ACTIVE'))
```
`rowCount = 0` → re-read row classify: version lệch → 409 `WORK_ORDER_CONFLICT`; flag đã true → về bước 2 semantics; có assignment mới → 409; status đổi → 400. Hai POST open song song: chỉ một UPDATE match (`job_board_open=false` trong WHERE) → 1 winner + 1 replay (AC4).
7. Trong tx: audit `JOB_BOARD_OPENED` tx-embedded (`AUDIT_PORT.logWithClient`, entityType `WORK_ORDER`, beforeData/afterData = `{status, jobBoardOpen, jobBoardOpenFrom, jobBoardOpenUntil, version}`, pattern `update-work-order.use-case.ts:307-327`; fail → 500 rollback) + **state_history chỉ khi status đổi** (DRAFT/READY→OPEN).

**Close guarded UPDATE (pin rõ — m5/F8):**
```sql
UPDATE public.work_orders
   SET job_board_open = false, status = CASE WHEN status = 'OPEN' THEN 'READY' ELSE status END,
       version = version + 1, updated_at = CURRENT_TIMESTAMP
 WHERE id = $1 [AND version = $2] AND job_board_open = true AND status NOT IN ('CANCELLED')
```
rowCount=0 → re-read: flag=false → `200 alreadyClosed`; version → 409. Audit `JOB_BOARD_CLOSED` (before/after) trong tx; KHÔNG đụng bảng `assignments` (AC3 — SRS.md:397).

**Audit/notification:** audit open/close = bắt buộc (DoD "actor/time/before-after"). Notification = **KHÔNG** trong slice này (SRS JOB-SRS-004 — SRS.md:397 — không mandate; người cần biết là worker, khám phá qua board #45; precedent notification J7 chỉ cho đổi lịch/skill). Ghi quyết định vào ENDPOINTS §19.

### 1.3. Schema / field thay đổi — KHÔNG migration mới

Cột + CHECK + index đã có từ baseline (`0001_dbd_v2_1_baseline.sql:236-262, 867-869`); `work_order_state_history` (`0001:319-339`, `reason varchar(500)` :326 — **nên reason body cap 500**, fix M1 của review), `assignments` + `ux_assignments_current` (`0001:287-317, 881-883`) sẵn sàng. Thay đổi chỉ nằm ở code surface:

| File | Thay đổi |
|---|---|
| `src/api/src/modules/job/domain/entity/work-order.entity.ts` | `WorkOrderProps` + 3 props **bắt buộc** `jobBoardOpen: boolean`, `jobBoardOpenFrom/Until: Date\|null` (hiện thiếu — :34-62); `toPublic()` :145-169 trả thêm |
| `.../domain/service/work-order-job-board.policy.ts` (mới, pure) | `validateJobBoardWindow`, `deriveJobBoardState`, `classifyOpenFailure`/`classifyCloseFailure` — mirror style `work-order-update.policy.ts`; **không import Nest/DB** |
| `.../domain/repository/work-order-repository.port.ts` | + `updateJobBoardWithClient` (open/close chung, trả rowCount), `insertStateHistoryWithClient` (F4 — writer state history qua port, không inline SQL trong use case), `hasActiveAssignmentByWorkOrderIds(ids): Promise<Set<string>>` (batch 1 query, mirror `findWorkTypeRefs` :96-104) |
| `.../infrastructure/database/pg-work-order.repository.ts` | `WORK_ORDER_COLUMNS`/`mapRow` (:18-57) + 3 cột; create default false/null/null; `updateWithClient` **KHÔNG thêm** job_board columns (PATCH #43 không được clobber — verified SET clause :269-299 không chứa); dựng `updateJobBoardWithClient`/`insertStateHistoryWithClient`/batch-assignment |
| `.../application/use-case/open-work-order-job-board.use-case.ts` + `close-…` (mới, + specs) | trình tự §1.2; đăng ký trong `job.module.ts` |
| `.../api/rest/controller/work-orders.controller.ts` (+spec) | 2 route `@Post(':id/job-board/open')`/`close` với `@HttpCode(200)`; assertStrictCorrelationId |
| `.../api/rest/presentation/dto/work-order.dto.ts`, `mapper/work-order.mapper.ts` (+specs) | `OpenJobBoardDto`/`CloseJobBoardDto`; response `GET :id` trả thêm `jobBoard: { open, openFrom, openUntil, hasActiveAssignment, state }` — **badge derive server-side**, web không query thứ hai |

**Quy tắc `state` (đã sửa m1 của review — CANCELLED/WORK_DONE/CLOSED không map thành ASSIGNED):** `ASSIGNED` nếu `hasActiveAssignment` hoặc status ∈ {ASSIGNED, IN_PROGRESS} → `EXPIRED` nếu board mở && until != null && now > until → `SCHEDULED` nếu board mở && from != null && now < from (extra state, hỗ trợ đúng nghĩa cửa sổ cho #45) → `AVAILABLE` nếu board mở && status = OPEN → `CLOSED` phần còn lại (DRAFT/READY, board đóng, CANCELLED/WORK_DONE/CLOSED). Đặt trong pure policy, unit-test 100%.

### 1.4. Ma trận quyền

| Hành động | ADMIN (non-member) | MANAGER/COORDINATOR member | WORKER/VIEWER member | Non-member | Anon |
|---|---|---|---|---|---|
| POST open / close | OK (bypass audited; missing → 404) | OK | 403 | 403 kể cả id missing | 401 |
| GET :id (badge) | OK (bypass) | OK | OK (đọc, không ghi) | 403 | 401 |

UI chỉ là convenience gate (`useCanManageProjects`); server là lớp bảo mật thật (pattern `work-orders.controller.ts:33-38`).

### 1.5. Web UI

- Trang chi tiết `src/web/src/app/(app)/work-orders/[id]/page.tsx` (client component, đã fetch `GET :id` + publish-check song song) — thêm `WorkOrderJobBoardCard` + `WorkOrderJobBoardDialog` vào `src/web/src/features/work-orders/components/` (mirror `WorkOrderReadinessPanel`/`WorkOrderEditDialog`); chỉ dùng wrapper Ark UI tại `components/ui/{dialog,badge,button,alert,toast,input}` (WORK-ROUTING.md §3.5).
- Badge từ `workOrder.jobBoard.state` (server-derived): `Đang nhận việc` (AVAILABLE) / `Đã đóng` (CLOSED) / `Hết hạn` (EXPIRED) / `Đã có người nhận` (ASSIGNED) / `Chưa mở cửa sổ` (SCHEDULED).
- Nút (gate `canManage`): DRAFT/READY & board đóng → "Mở Job Board"; OPEN & board đóng → "Mở lại Job Board"; board mở (AVAILABLE/EXPIRED/SCHEDULED) → "Đóng Job Board" (confirm kèm note "việc đã phân công không bị hủy"); state EXPIRED → cảnh báo "đóng rồi mở lại để đặt cửa sổ mới". WORKER/VIEWER: ẩn nút; gọi API trực tiếp → Alert 403 forbidden.
- Dialog mở: 2 ô `datetime-local` (đến optional) → client convert `new Date(v).toISOString()` (bắt buộc — R6), client-validate `until > from`, `until` tương lai; confirm trước submit; `fieldErrors` từ API (`JOB_BOARD_WINDOW_INVALID`) render đúng dưới từng input; `X-Correlation-Id` UUID tự sinh (pattern `work-orders.ts:153,315`).
- Sau thao tác: re-fetch `GET :id` (refresh pattern `page.tsx:262-265`) → badge/nút cập nhật; toast success; 409 `WORK_ORDER_CONFLICT` → Alert "đã bị thay đổi" + nút Tải lại (AC "refresh khi conflict"); 409 `JOB_BOARD_HAS_ASSIGNEE` → thông báo đã có người nhận.
- Bổ sung status labels **cả ở list**: `page.tsx:19-22` (thiếu OPEN) **và** `WorkOrdersList.tsx:25-26` (labels riêng) + `:61` (filter options) — fix m3 của review.
- Đủ states: loading (disable + aria-busy), empty (—), success, validation per-field, error theo `code`, forbidden, retry.

## 2. Phân rã task theo thứ tự thực hiện (DAG tuyến tính, mỗi task có AC riêng)

| # | Task | File/thư mục | AC của task | Xây trên (evidence) |
|---|---|---|---|---|
| T1 | Domain policy pure: `work-order-job-board.policy.ts` + spec (validate window, derive state, classify failure) | `src/api/src/modules/job/domain/service/` | Unit table-test đủ ma trận status × board × assignment × window, **gồm case EXPIRED và ASSIGNED badge** (F6); không import Nest/DB | `work-order-update.policy.ts:1-29` (style), `work-order-publish-check.policy.ts:30-41,96,280` |
| T2 | Entity + port + PG adapter: 3 props, columns/mapRow, `updateJobBoardWithClient` (open+close guard), `insertStateHistoryWithClient`, `hasActiveAssignmentByWorkOrderIds`; **sửa mọi construction site**: `create-work-order.use-case.ts` (default false/null/null) + spec fixtures #41–#43 | entity, port, `pg-work-order.repository.ts`, `create-work-order.use-case.ts`, specs | `tsc` pass ngay sau task; `updateWithClient` KHÔNG đổi; PATCH không clobber board | entity:34-62, repo:18-57,269-299, `0001:881-883` |
| T3 | 2 use cases open/close (+ specs) + wiring `job.module.ts`; trình tự §1.2 đủ 6 bước; readiness re-check có điều kiện (fresh: full; re-open: lọc `INVALID_STATUS_FOR_PUBLISH`; flag=true không bao giờ tới readiness); audit tx-embedded; state_history chỉ khi status đổi; idempotent replay không tx/audit | `application/use-case/`, `job.module.ts` | Anti-leak 403/404 đúng; classify rowCount=0 đúng mọi nhánh; audit fail → 500 rollback | `update-work-order.use-case.ts:128-369` (skeleton), `project-scope.service.ts:101`, read-port #42 |
| T4 | Controller + DTO + mapper: 2 route `@HttpCode(200)`, DTOs, response `GET :id` có `jobBoard` | `work-orders.controller.ts` (+spec), `work-order.dto.ts`, `work-order.mapper.ts` (+specs) | Correlation strict; whitelist; `GET :id` trả `jobBoard.state` đúng theo T1 | controller:39-70,115-149,222-252; mapper:16-71 |
| T5 | **Contract docs** (lane Contract coordinator, fan-out consumer cùng change — WORK-ROUTING.md:18,53): ENDPOINTS.md **§19 mới** (sau §18 — :457); API.md §13 (rows + bullet); WEB.md (feature section) | `docs/architecture/ENDPOINTS.md`, `API.md`, `WEB.md` | Bảng endpoint đầy đủ + bounded decisions: state semantics (close→READY + lý do + phương án bị loại), idempotency, concurrency, **không notification + lý do**, expired read-time + recover = close→open, timezone, **đầy đủ bảng error codes** (`JOB_BOARD_WINDOW_INVALID`, `WORK_ORDER_NOT_PUBLISHABLE`, `WORK_ORDER_STATUS_NOT_OPENABLE`, `JOB_BOARD_ALREADY_OPEN`, `JOB_BOARD_HAS_ASSIGNEE`, `WORK_ORDER_CONFLICT` — F9), ghi nhận deviation AC4 (claim-side thuộc #47 — m4) | ENDPOINTS §16–§18 format; API.md:336 |
| T6 | Web API client: `lib/api/work-order-board.ts` (+spec) + mở rộng type `WorkOrder` trong `work-orders.ts` | `src/web/src/lib/api/` | `openJobBoard`/`closeJobBoard`; token `buildflow.auth.v1`; error shape giữ `fieldErrors`; correlation UUID tự sinh | `work-order-readiness.ts:5-90`, `work-orders.ts:375-397` |
| T7 | Web UI: `WorkOrderJobBoardCard` + `WorkOrderJobBoardDialog` (+specs), wire vào detail page, badge, labels OPEN ở detail **và list** | `src/web/src/features/work-orders/components/`, `app/(app)/work-orders/[id]/page.tsx`, `WorkOrdersList.tsx` | Đủ §1.5; `pnpm typecheck/lint/build` + web jest pass; fix fixtures web bị vỡ bởi type mới (m2/R8) | page.tsx:19-22,42-177,262-265; `components/ui/` |
| T8 | API tests: unit (T1–T4 specs) + integration e2e `src/api/test/work-order-job-board.e2e.spec.ts` | specs + e2e | Ánh xạ AC mục 3; chạy với compose stack đang lên (e2e boot Nest module + Postgres thật) | `work-order-update.e2e.spec.ts:1-80` |
| T9 | E2E evidence: `docs/evidence/job-srs-004/{JOB-SRS-004-E2E.md, e2e-driver-job-srs-004.cjs, e2e-vars.json, shots/}` | evidence dir | Driver thật UI→API→DB→UI ≥1 lần ALL-PASS ×2 runs; SQL assert trực tiếp qua `docker exec … psql`; cleanup theo id | `docs/evidence/job-srs-003/` |
| T10 | Docker rebuild + verify runtime: `docker compose build api web`, restart, health, smoke | `infra/docker/compose.yaml` (chỉ build, không sửa) | Runtime khớp code (precedent AT7 — ENDPOINTS §18); smoke `GET :id` trả `jobBoard` qua container mới | compose đang chạy api:3000/web:3001 |

## 3. Test bắt buộc — ánh xạ 1-1 acceptance criteria của issue

| AC issue | Test | File | Loại |
|---|---|---|---|
| 1. Open valid → thấy trên Job Board | open DRAFT đủ điều kiện → 200, `status='OPEN'`, `jobBoard.state='AVAILABLE'`; DB assert `job_board_open=true`, `version+1`, row `work_order_state_history` DRAFT→OPEN; SQL board-list (`WHERE job_board_open AND status='OPEN' AND from ≤ now < coalesce(until,'∞')`) trả đúng 1 row; evidence: UI mở → psql → GET lại → badge | `src/api/test/work-order-job-board.e2e.spec.ts` + evidence driver | e2e + evidence |
| 2. Draft thiếu data / assigned / cancelled / expired không mở được | thiếu schedule/required-field → 400 `WORK_ORDER_NOT_PUBLISHABLE` + `unmet[]` (J6 re-check); seed assignment PENDING/ACTIVE → 409 `JOB_BOARD_HAS_ASSIGNEE` (pre-check VÀ path rowCount=0); CANCELLED → 400 `WORK_ORDER_STATUS_NOT_OPENABLE`; `until` quá khứ → 400 `fieldErrors.openUntil`; unit policy đủ ma trận | e2e + `open-work-order-job-board.use-case.spec.ts` + policy spec | unit + e2e |
| 3. Close không hủy assignment | seed WO OPEN + assignment ACTIVE → close → 200, flag=false, **assignment row nguyên trạng** (status/assigned_at không đổi); audit `JOB_BOARD_CLOSED` before/after | e2e + evidence (psql) | e2e + evidence |
| 4. Concurrent open/claim → 1 winner | 2 POST open song song (Promise.all, lặp nhiều lần chống flake) → đúng 1 mutate + 1 `alreadyOpen`/409, **đúng 1 row audit `JOB_BOARD_OPENED`**, version +1 đúng 1 lần; claim-side (#47) chứng minh qua NOT EXISTS trong guard + case assignment chen giữa (seed rồi open → 409) — **deviation ghi trong §19 + PR comment** | e2e + evidence (2 request song song thật) | unit + e2e + evidence |
| 5. Quyền: đúng role/scope pass; sai role/project, ID/URL không bypass | PM member pass; WORKER member 403; non-member 403 kể cả id random missing; ADMIN+missing 404; anon 401; id sai UUID 400; correlation sai 400; UI: WORKER thấy badge không nút, gọi thẳng API → Alert 403 | e2e (mirror matrix `work-order-update.e2e.spec.ts`) + web component spec | e2e + web unit |
| 6. Validation & invalid-state; lỗi nêu nguyên nhân + cách xử lý | from>until / ISO sai / until quá khứ → 400 fieldErrors đúng field + message actionable; terminal → 400 code đúng; web spec assert fieldErrors render đúng input | policy + e2e + web spec | cả ba |
| 7. Retry/double-submit không trùng record | open ×2 cùng window → lần 2 `200 alreadyOpen`, **1 audit row, version +1 đúng 1 lần**; close ×2 → `alreadyClosed`, 0 audit mới; đếm `audit_logs`/`work_order_state_history` trước-sau | e2e + evidence | unit + e2e + evidence |
| 8. Integration/E2E UI dùng API thật | driver browser thật: PM login → detail → dialog nhập cửa sổ → confirm → API thật → psql assert → badge AVAILABLE; close qua UI → badge CLOSED; shot loading/error/forbidden/409-retry | `e2e-driver-job-srs-004.cjs` + `JOB-SRS-004-E2E.md` | evidence |
| DoD UI states | `WorkOrderJobBoardCard.spec.tsx` + `WorkOrderJobBoardDialog.spec.tsx` mock fetch từng status, assert render + retry | web specs | web unit |
| DoD audit actor/time/before-after | e2e assert audit row `actor_user_id`, `created_at`, before→after | e2e | e2e |
| DoD contract docs | T5 checklist | ENDPOINTS §19 / API.md / WEB.md | docs |

## 4. Dependencies và constraints

- Thứ tự cứng: T1 → T2 (chạy `tsc` ngay) → T3 → T4 → **T5 trước T6/T7** (contract chốt rồi fan-out — WORK-ROUTING.md §5) → T6 → T7 → T8 → T9 (cần T10 rebuild trước khi chạy driver) → T10. T8 song song được với T6/T7 sau khi T4 xong.
- Không tham chiếu stash/reflog cũ (WIP #51); chỉ issue + SRS.md + docs/architecture hiện hành + code trên main.
- Không migration mới; không đụng `updateWithClient` (giữ contract #43); không endpoint claim/list; không mobile.
- Contract docs merge cùng PR với API + web (WORK-ROUTING.md:18 "cập nhật producer, generated artifacts và consumer trong cùng thay đổi").
- Orchestration tầng Lead: tối đa 2 agent mỗi lần.

## 5. Rủi ro triển khai + cách kiểm chứng

| Rủi ro | Bằng chứng | Kiểm chứng |
|---|---|---|
| R1. TOCTOU giữa readiness pre-check (pool ngoài tx) và ghi — project/work-type đổi giữa check và UPDATE | read-port dùng pool riêng (`pg-work-order-publish-check.read-adapter.ts`) | Hard gates (status/flag/assignment/version) nằm trong WHERE của guarded UPDATE; readiness residue ghi nhận như residual trong §19 (kiểu AT7); e2e tài liệu hóa 1 case |
| R2. Thêm 3 props bắt buộc vỡ mọi construction site, gồm production `create-work-order.use-case.ts` (F3/m2) | entity:34-62 constructor-validate; `create-work-order.use-case.ts:289` `createDraft({...})` | Enumerate đủ: create use case (defaults) + spec fixtures #41–#43; chạy `tsc` ngay sau T2 |
| R3. PATCH #43 clobber board nếu vô tình thêm cột vào `updateWithClient` | SET clause :269-299 hiện không chứa job_board | Test regression: open → PATCH description → GET lại `jobBoard.open=true`; review chặn thêm cột |
| R4. Close→READY tranh chấp ngữ nghĩa SRS | SRS.md:281 chỉ liệt kê chuyển tiếp chính; field-lock status-keyed :67,100-105 (verified); J7 :175-177 | Ghi quyết định + phương án bị loại (sửa policy #43 — phá e2e U2 `JOB-SRS-003-E2E.md`) vào §19; reviewer phản đối mới mở lại |
| R5. WO hết hạn treo OPEN+flag=true, publish-check `ALREADY_ON_JOB_BOARD` | policy:438-445 | Docs ghi recover = Close → Open; UI hiển thị cảnh báo; test case riêng |
| R6. `datetime-local` gửi chuỗi naive mất offset | picker HTML không kèm offset | Client bắt buộc `.toISOString()`; server validate `until > now` trên instant; e2e assert DB instant khớp |
| R7. `work_order_state_history` lần đầu có writer (grep = 0 hit hiện nay) | bảng `0001:319-339`, `reason varchar(500)` | Writer qua repo port + e2e assert row; reason body cap 500; INSERT fail → 500 rollback (unit mirror audit-fail) |
| R8. Web specs vỡ khi `WorkOrder` type thêm field | `work-orders.ts:19-45` share rộng | Fix fixture, chạy full web test trước commit |
| R9. Runtime container lệch code | precedent AT7 (ENDPOINTS §18); evidence job-srs-003 §1 | T10 rebuild + health + smoke |
| R10. Bị coi thiếu notification | issue: "nếu policy áp dụng"; SRS.md:397 không mandate | Quyết định + lý do ghi trong §19 + issue comment khi PR |

**Unresolved question (nêu rõ, không chặn):** (a) claim-side concurrency thực sự chỉ chứng minh được đầy đủ ở #47 — deviation đã ghi §19; (b) SCHEDULED là badge phụ (issue chỉ đòi 4 badge) — additive, phục vụ đúng nghĩa cửa sổ, ghi trong §19.

## 6. Lệnh verify + kết quả mong đợi

```bash
cd /home/trung/Documents/2026/project/buildflow
# API
cd src/api && npm run typecheck && npm run lint && npm test -- --coverage=false   # exit 0, unit + integration pass
npm run test:e2e -- work-order-job-board.e2e.spec.ts                              # hoặc jest config hiện hành của src/api/test
# Web
cd ../web && pnpm typecheck && pnpm lint && pnpm test                              # exit 0
pnpm build                                                                         # Next build pass
# Docker rebuild + runtime
cd ../.. && docker compose -f infra/docker/compose.yaml build api web && docker compose -f infra/docker/compose.yaml up -d
docker compose -f infra/docker/compose.yaml ps        # api, web, postgres, redis healthy
curl -s http://localhost:3000/api/v1/health           # (hoặc endpoint health hiện có) 200
# Smoke: GET /api/v1/work-orders/:id (JWT PM) → body chứa "jobBoard":{"open":...,"state":...}
# DB assert trong evidence driver:
docker exec buildflow-postgres-1 psql -U <user> -d <db> -c \
  "SELECT job_board_open, job_board_open_from, job_board_open_until, status, version FROM work_orders WHERE id='<id>';"
# → job_board_open=t, status=OPEN, version+1; và audit: SELECT action FROM audit_logs WHERE entity_id='<id>' → JOB_BOARD_OPENED đúng 1 row sau double-submit
node docs/evidence/job-srs-004/e2e-driver-job-srs-004.cjs   # 2 lần liên tiếp → ALL-PASS; shots/ có ảnh
```

Kế hoạch này tự thân đủ để thực hiện: mọi quyết định tranh chấp đã chốt kèm bằng chứng, mọi AC có test ánh xạ, mọi claim có file:line hoặc đánh dấu residual.
