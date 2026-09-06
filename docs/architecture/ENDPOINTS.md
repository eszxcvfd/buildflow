# Endpoint contract — ORG catalog slices (workers/contractors/trades/crews)

> **Owner:** API/Contract workspace (xem [`WORK-ROUTING.md`](../../WORK-ROUTING.md) — HTTP endpoint/DTO/validation thuộc `src/api` Contract lane).
> **Phạm vi:** các endpoint org catalog đã implement theo vertical slice `#24` (`ORG-SRS-001` workers), `#25` (`ORG-SRS-002` contractors), `#26` (`ORG-SRS-003` trades), lifecycle trạng thái `#27` (`ORG-SRS-004`) và `#29` (`ORG-SRS-006` crews). Đây là contract công bố cho web/mobile; thay đổi breaking phải route qua `NETCODE.md` và đồng bộ consumer trong cùng thay đổi.
> **File gốc:** endpoint policy được cập nhật cùng slice trong `docs/architecture/API.md`; file này chép/bám sát nội dung đó để làm tài liệu tra cứu endpoint (không tạo một policy thứ hai).

---

## 1. Nguyên tắc chung

- Base path versioned: `/api/v1`.
- Phân quyền đọc/ghi (ORG-SRS-005, `#28`): các **GET search + GET detail** của workers/contractors/trades mở cho roles **`ADMIN` + `PROJECT_MANAGER`** (read-only phục vụ điều phối); mọi **write** (`POST`/`PATCH`, lifecycle `PATCH .../status`, `GET .../open-work`) giữ **ADMIN-only**. **Ngoại lệ crews (`#29`): read + write mở cho `ADMIN` + `PROJECT_MANAGER`** (SRS actor Điều phối viên; bounded decision §7). Chưa xác thực → `401` (JWT guard); đã xác thực nhưng sai role → `403`. JWT roles là server-derived (login use case) — client không thể bypass.
- **Strict `X-Correlation-Id` policy** (admin/management, IAM-SRS-008): header thiếu/không gửi là hợp lệ → audit ghi `correlation_id` null; header có mặt nhưng không phải UUID → `400` với message `X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)`, request không vào use case.
- Mọi write chạy **tx-embedded audit** (`AuditPort.logWithClient`) — ghi nghiệp vụ + audit cùng transaction; audit thất bại thật = `500`, rollback nguyên tử. `ux_audit_correlation_action` dedup khi retry cùng `X-Correlation-Id`.
- Error mapping chung: `400` validation/status không hợp lệ (body sai bị ValidationPipe chặn trước khi vào use case); `401` chưa xác thực; `403` non-admin; `404` không tìm thấy (không leak tồn tại qua lỗi khác biệt); `409` trùng mã/khóa unique; `500` lỗi hệ thống/audit.
- Catalog đã dùng **không hard delete** — không có DELETE endpoint; chỉ deactivate qua status endpoint.
- Audit no-secrets: `beforeData`/`afterData` chỉ chứa public fields (xem 8.5 API.md); key `_warning` (khi có) là text tiếng Việt, hợp lệ với `AuditLogEntity.isSanitized()`.

## 2. Workers — ORG-SRS-001 (#24) + directory widen ORG-SRS-005 (#28)

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/workers` | ADMIN-only | `{ email, password, fullName, phone?, avatarUrl?, employeeCode?, contractorId?, trades?: [{ tradeId, skillLevel 1-5 }] }` | `200` worker profile | `400`/`409` trùng email hoặc employeeCode; `400` trade inactive/không tồn tại |
| GET | `/api/v1/workers` | **ADMIN + PROJECT_MANAGER** | query `status` (`ACTIVE`/`INACTIVE`/`LOCKED`), `search`, `tradeId`, `skillLevel`, `sort` (`name`→`full_name`, `createdAt`→`created_at`; default `createdAt`), `order` (`asc`/`desc`; default `desc`), `limit` (1-100, default 20), `offset` (≥0) | `200 { data[], total, limit, offset }` + header `Cache-Control: no-store` | `400` query sai (`{ statusCode, message, fieldErrors }`) |
| GET | `/api/v1/workers/:id` | **ADMIN + PROJECT_MANAGER** | — | `200` worker profile + header `Cache-Control: no-store` | `400` id sai; `404` |
| PATCH | `/api/v1/workers/:id` | ADMIN-only | `{ fullName?, phone?, avatarUrl?, employeeCode?, contractorId?, trades? }` | `200` worker profile | `400`/`409`; `404` |

- Audit actions: `ORG_WORKER_CREATED`, `ORG_WORKER_UPDATED` (xem 8.2 API.md). Worker trong org module quản lý profile + trades; account IAM lifecycle (LOCKED/security) nằm ở `/api/v1/admin/users/:id/status`, còn lifecycle nghiệp vụ (ACTIVATE/SUSPEND/TERMINATE) nằm ở `PATCH /api/v1/workers/:id/status` (ORG-SRS-004, mục 5).
- Trade gán cho worker phải đang ACTIVE — inactive không qua được (không dùng cho phân công mới).
- **PATCH `/workers/:id` — `trades` = replace toàn bộ:** nếu payload có gửi `trades` thì danh sách đó **thay thế toàn bộ** trades hiện có của worker (row cũ bị deactivate, insert row mới). Client giữ nguyên phần ngành nghề phải **OMIT** key `trades` khỏi payload; không có khái niệm gửi danh sách trống để “giữ nguyên”.

## 3. Contractors — ORG-SRS-002 (#25) + directory widen ORG-SRS-005 (#28)

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/contractors` | ADMIN-only | `{ code, name, contactName, phone?, email?, scope, status? }` | `200` contractor profile (`eligible` = ACTIVE) | `400`; `409` trùng code |
| GET | `/api/v1/contractors` | **ADMIN + PROJECT_MANAGER** | query `status`, `search`, `scope`, `eligibleOnly`, `sort` (`name`→`name`, `createdAt`→`created_at`; default `createdAt`), `order` (`asc`/`desc`; default `desc`), `limit`, `offset` | `200 { data[], total, limit, offset }` + header `Cache-Control: no-store` | `400` query sai (eligibleOnly + INACTIVE bị chặn) (`{ statusCode, message, fieldErrors }`) |
| GET | `/api/v1/contractors/:id` | **ADMIN + PROJECT_MANAGER** | — | `200` contractor profile + header `Cache-Control: no-store` | `400` id sai; `404` |
| PATCH | `/api/v1/contractors/:id` | ADMIN-only | `{ code?, name?, contactName?, phone?, email?, scope?, status? }` | `200` contractor profile | `400`; `409` trùng code (excl. self); `404` |

- Same-status PATCH là no-op idempotent (không reject) — form edit luôn kèm status hiện tại (#25).
- **PATCH `/contractors/:id` inline `status` giữ nguyên hoạt động (backward-compat) nhưng DEPRECATED** — lifecycle chính thức chuyển sang `PATCH /api/v1/contractors/:id/status` (ORG-SRS-004, mục 5); inline status không có reason policy/open-work warning.
- Deactivate contractor đang có lịch sử: vẫn cho phép (không hard delete), audit afterData gắn `_warning: 'Nhà thầu có lịch sử công việc, không xóa liên kết'`.
- Audit actions: `ORG_CONTRACTOR_CREATED`, `ORG_CONTRACTOR_UPDATED`, `ORG_CONTRACTOR_STATUS_CHANGED` (khi status thật sự đổi).
- Code rules: 2-50 ký tự, `^[A-Za-z0-9_-]+$`; name 2-200; contactName bắt buộc ≤150; scope bắt buộc ≤1000; phone/email optional.

## 4. Trades — ORG-SRS-003 (#26) + directory widen ORG-SRS-005 (#28)

Danh mục ngành nghề/kỹ năng. Bảng `public.trades` (migration 0001): `code varchar(50)` unique `ux_trades_code`, `name varchar(120)`, `description varchar(500)`, `is_active boolean`. FK tham chiếu: `resource_trades.trade_id`, `work_types.required_trade_id`, `work_orders.required_trade_id` — catalog đã tham chiếu **chỉ được ngừng hoạt động**, không hard delete, không migration mới.

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/trades` | ADMIN-only | `{ code, name, description?, status? }` | `200` trade profile | `400` validation; `409` trùng `code` |
| GET | `/api/v1/trades` | **ADMIN + PROJECT_MANAGER** | query `status` (`ACTIVE`/`INACTIVE`/`ALL`, thiếu = ALL), `search` (ILIKE code/name), `limit` (1-100, default 20), `offset` (≥0) — sort cố định `ORDER BY name` (không có param `sort`/`order`) | `200 { data[], total, limit, offset }` sort theo `name` + header `Cache-Control: no-store` | `400` query sai (`{ statusCode, message, fieldErrors }`) |
| GET | `/api/v1/trades/:id` | **ADMIN + PROJECT_MANAGER** | — | `200` trade profile + header `Cache-Control: no-store` | `400` id sai; `404` |
| PATCH | `/api/v1/trades/:id` | ADMIN-only | `{ code?, name?, description? }` | `200` trade profile | `400`; `409` trùng code (excl. self); `404` |
| PATCH | `/api/v1/trades/:id/status` | ADMIN-only | `{ status: 'ACTIVE' \| 'INACTIVE' }` | `200` trade profile, kèm `warning` nếu có | `400` status không hợp lệ/same-status; `404` |

Rules:

- Code: 2-50 ký tự, `^[A-Za-z0-9_-]+$`. Name: 1-120 ký tự. Description: optional, ≤500 ký tự.
- Create: dup code pre-check (`findByCode`) + race guard trong transaction (23505/`ux_trades_code` → `409`); mặc định `ACTIVE` khi không gửi `status`.
- **Deactivate đang được dùng:** được phép (SRS: catalog đã dùng chỉ ngừng hoạt động) nhưng nếu `countActiveUsage(tradeId) > 0` (reference đang hiệu lực: `resource_trades` is_active=true, `work_types.required_trade_id` is_active=true, `work_orders.required_trade_id` status ∉ CANCELLED/CLOSED, đếm qua UNION không double-count) thì response kèm `warning: 'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực'` và audit afterData gắn `_warning` cùng text — payload vẫn pass no-secrets sanitize. Reactivate không tính usage.
- Response trade profile: `{ id, code, name, description, status, assignable, createdAt, updatedAt, warning? }` (`assignable` = đang ACTIVE; `warning` chỉ xuất hiện khi deactivate đang dùng).
- Không có DELETE; inactive trade vẫn truy được chi tiết (lịch sử catalog).
- Audit actions: `ORG_TRADE_CREATED` (afterData), `ORG_TRADE_UPDATED` (before/afterData), `ORG_TRADE_STATUS_CHANGED` (before/afterData).

## 5. Resource lifecycle status — ORG-SRS-004 (#27)

Kích hoạt/tạm ngừng/chấm dứt worker và contractor. **State policy (đã chốt, KHÔNG đổi enum DB):** action enum ở API layer ánh xạ về status DB hiện có — `ACTIVATE`→`ACTIVE`, `SUSPEND`→`INACTIVE`, `TERMINATE`→`INACTIVE`; eligibility giữ nguyên ACTIVE-only.

| Method | Path | Body | Response | Lỗi |
| --- | --- | --- | --- | --- |
| PATCH | `/api/v1/workers/:id/status` | `{ action: 'ACTIVATE' \| 'SUSPEND' \| 'TERMINATE', reason? }` | `200` worker profile + `alreadyInState` + `warning?` | `400` action sai/thiếu reason; `404`; `400` X-Correlation-Id sai |
| PATCH | `/api/v1/contractors/:id/status` | `{ action: 'ACTIVATE' \| 'SUSPEND' \| 'TERMINATE', reason? }` | `200` contractor profile + `alreadyInState` + `warning?` | `400` action sai/thiếu reason; `404`; `400` X-Correlation-Id sai |
| PATCH | `/api/v1/crews/:id/status` | `{ action: 'ACTIVATE' \| 'SUSPEND' \| 'TERMINATE', reason? }` | `200` crew profile + `alreadyInState` + `warning?` | `400` action sai/thiếu reason; `404`; `400` X-Correlation-Id sai |
| GET | `/api/v1/workers/:id/open-work` | — | `200 { openAssignments }` | `401`/`403`; `404` |
| GET | `/api/v1/contractors/:id/open-work` | — | `200 { openAssignments }` | `401`/`403`; `404` |
| GET | `/api/v1/crews/:id/open-work` | — | `200 { openAssignments }` | `401`/`403`; `404` |

Rules (worker + contractor giống nhau, issue #27):

- **Reason policy:** bắt buộc (1-500 ký tự, sau trim) cho `SUSPEND`/`TERMINATE` — thiếu → `400` `'Lý do là bắt buộc khi tạm ngừng/chấm dứt'`; optional cho `ACTIVATE`. Reason KHÔNG đi vào beforeData/afterData; ghi vào cột `audit_logs.reason` (write path wire lần đầu tại slice này).
- **Idempotent repeat:** `SUSPEND`/`TERMINATE` khi đã `INACTIVE`, hoặc `ACTIVATE` khi đã `ACTIVE` → `200` kèm `alreadyInState: true`, KHÔNG ghi audit, KHÔNG đụng change logic. Khác reject same-status cũ (`PATCH /admin/users/:id/status` vẫn reject như trước, giữ nguyên cho LOCKED/security).
- **Open-work warning:** khi rời khỏi `ACTIVE` (`SUSPEND`/`TERMINATE` từ ACTIVE) đếm assignments mở (`PENDING_ACCEPTANCE`/`ACTIVE`): worker = `assignments.worker_id`; contractor = assignments của crews (`crews.contractor_id`) + workers (`users.contractor_id`) thuộc contractor (UNION, không double-count). `openAssignments > 0` → response kèm `warning: { openAssignments: N }` và audit afterData gắn `_warning: 'Nguồn lực đang có N công việc/lịch mở'` (text tiếng Việt, pass no-secrets sanitize). **Cảnh báo, KHÔNG chặn transition.** Count thất bại (DB down) → `500`, không transition thiếu cảnh báo.
- **ACTIVATE** xóa `locked_until`/reset failed count qua `changeStatus` hiện có (hành vi giữ nguyên).
- Audit action riêng theo action (tx-embedded 1 lần; retry cùng `X-Correlation-Id` bị dedup):

| Endpoint | `ACTIVATE` | `SUSPEND` | `TERMINATE` |
| --- | --- | --- | --- |
| `PATCH /api/v1/workers/:id/status` | `ORG_WORKER_REACTIVATED` | `ORG_WORKER_SUSPENDED` | `ORG_WORKER_TERMINATED` |
| `PATCH /api/v1/contractors/:id/status` | `ORG_CONTRACTOR_REACTIVATED` | `ORG_CONTRACTOR_SUSPENDED` | `ORG_CONTRACTOR_TERMINATED` |

- Worker lifecycle dùng entity `changeStatus` chung (users table); KHÔNG đụng `PATCH /api/v1/admin/users/:id/status` cũ (giữ nguyên cho LOCKED/security).
- Crew lifecycle (`#29`, xem mục 8): reuse `resource-status.policy` của mục này (`ACTIVATE`→`ACTIVE`, `SUSPEND`/`TERMINATE`→`INACTIVE`; crew không có `locked_until` nên ACTIVATE chỉ đổi status). Open-work của đội đếm trực tiếp `assignments WHERE crew_id=$1 AND status IN ('PENDING_ACCEPTANCE','ACTIVE')`. Audit riêng `ORG_CREW_SUSPENDED`/`ORG_CREW_TERMINATED`/`ORG_CREW_REACTIVATED`.
- `GET .../open-work` là pre-check admin-only cho UI confirm dialog — chỉ đếm, không chặn, không audit.
- `PATCH /api/v1/contractors/:id` inline `status` vẫn hoạt động (backward-compat) nhưng **deprecated** (xem mục 3).

Giới hạn phạm vi & quyết định đã duyệt (bounded decisions, review #27):

- **Đội (crew) đã land ở `#29`:** SRS ORG-SRS-004 nêu lifecycle cho "worker, nhà thầu và đội" — crew lifecycle dùng cùng state policy ở mục này (xem mục 8). Ghi chú defer cũ ở review `#27` đã resolved.
- **Concurrency = last-write accepted:** check-then-act (findById + idempotent check + count) chạy ngoài transaction, không `FOR UPDATE`. Hai admin đổi trạng thái đồng thời với correlation-id khác nhau → status hội tụ đúng (last-write) nhưng có thể sinh 2 audit rows cho cùng một chuyển đổi. Rủi ro chấp nhận được (admin-only, hiếm, không corrupt dữ liệu).
- **Worker open-work đếm trực tiếp:** `countOpenAssignments(worker)` chỉ đếm assignment gán trực tiếp (`assignments.worker_id`); assignment gán qua crew (`worker_id NULL`, XOR check `assignments_assignee_ck`) không tính vào pre-check của worker riêng lẻ — contractor-level UNION đã bao phủ cả hai. Chỉ ảnh hưởng cảnh báo, không ảnh hưởng an toàn transition.

## 6. Audit action list (bổ sung org trades + crews)

Strict `X-Correlation-Id` producer (bảng 8.2 API.md):

| Endpoint | Audit action |
| --- | --- |
| `POST /api/v1/trades` | `ORG_TRADE_CREATED` |
| `PATCH /api/v1/trades/:id` | `ORG_TRADE_UPDATED` |
| `PATCH /api/v1/trades/:id/status` | `ORG_TRADE_STATUS_CHANGED` |
| `POST /api/v1/crews` | `ORG_CREW_CREATED` |
| `PATCH /api/v1/crews/:id` (đổi tên/mô tả/nhà thầu) | `ORG_CREW_UPDATED` |
| `PATCH /api/v1/crews/:id` (đổi trưởng nhóm) | `ORG_CREW_LEAD_CHANGED` |
| `PATCH /api/v1/crews/:id/status` | `ORG_CREW_SUSPENDED` / `ORG_CREW_TERMINATED` / `ORG_CREW_REACTIVATED` (theo action `SUSPEND`/`TERMINATE`/`ACTIVATE`) |

## 7. Resource directory — ORG-SRS-005 (#28) bounded decisions

Quyết định đã chốt cho slice tra cứu nguồn lực (API slice; UI Web thuộc web slice riêng):

- **Role widen READ-only:** `GET` search + `GET` detail của workers/contractors/trades mở cho `ADMIN` + `PROJECT_MANAGER` (helper dùng chung `requireRoles(req, roles)` trong `iam/api/rest/guard/roles.guard.ts`; các write path giữ `assertAdmin`). Không refactor toàn bộ controller — chỉ các path widen.
- **Team filter defer #29 → resolved cho crews, còn defer cho workers (#30):** SRS yêu cầu lọc theo đội nhưng crew CRUD thuộc ORG-SRS-006 (`#29`, Should) — nay crews đã có endpoint search riêng (mục 8); param team filter ở `GET /workers` vẫn defer sang `#30`.
- **Project scope N/A:** workers/contractors/trades là org-level directory, không có FK project; enforcement thay thế bằng role scope (chỉ ADMIN/PM được đọc). Không có project-out-of-scope/ID-tampering ở tài nguyên này.
- **PII:** giữ `email`/`phone` trong response (nghiệp vụ điều phối cần liên hệ trực tiếp; mapper `toPublic` đã giới hạn — detail không trả gì thêm so với list); không thêm/trả PII khác.
- **Current data:** `GET` search + `GET` detail trả header `Cache-Control: no-store` (không dùng cache stale để quyết định assignment); web client cũng fetch với `cache: 'no-store'`.
- **Field-level filter errors:** lỗi validation filter (`status`/`limit`/`offset`/`tradeId`/`skillLevel`/`sort`/`order`, contractor `eligibleOnly`) trả `400 { statusCode, message, fieldErrors: { <field>: [msg] } }`; `message` giữ nguyên text cũ nên client chỉ đọc `message` không break.
- **Role widen crews read + write (`#29`, bounded decision):** crews mở `ADMIN` + `PROJECT_MANAGER` trên cả read lẫn write (`POST`/`PATCH`/`PATCH .../status`/`GET .../open-work` dùng chung `requireRoles(req, ['ADMIN','PROJECT_MANAGER'])`), vì SRS actor là Điều phối viên — khác write admin-only của workers/contractors/trades. Không widen nhầm endpoint khác (các controller cũ giữ nguyên `assertAdmin` ở write path).
- **Assignment creation (slice JOB tương lai) phải re-check status/capability server-side trước khi ghi; kết quả directory không phải authorization.**

## 8. Crews — ORG-SRS-006 (#29)

Quản lý đội thi công. Bảng `public.crews` (migration 0001): `code varchar(50)` unique `ux_crews_code`, `name varchar(120)`, `contractor_id` nullable FK, `description varchar(500)`, `status ACTIVE|INACTIVE`. Trưởng nhóm lưu ở `public.crew_members` (`member_role LEAD/MEMBER`, partial unique `ux_crew_one_active_lead` + `ux_crew_member_active`, `revocation_ck`). Không hard delete, không đổi enum DB.

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/crews` | **ADMIN + PROJECT_MANAGER** | `{ code, name, leaderUserId, contractorId?, description? }` | `200` crew profile (`eligible` = ACTIVE, kèm `leaderUserId`) | `400` validation/leader invalid (fieldErrors `{leaderUserId}`); `409` trùng code |
| GET | `/api/v1/crews` | **ADMIN + PROJECT_MANAGER** | query `status`, `search` (ILIKE code/name/description), `eligibleOnly`, `sort` (`name`→`name`, `createdAt`→`created_at`; default `createdAt`), `order` (`asc`/`desc`; default `desc`), `limit` (1-100, default 20), `offset` (≥0) | `200 { data[], total, limit, offset }` + header `Cache-Control: no-store` | `400` query sai (`{ statusCode, message, fieldErrors }`) |
| GET | `/api/v1/crews/:id` | **ADMIN + PROJECT_MANAGER** | — | `200` crew profile + header `Cache-Control: no-store` | `400` id sai; `404` |
| PATCH | `/api/v1/crews/:id` | **ADMIN + PROJECT_MANAGER** | `{ name?, description?, leaderUserId?, contractorId? }` (không đổi `code`) | `200` crew profile | `400`; `404` |
| PATCH | `/api/v1/crews/:id/status` | **ADMIN + PROJECT_MANAGER** | `{ action: 'ACTIVATE' \| 'SUSPEND' \| 'TERMINATE', reason? }` | `200` crew profile + `alreadyInState` + `warning?` | `400` action sai/thiếu reason; `404`; `400` X-Correlation-Id sai |
| GET | `/api/v1/crews/:id/open-work` | **ADMIN + PROJECT_MANAGER** | — | `200 { openAssignments }` | `404` |

Rules:

- Code: 2-50 ký tự, `^[A-Za-z0-9_-]+$`. Name: 2-120 ký tự. Description: optional, ≤500 ký tự.
- Create: dup code pre-check (`findByCode`) + race guard trong transaction (23505/`ux_crews_code` → `409`); crew + row `crew_members` LEAD (`effective_from=CURRENT_DATE`, `added_by=actor`) ghi cùng tx; audit `ORG_CREW_CREATED`.
- **Leader validation:** `leaderUserId` bắt buộc khi tạo; user phải tồn tại + `user_type='WORKER'` + `status='ACTIVE` — ngược lại `400` fieldErrors `{leaderUserId}`. `contractorId` (nếu gửi) phải tồn tại — ngược lại `400` fieldErrors `{contractorId}`.
- **Leader change trong PATCH:** chỉ chạy khi `leaderUserId` khác LEAD đang hiệu lực → soft-deactivate row cũ (`is_active=false`, `effective_to=CURRENT_DATE` — thỏa `revocation_ck`) + insert LEAD mới, cùng tx; audit riêng `ORG_CREW_LEAD_CHANGED` (before/afterData chứa leader cũ/mới qua `leaderUserId`). Gửi đúng leader hiện tại → no-op, không audit lead. Race vi phạm `ux_crew_one_active_lead` → `409` `'Đội đã có trưởng nhóm đang hiệu lực'`.
- Lifecycle reuse `resource-status.policy` (mục 5): reason bắt buộc 1-500 cho `SUSPEND`/`TERMINATE`; idempotent repeat → `alreadyInState`, không audit; khi rời ACTIVE đếm open assignments của đội → `warning` + `_warning` audit, fail-closed (lỗi đếm → `500`).
- Response crew profile: `{ id, code, name, description, contractorId, status, eligible, leaderUserId, createdBy, createdAt, updatedAt, warning? }` (`eligible` = đang ACTIVE; `warning` chỉ xuất hiện khi deactivate có open work).
- Audit actions: `ORG_CREW_CREATED`, `ORG_CREW_UPDATED`, `ORG_CREW_LEAD_CHANGED`, `ORG_CREW_SUSPENDED`, `ORG_CREW_TERMINATED`, `ORG_CREW_REACTIVATED` (tx-embedded, correlation strict).
- **Hai shape 400 trên crews** (giống các slice trước, client parse cả hai): (a) body thiếu/rỗng field bị `ValidationPipe` chặn trước use-case → shape mặc định `{ message: string[], error, statusCode: 400 }` KHÔNG có `fieldErrors`; (b) field hợp lệ về format nhưng business-invalid (leader không tồn tại/inactive, contractor 404, query sai, thiếu reason) → shape `{ statusCode, message, fieldErrors }`.
- **Uniqueness policy cho `code`:** pre-check `findByCode` case-insensitive (chặt hơn DB — `ux_crews_code` là btree case-sensitive); giới hạn đã biết: hai create đồng thời với code chỉ khác chữ hoa/thường (`ABC`/`abc`) đều qua pre-check và DB chấp nhận cả hai.

## References

- [`docs/architecture/API.md`](API.md) — module/domain conventions, audit policy (8.2/8.3/8.4/8.5)
- [`docs/architecture/NETCODE.md`](NETCODE.md) — transport/error contract
- SRS/issue: workers `#24`, contractors `#25`, trades `#26`, lifecycle `#27`, resource directory `#28`, crews `#29`
