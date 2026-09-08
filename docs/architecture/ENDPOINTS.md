# Endpoint contract — ORG catalog slices (workers/contractors/trades/crews)

> **Owner:** API/Contract workspace (xem [`WORK-ROUTING.md`](../../WORK-ROUTING.md) — HTTP endpoint/DTO/validation thuộc `src/api` Contract lane).
> **Phạm vi:** các endpoint org catalog đã implement theo vertical slice `#24` (`ORG-SRS-001` workers), `#25` (`ORG-SRS-002` contractors), `#26` (`ORG-SRS-003` trades), lifecycle trạng thái `#27` (`ORG-SRS-004`), `#29` (`ORG-SRS-006` crews) và `#30` (`ORG-SRS-007` crew members + workers `crewId` filter). Đây là contract công bố cho web/mobile; thay đổi breaking phải route qua `NETCODE.md` và đồng bộ consumer trong cùng thay đổi.
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
| GET | `/api/v1/workers` | **ADMIN + PROJECT_MANAGER** | query `status` (`ACTIVE`/`INACTIVE`/`LOCKED`), `search`, `tradeId`, `skillLevel`, `crewId` (uuid — workers có ACTIVE membership trong đội, `#30` D9), `sort` (`name`→`full_name`, `createdAt`→`created_at`; default `createdAt`), `order` (`asc`/`desc`; default `desc`), `limit` (1-100, default 20), `offset` (≥0) | `200 { data[], total, limit, offset }` (mỗi profile kèm `crews[]` active — xem §8.2) + header `Cache-Control: no-store` | `400` query sai (`{ statusCode, message, fieldErrors }`) |
| GET | `/api/v1/workers/:id` | **ADMIN + PROJECT_MANAGER** | — | `200` worker profile (kèm `crews[]` active — xem §8.2) + header `Cache-Control: no-store` | `400` id sai; `404` |
| GET | `/api/v1/workers/:workerId/crews` | **ADMIN + PROJECT_MANAGER** | — | `200 { data[] }` liên kết đội (active only — xem §8.2) + header `Cache-Control: no-store` | `400` id sai; `404` worker |
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
| `POST /api/v1/crews/:id/members` | `ORG_CREW_MEMBER_ADDED` |
| `DELETE /api/v1/crews/:id/members/:memberId` | `ORG_CREW_MEMBER_REMOVED` (reason ở cột `audit_logs.reason`; `alreadyRemoved` không audit) |

## 7. Resource directory — ORG-SRS-005 (#28) bounded decisions

Quyết định đã chốt cho slice tra cứu nguồn lực (API slice; UI Web thuộc web slice riêng):

- **Role widen READ-only:** `GET` search + `GET` detail của workers/contractors/trades mở cho `ADMIN` + `PROJECT_MANAGER` (helper dùng chung `requireRoles(req, roles)` trong `iam/api/rest/guard/roles.guard.ts`; các write path giữ `assertAdmin`). Không refactor toàn bộ controller — chỉ các path widen.
- **Team filter defer #29 → resolved cho crews, còn defer cho workers (#30):** SRS yêu cầu lọc theo đội nhưng crew CRUD thuộc ORG-SRS-006 (`#29`, Should) — nay crews đã có endpoint search riêng (mục 8); param team filter ở `GET /workers` vẫn defer sang `#30`.
- **Team filter workers resolved ở `#30` (D9):** `GET /api/v1/workers` nhận thêm query `crewId` (uuid) = workers có ACTIVE membership trong đội đó (join `crew_members` `is_active`, mọi role LEAD/MEMBER đều tính); sai format → `400 { statusCode, message, fieldErrors: { crewId } }`. Defer `#28` đã đóng.
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
| GET | `/api/v1/crews` | **ADMIN + PROJECT_MANAGER** | query `status`, `search` (ILIKE code/name/description), `eligibleOnly`, `sort` (`name`→`name`, `createdAt`→`created_at`; default `createdAt`), `order` (`asc`/`desc`; default `desc`), `limit` (1-100, default 20), `offset` (≥0) | `200 { data[], total, limit, offset }` (mỗi profile kèm `leaderName` + `memberCount` — xem §8.2) + header `Cache-Control: no-store` | `400` query sai (`{ statusCode, message, fieldErrors }`) |
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
- Response crew profile: `{ id, code, name, description, contractorId, status, eligible, leaderUserId, createdBy, createdAt, updatedAt, warning? }` (`eligible` = đang ACTIVE; `warning` chỉ xuất hiện khi deactivate có open work). **GET list (§8.2, ORG-05)** kèm thêm `leaderName` (tên LEAD active, null khi chưa có LEAD) + `memberCount` (số member active); detail/create/update/status giữ nguyên shape (không có hai key này).
- Audit actions: `ORG_CREW_CREATED`, `ORG_CREW_UPDATED`, `ORG_CREW_LEAD_CHANGED`, `ORG_CREW_SUSPENDED`, `ORG_CREW_TERMINATED`, `ORG_CREW_REACTIVATED` (tx-embedded, correlation strict).
- **Hai shape 400 trên crews** (giống các slice trước, client parse cả hai): (a) body thiếu/rỗng field bị `ValidationPipe` chặn trước use-case → shape mặc định `{ message: string[], error, statusCode: 400 }` KHÔNG có `fieldErrors`; (b) field hợp lệ về format nhưng business-invalid (leader không tồn tại/inactive, contractor 404, query sai, thiếu reason) → shape `{ statusCode, message, fieldErrors }`.
- **Uniqueness policy cho `code`:** pre-check `findByCode` case-insensitive (chặt hơn DB — `ux_crews_code` là btree case-sensitive); giới hạn đã biết: hai create đồng thời với code chỉ khác chữ hoa/thường (`ABC`/`abc`) đều qua pre-check và DB chấp nhận cả hai.

### 8.1. Thành viên đội — ORG-SRS-007 (#30)

Quản lý thành viên đội (bảng `public.crew_members`, migration 0001 — không migration mới, không đổi constraint). Bounded decisions D1–D8 (Lead, binding):

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/crews/:id/members` | **ADMIN + PROJECT_MANAGER** | query `at` (`YYYY-MM-DD`), `includeInactive` (`true`/`1`) | `200 { data[], total }` + header `Cache-Control: no-store` | `400` `at` sai (`fieldErrors`); `404` đội |
| POST | `/api/v1/crews/:id/members` | **ADMIN + PROJECT_MANAGER** | `{ userId (uuid, bắt buộc), effectiveFrom? (ISO date, default today) }` | `201` member + `warning?` | `400`/`404`/`409` (xem rules) |
| DELETE | `/api/v1/crews/:id/members/:memberId` | **ADMIN + PROJECT_MANAGER** | JSON `{ effectiveTo? (ISO date, default today), reason? (1-500) }` | `200` member + `alreadyRemoved` | `400`/`404`/`409 MEMBER_IS_LEAD` |

- **D1 — chỉ MEMBER:** `member_role` luôn `'MEMBER'`; LEAD tiếp tục qua `PATCH /crews/:id` `leaderUserId` swap. `DELETE` vào row LEAD → `409 { code: 'MEMBER_IS_LEAD' }` (đổi trưởng nhóm qua sửa hồ sơ đội).
- **D2 — xóa mềm:** `DELETE` đặt `is_active=false`, `effective_to=<given>`; row KHÔNG bao giờ bị xóa. Đã inactive → `200 { alreadyRemoved: true }`, không audit, không mutation.
- **D3 — overlap WARN:** user đang active ở đội KHÁC → vẫn `201` kèm `warning: { code: 'MEMBER_IN_OTHER_CREW', otherCrews: [{ crewId, crewCode, crewName }] }` + `_warning` trong audit afterData. Trùng active trong CÙNG đội → `409 { code: 'MEMBER_DUPLICATE' }` (pre-check + race guard `23505`/`ux_crew_member_active`, constraint-order trước generic `23505`).
- **D4 — điều kiện tạo:** đội phải `ACTIVE` (ngược lại `409 { code: 'CREW_INACTIVE' }`); user phải tồn tại, `user_type` STAFF/WORKER (ngược lại `404 { code: 'USER_NOT_FOUND' }`) và `status='ACTIVE'` (ngược lại `409 { code: 'USER_INACTIVE' }`). Re-check crew `SELECT ... FOR UPDATE` trong tx ngay trước insert.
- **D5 — ngày hiệu lực:** `effectiveFrom`/`effectiveTo` phải là ISO date hợp lệ lịch; `effectiveTo >= effectiveFrom` (sai → `400` `fieldErrors`); vi phạm `crew_members_effective_dates_ck`/`revocation_ck` → `400`. Lỗi DB/I-O khác → `500` (không `400`).
- **D6 — tra cứu:** default chỉ active (`id`, `userId`, `memberRole`, `effectiveFrom`, `effectiveTo`, `isActive`, `addedBy`, `createdAt` + `userName`/`userCode` join từ users). `?at=` point-in-time (`[effective_from, effective_to]` INCLUSIVE hai đầu, `effective_to` NULL = open-ended, bất kể `is_active`). `includeInactive=true` toàn bộ lịch sử, `effective_from DESC`.
- **D7 — roles:** đọc + ghi dùng chung `CREW_ROLES` (`ADMIN` + `PROJECT_MANAGER`; SRS actor Điều phối viên — như crews `#29`).
- **D8 — audit:** `ORG_CREW_MEMBER_ADDED` (before `null`, after member row + `crew code`) / `ORG_CREW_MEMBER_REMOVED` (before/after + `crew code`, `reason` ở cột `audit_logs.reason`), `entityType` `CREW`, `entityId` = crewId, tx-embedded `logWithClient`; audit thất bại → `500` rollback.
- Hai shape `400` như crews mục 8 (ValidationPipe shape không `fieldErrors` cho body sai format; business-invalid có `fieldErrors`).

### 8.2. Liên kết Worker ↔ Crew — ORG-03/ORG-05, BR-06 (BRD C2)

Nối liên kết Worker ↔ Crew phục vụ điều phối (tra cứu đội của worker + enrichment hai chiều). KHÔNG đổi nghiệp vụ add/remove member và leader-swap (D1 `#30` giữ nguyên: member mới luôn `MEMBER`, `LEAD` chỉ qua `PATCH /crews/:id` `leaderUserId`). KHÔNG đụng eligibility (§9).

| Method | Path | Auth | Response | Lỗi |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/workers/:workerId/crews` | **ADMIN + PROJECT_MANAGER** (mirror `GET /workers/:id`) | `200 { data[] }` — xem W1 + header `Cache-Control: no-store` | `400` id sai; `404` worker |

`data[]` item: `{ crewId, crewCode, crewName, crewStatus ('ACTIVE'│'INACTIVE'), memberRole ('LEAD'│'MEMBER'), effectiveFrom ('YYYY-MM-DD'), effectiveTo ('YYYY-MM-DD'│null) }`.

Worker profile (`GET /workers` list + `GET /workers/:id` detail) kèm `crews[]`: `[{ crewId, crewCode, crewName, memberRole }]` (active only).

Crews list (`GET /crews`) kèm `leaderName` (`string`│null — tên LEAD đang hiệu lực, null khi đội chưa có LEAD) + `memberCount` (`number` — COUNT `crew_members` active, mọi role LEAD/MEMBER đều tính).

- **W1 — endpoint mới read-only:** `GET /api/v1/workers/:workerId/crews` qua `GetWorkerCrewsUseCase` (pattern `GetWorkerOpenWorkUseCase`): worker không tồn tại → `404 'Không tìm thấy hồ sơ worker'` (không gọi memberships); worker chưa thuộc đội nào → `200 { data: [] }`. Chỉ active memberships (`is_active`); lịch sử cũ (`is_active=false`) KHÔNG trả. KHÔNG transaction, KHÔNG ghi `audit_logs`.
- **W2 — guard mirror detail:** `requireRoles(req, ['ADMIN','PROJECT_MANAGER'])` như `GET /workers/:id` (WORKER-role → `403`, anon → `401` via `JwtAuthGuard`). `X-Correlation-Id` miễn (read-only, không audit — như open-work).
- **W3 — repo method mới `findMembershipsByUser`** (mirror `findActiveMembershipsOfUserWithClient` nhưng bỏ `excludeCrewId`, thêm `role`/`dates`/`crew status`): pool read `crew_members is_active JOIN crews` (lấy `c.status`), `ORDER BY effective_from DESC`. Detail enrichment (`GetWorkerUseCase`) dùng lại method này rồi rút gọn còn `{ crewId, crewCode, crewName, memberRole }`.
- **W4 — list tránh N+1:** `SearchWorkersUseCase` batch MỘT query `findMembershipsByUserIds(ids)` (`user_id = ANY($1::uuid[])`) cho cả trang rồi nhóm theo userId (trang rỗng → không query); `SearchCrewsUseCase` batch MỘT query `findListEnrichments(ids)` (`LEFT JOIN` LEAD active → `users.full_name` + scalar `COUNT` member active). Đội thiếu enrichment → `{ leaderName: null, memberCount: 0 }`; worker thiếu map → `crews: []`.
- **W5 — mapper/DTO:** `toWorkerDetailResponse` (detail) + `toWorkerListResponse(entities, crewsByUserId?)` (list) — `create`/`update`/`status` giữ `toWorkerResponse` cũ (không có key `crews`); `toCrewListResponse(entities, enrichments?)` — `detail`/`create`/`update`/`status` giữ `toCrewResponse` cũ (không có `leaderName`/`memberCount`). Enrichment đi kèm entity (precedent `managerName` PRJ-SRS-001 P8), KHÔNG đổi `CrewEntity`/`WorkerEntity`.
- **W6 — BR-06 bảo toàn:** endpoint và enrichment chỉ ĐỌC `crew_members`/`crews`; add/remove member, leader-swap và lifecycle giữ nguyên (D1 `#30`, lifecycle `#29`). Đội `INACTIVE` vẫn liệt kê trong `data[]` (kèm `crewStatus`) — assignment gate thuộc slice JOB tương lai, không chặn ở đây.

## References

- [`docs/architecture/API.md`](API.md) — module/domain conventions, audit policy (8.2/8.3/8.4/8.5)
- [`docs/architecture/NETCODE.md`](NETCODE.md) — transport/error contract
- SRS/issue: workers `#24`, contractors `#25`, trades `#26`, lifecycle `#27`, resource directory `#28`, crews `#29`

## 9. Eligibility — ORG-SRS-008 (#31) bounded decisions

Dữ liệu điều kiện nhận việc cho worker và crew (advisory pre-check phục vụ điều phối; KHÔNG có module JOB/assignments — assignment CREATE thuộc slice JOB-SRS tương lai).

| Method | Path | Auth | Query | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/eligibility/workers/:workerId` | **ADMIN + PROJECT_MANAGER** | `tradeId` (uuid), `skillLevel` (1-5), `at` (`YYYY-MM-DD`, default today) | `200` worker eligibility + header `Cache-Control: no-store` | `400` query sai (`fieldErrors`); `404` `RESOURCE_NOT_FOUND` |
| GET | `/api/v1/eligibility/me` | JWT bắt buộc, **mọi role** (server resolve worker theo JWT `sub`) | như trên | `200` worker eligibility + header `Cache-Control: no-store` | `400` query sai; `404` `RESOURCE_NOT_FOUND` (`user không có hồ sơ worker`) |
| GET | `/api/v1/eligibility/crews/:crewId` | **ADMIN + PROJECT_MANAGER** | — | `200` crew eligibility + header `Cache-Control: no-store` | `404` `RESOURCE_NOT_FOUND` |

Response worker:

```json
{
  "resourceType": "WORKER",
  "resourceId": "11111111-1111-4111-8111-111111111111",
  "eligible": true,
  "checkedAt": "2026-09-06T00:00:00.000Z",
  "correlationId": "6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b",
  "conditions": [
    { "code": "RESOURCE_ACTIVE", "passed": true, "reasonCode": "OK", "detail": "..." }
  ],
  "crews": [
    { "crewId": "…", "crewCode": "CREW-A", "crewName": "Đội A", "memberRole": "MEMBER", "effectiveFrom": "2026-09-01", "effectiveTo": null }
  ]
}
```

Response crew: cùng shape với `resourceType: 'CREW'` và `members[]` (`memberId`, `userId`, `memberRole`, `effectiveFrom`, `effectiveTo`) thay cho `crews[]`.

- **E1 — conditions worker (đúng thứ tự):** `RESOURCE_ACTIVE` (users.status ACTIVE + user_type WORKER + không khóa; `INACTIVE`→`RESOURCE_INACTIVE`, `LOCKED`→`RESOURCE_LOCKED`; worker/user không tồn tại → `404` cả request); `TRADE_SKILL_MATCH` (chỉ khi có `tradeId`/`skillLevel`: trade không có trong catalog → `TRADE_NOT_FOUND`, trade có nhưng worker không có row hiệu lực → `TRADE_INACTIVE`, cấp thấp hơn yêu cầu → `SKILL_LEVEL_TOO_LOW`; không yêu cầu → `passed:null` `NOT_REQUESTED`); `TRADE_CAPABILITY_DATA` (0 trade hiệu lực → `passed:false` `CAPABILITY_DATA_MISSING`, fail closed); `WORKLOAD` (đếm open assignments `PENDING_ACCEPTANCE`/`ACTIVE`, luôn `passed:true`, KHÔNG ngưỡng); `SCHEDULE_CONFLICT` (luôn `passed:null` `NOT_EVALUABLE`). `eligible` = AND trên mọi `passed === false` (null bỏ qua). `crews[]` = memberships hiệu lực lọc point-in-time theo `at` (`[effective_from, effective_to]` INCLUSIVE, NULL = open-ended — logic `#30`).
- **E2 — `/me`:** resolve worker theo JWT `sub` (claim `TokenPayload.sub`; roles server-derived); không check role; thiếu worker row → `404` `RESOURCE_NOT_FOUND`. `X-Correlation-Id`: reuse khi là UUID, ngược lại generate mới (lenient — read-only, không audit nên không `400` như strict policy).
- **E3 — conditions crew:** `RESOURCE_ACTIVE` (crews.status), `TRADE_CAPABILITY_DATA` (≥1 trade `resource_type='CREW'` hiệu lực), `WORKLOAD` (countOpenAssignments đội), `MEMBER_COVERAGE` (≥1 active member, LEAD/MEMBER đều tính qua `listMembers` default active — 0 member → `NO_ACTIVE_MEMBERS`), `SCHEDULE_CONFLICT` `NOT_EVALUABLE`.
- **E4 — read-only:** use case chỉ pool reads (`findById`, catalog trade, `countOpenAssignments`, memberships/trades) — KHÔNG transaction, KHÔNG ghi `audit_logs`; mọi GET trả `Cache-Control: no-store`.
- **E5 — roles:** xem bảng trên (`requireRoles`; `/me` chỉ `JwtAuthGuard`).
- **JOB-SRS future scope (KHÔNG thuộc slice này):** assignment CREATE, snapshot persistence, atomic re-check-at-write, schedule conflict evaluation, workload limit/threshold. Kết quả eligibility là advisory pre-check, KHÔNG phải authorization — assignment creation phải re-check server-side trước khi ghi.

## 10. Projects — PRJ-SRS-001 (#32) bounded decisions

Tạo và cập nhật dự án (API slice; lifecycle trạng thái thuộc `#33` PRJ-SRS-002, project-scope write checks thuộc `#37` PRJ-SRS-006).

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/projects` | **ADMIN + PROJECT_MANAGER** | `{ code, name, description?, address, timezone?, plannedStartDate, plannedEndDate, managerId }` | `201` project profile (`status` luôn `DRAFT`) | `400` validation (fieldErrors); `409` trùng code (`PROJECT_CODE_DUPLICATE`) |
| PATCH | `/api/v1/projects/:id` | **ADMIN + PROJECT_MANAGER** | `{ name?, description?, address?, timezone?, plannedStartDate?, plannedEndDate?, managerId? }` | `200` project profile | `400` (gồm `code`/`status` trong body → fieldErrors); `404`; `409` n/a |

Response project profile (P8): `{ id, code, name, description, address, timezone, plannedStartDate, plannedEndDate, managerId, managerName (join users.full_name), status, createdBy, createdAt, updatedBy, updatedAt }`.

- **P1 — module mới `src/api/src/modules/prj/`** (clean architecture: domain entity + application use-cases + api-rest controller/dto/mapper + infrastructure pg repository, mirror org module). Sở hữu POST và PATCH. **Reads (`GET /api/v1/projects`, `GET /:id`) ở lại iam** (`ProjectsController`, scope-integrated qua `ProjectScopeService`) — không đụng GET routes/behavior. Ghi chú migration tương lai: gom reads sang prj khi project-scope write checks (#37) hoàn tất.
- **P2 — write roles = ADMIN + PROJECT_MANAGER** qua `requireRoles` (crews precedent); STAFF/WORKER → `403`, anon → `401`. Per-project scope cho PATCH enforce từ #37 (PRJ-SRS-006, xem §15): ADMIN bypass (audited) HOẶC ACTIVE member MANAGER/COORDINATOR; `POST` create giữ nguyên (chưa có project-scope — PM tạo project tự thành MANAGER membership qua P9).
- **P3 — create luôn `status='DRAFT'`** (client không set được; DTO whitelist + `forbidNonWhitelisted`). **PATCH whitelist:** name, description, address, timezone, plannedStartDate, plannedEndDate, managerId — `code` bất biến, `status` thuộc lifecycle #33; `code`/`status` có mặt trong PATCH body → `400` fieldErrors explicit (không silent-ignore).
- **P4 — validation server-side (400 fieldErrors TRƯỚC DB):** code bắt buộc 2-50 `^[A-Za-z0-9_-]+$`; name 1-200; address 1-500; description optional ≤2000; timezone optional ≤64 (default `Asia/Ho_Chi_Minh`); planned dates bắt buộc ISO `YYYY-MM-DD` hợp lệ lịch, end >= start; managerId bắt buộc uuid trỏ tới user `status='ACTIVE'`, ngược lại 400 fieldErrors `{managerId}`. Trùng mã: pre-check case-insensitive (`lower(code)`) → 409 `{ code: 'PROJECT_CODE_DUPLICATE' }`; race 23505/`ux_projects_code` → cùng 409 (constraint-cụ-thể-trước rule #29/#30); lỗi DB khác → 500.
- **P5 — audit `PRJ_PROJECT_CREATED` / `PRJ_PROJECT_UPDATED`**, `entityType` `PROJECT`, tx-embedded `logWithClient`, before/afterData (update: full before row vs after; create: afterData), actor từ request; audit thất bại → 500 rollback (catch-all). Update trong tx: `SELECT ... FOR UPDATE` row hiện tại, apply, save, audit.
- **P6 — không hard delete; không optimistic-locking ở slice này** (SRS chỉ yêu cầu cho Job Board; last-write-wins + `updated_at`; defer note). Strict `X-Correlation-Id` trên writes (sai UUID → 400). `updatedBy` = actor của PATCH (response-level: `projects` không có cột `updated_by`, P7 không migration mới; CREATE thì `updatedBy` = `createdBy`).
- **P7 — entity `ProjectEntity`** với invariants (code format, required fields, dates) + policy `project.policy.ts` (mirror crew-member.policy style). Không migration mới.
- **P8 — ProjectProfileDto** như response bảng trên.
- **P9 — manager auto-membership khi CREATE (cùng tx):** POST insert thêm row `project_members` (`project_id` mới, `user_id=managerId`, `project_role='MANAGER'`, `is_active=true`, `added_by=actor`, `joined_at` default now) sau project insert, trước audit — manager hiển nhiên là thành viên dự án, đồng thời unlock iam project-scope visibility cho manager. Asymmetry: PATCH đổi `managerId` KHÔNG đụng memberships (defer `#36` PRJ-SRS-005 Quản lý thành viên dự án).
- Hai shape `400` như các slice trước (ValidationPipe shape không `fieldErrors` cho body thiếu/sai format cơ bản; business-invalid có `fieldErrors`).

## 11. Project lifecycle — PRJ-SRS-002 (#33) bounded decisions

Lifecycle trạng thái dự án. Enum DB giữ nguyên (`projects.status CHECK IN ('DRAFT','ACTIVE','PAUSED','COMPLETED','CLOSED')` — không migration). Reuse shape org precedent (`resource-status.policy.ts` + `status-transition-*.use-case.ts` #27: transition map, reason mandatory, `alreadyInState`, `_warning` — ở đây không có warning/open-work vì chưa có module WO/JOB).

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| PATCH | `/api/v1/projects/:id/status` | **ADMIN + PROJECT_MANAGER** | `{ action: 'ACTIVATE' \| 'PAUSE' \| 'RESUME' \| 'COMPLETE' \| 'CLOSE' \| 'REOPEN', reason? }` | `200` project profile + `alreadyInState` | `400` action sai/thiếu reason; `404`; `409 INVALID_TRANSITION`; `400` X-Correlation-Id sai |

Transition table (L1 — duy nhất được phép):

| Từ | Action | Tới | Reason |
| --- | --- | --- | --- |
| `DRAFT` | `ACTIVATE` | `ACTIVE` | optional |
| `DRAFT` | `CLOSE` (hủy nháp) | `CLOSED` | **bắt buộc** |
| `ACTIVE` | `PAUSE` | `PAUSED` | **bắt buộc** |
| `ACTIVE` | `COMPLETE` | `COMPLETED` | optional |
| `PAUSED` | `RESUME` | `ACTIVE` | optional |
| `COMPLETED` | `CLOSE` | `CLOSED` | **bắt buộc** |
| `CLOSED` | `REOPEN` | `ACTIVE` | **bắt buộc** |

- **L1 — endpoint + map mới:** `PATCH /api/v1/projects/:id/status`, body `{action, reason? (1-500)}` như bảng trên. Action chưa biết → `400`; action biết nhưng không hợp lệ với trạng thái hiện tại → `409 { code: 'INVALID_TRANSITION', allowedTransitions: [...] }`. Thiếu reason nơi bắt buộc → `400 fieldErrors {reason}`.
- **L2 — roles = PROJECT_WRITE_ROLES** (`ADMIN` + `PROJECT_MANAGER`, crews precedent — khác write admin-only của workers/contractors/trades). Per-project scope write check enforce từ `#37` (PRJ-SRS-006, xem §15): ADMIN bypass (audited) HOẶC ACTIVE member MANAGER/COORDINATOR.
- **L3 — idempotent org-pattern:** action nhắm đúng trạng thái hiện tại (vd `PAUSE` khi đã `PAUSED`, `ACTIVATE`/`RESUME`/`REOPEN` khi đã `ACTIVE`) → `200 {alreadyInState: true}`, không mutation, không audit. Xung đột trạng thái khác → 409 map L1. Lặp action khi đã ở trạng thái đích → alreadyInState kể cả khi thiếu reason (no-op; reason chỉ bắt buộc cho transition hiệu lực).
- **L4 — audit `PRJ_PROJECT_STATUS_CHANGED`**, `entityType` `PROJECT`, tx-embedded (`logWithClient`), before/after full rows chứa `{status}`, `reason` ở cột `audit_logs.reason`, actor từ request; audit thất bại → `500` rollback (catch-all). Tx re-read `SELECT ... FOR UPDATE` row mới nhất trước khi apply — race đổi trạng thái giữa pre-read và tx → đánh giá lại (alreadyInState hoặc 409 map per SRS).
- **L5 — history = `audit_logs` append-only** (không bảng transitions riêng).
- **L6 — 'Dự án Đóng không tạo Work Order mới':** chưa có module WO/JOB nên chưa enforce server-side; defer sang các slice JOB — assignment CREATE (tương lai) phải re-check status dự án (`CLOSED` không tạo WO mới) trước khi ghi.
- Use-case `transition-project-status.use-case.ts` (+ pure transition map/reason policy trong `project.policy.ts`). Entity `changeStatus(target)` validate đích nằm trong map (ném Error → 409).
- Response = ProjectProfileDto (P8) + `alreadyInState`.

## 12. Project members — PRJ-SRS-005 (#36) bounded decisions

Quản lý thành viên dự án (API slice; per-project scope write checks thuộc `#37` PRJ-SRS-006). Bảng `public.project_members` (migration 0001 — không migration mới, không đổi constraint): `project_role CHECK IN ('MANAGER','COORDINATOR','QC','WORKER','VIEWER')`, partial unique `ux_project_members_active (project_id, user_id) WHERE is_active`, `revocation_ck (is_active OR left_at IS NOT NULL)`, `membership_dates_ck (left_at IS NULL OR left_at >= joined_at)`. Closest precedent: org crew members `#30` (add/remove/list use-cases + idempotent `alreadyRemoved` + constraint-order 23505 + audit shape) — slice này mirror cấu trúc đó.

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/projects/:id/members` | **ADMIN + PROJECT_MANAGER** | query `includeInactive` (`true`/`1`) | `200 { data[], total }` + header `Cache-Control: no-store` | `404` dự án |
| POST | `/api/v1/projects/:id/members` | **ADMIN + PROJECT_MANAGER** | `{ userId (uuid, bắt buộc), projectRole: 'COORDINATOR' \| 'QC' \| 'WORKER' \| 'VIEWER' }` | `201` member | `400`/`404`/`409` (xem rules) |
| DELETE | `/api/v1/projects/:id/members/:memberId` | **ADMIN + PROJECT_MANAGER** | JSON `{ reason? (1-500, optional) }` | `200` member + `alreadyRemoved` | `400`/`404`/`409 MANAGER_MEMBER` |

Response `ProjectMemberDto`: `{ id, userId, userName, userCode, projectRole, joinedAt, leftAt, isActive, addedBy, createdAt }` (`joinedAt`/`leftAt` ISO từ timestamptz; `userName`/`userCode` join `users.full_name`/`employee_code`; `createdAt` = `joined_at` vì bảng không có cột `created_at` riêng).

- **M1 — endpoints mới trong prj controller:** `GET /api/v1/projects/:id/members` (default active-only; `?includeInactive=true` toàn bộ lịch sử, cả hai sắp `joined_at` DESC), `POST /projects/:id/members` (`201`; `projectRole` chỉ 4 role non-MANAGER — `'MANAGER'` → `400` fieldErrors `{projectRole}` `'Quản lý dự án chỉ đặt qua PATCH /projects/:id managerId'`), `DELETE /projects/:id/members/:memberId` (`reason` optional 1-500).
- **M2 — xóa mềm:** `DELETE` đặt `is_active=false`, `left_at=CURRENT_TIMESTAMP`; row KHÔNG bao giờ bị xóa. Đã inactive (non-manager) → `200 {alreadyRemoved:true}`, không mutation, không audit (mirror crews `#30`). **Deviation đã duyệt khi implement:** M2 gốc ghi `left_at=CURRENT_DATE`, nhưng `left_at` là timestamptz và `membership_dates_ck` yêu cầu `left_at >= joined_at` — `CURRENT_DATE` (nửa đêm) vi phạm check khi remove trong cùng ngày join; `CURRENT_TIMESTAMP` thỏa cả `revocation_ck` lẫn `membership_dates_ck`, giữ nguyên semantics M2 (soft-deactivate, giữ lịch sử).
- **M3 — validations server-side:** project không tồn tại → `404`; user không tồn tại hoặc `users.status ≠ 'ACTIVE'` → `400` fieldErrors `{userId}` (khác crews `#30` dùng `404 USER_NOT_FOUND`/`409 USER_INACTIVE`); trùng ACTIVE membership cùng project → `409 {code:'MEMBER_DUPLICATE'}` (pre-check + race guard `23505`/`ux_project_members_active`, constraint-order trước generic `23505`); GUARD: row có `user_id == projects.manager_id` → `409 {code:'MANAGER_MEMBER'}` (mirror `MEMBER_IS_LEAD` `#30`; chạy trước nhánh idempotent nên membership của manager dù đã inactive vẫn `409`).
- **M4 — P11 từ `#32`, implement tại slice này:** `update-project.use-case` — khi `managerId` THẬT SỰ đổi, trong CÙNG tx (sau save, trước audit): nếu manager mới chưa có ACTIVE membership trong project → insert `project_members` (`project_role='MANAGER'`, `is_active=true`, `added_by=actor`). Membership của manager cũ giữ nguyên (document — không deactivate). Đã là member → không insert (idempotent; race chỉ swallow khi constraint name khớp `ux_project_members_active`, bare `23505` rethrow). Asymmetry P9 (`#32`) đã đóng. `PRJ_PROJECT_UPDATED` afterData kèm `managerMembership: { userId, autoInserted }` (`autoInserted=true` khi insert thành công, `false` khi đã là member).
- **M5 — roles = PROJECT_WRITE_ROLES** (`ADMIN` + `PROJECT_MANAGER`, crews precedent) trên cả 3 member endpoints (kể cả GET list); per-project scope enforce từ `#37` (xem §15): writes (POST/DELETE) = ADMIN bypass (audited) HOẶC ACTIVE member MANAGER/COORDINATOR; GET list mở cho mọi ACTIVE member + ADMIN. Strict `X-Correlation-Id` trên writes (POST/DELETE sai UUID → `400`; GET list miễn). Closed project: add/remove membership vẫn cho phép (document — không check status; 'CLOSED không tạo WO mới' vẫn defer slice JOB theo L6).
- **Input cho `#37`:** add-member chỉ kiểm tra `users.status='ACTIVE'`, không gate `user_type` — mọi ACTIVE user (kể cả `ADMIN`) đều thêm được; revisit khi per-project scope (`#37`) landing.
- **M6 — audit `PRJ_PROJECT_MEMBER_ADDED` / `PRJ_PROJECT_MEMBER_REMOVED`**, `entityType` `PROJECT`, `entityId`=projectId, tx-embedded `logWithClient` (fail closed — thiếu adapter → `500`), before/afterData = member row + `projectCode` (add: before null; remove: `reason` ở cột `audit_logs.reason`); catch-all audit fail → `500` rollback. Tx với `FOR UPDATE` trên project row (mirror status use-case `#33`).
- New: `ProjectMemberRow` type trên port + `add-project-member.use-case.ts`, `remove-project-member.use-case.ts`, `list-project-members.use-case.ts` (+ policy helpers `project-member.policy.ts`).
- Hai shape `400` như các slice trước (ValidationPipe shape không `fieldErrors` cho body thiếu/sai format cơ bản; business-invalid có `fieldErrors`).

## 13. Project areas — PRJ-SRS-003 (#34) bounded decisions

Quản lý khu vực/hạng mục của dự án (một cấp duy nhất — không có cấp con). API slice; UI Web thuộc web slice riêng. Closest precedent: project members `#36` (use-case/tx/audit shape) + project code uniqueness `#32` (P4).

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/projects/:projectId/areas` | JWT bắt buộc, **mọi ACTIVE member** (mọi role — xem A4) | query `activeOnly` (`true`/`1`) | `200 { data[], total }` + header `Cache-Control: no-store` | `404` dự án; `403` ngoài scope |
| POST | `/api/v1/projects/:projectId/areas` | **ADMIN + PROJECT_MANAGER** (+ scope A4) | `{ code?, name }` | `201` area | `400`/`404`/`403`/`409` (xem rules) |
| PATCH | `/api/v1/projects/:projectId/areas/:areaId` | **ADMIN + PROJECT_MANAGER** (+ scope A4) | `{ name?, code?, isActive?, reason? }` | `200` area + `alreadyInactive` | `400`/`404`/`403`/`409` (xem rules) |

Response `ProjectAreaDto`: `{ id, projectId, code (null = không mã), name, isActive, createdAt, updatedAt }` (ISO từ timestamptz; `isActive=false` = đã retire, flag giữ lịch sử).

- **A1 — endpoints mới trong prj controller** (reads `GET /projects`/`GET /:id` vẫn ở lại iam — không đụng): `GET` default kèm inactive (sắp `is_active DESC, name ASC`); `?activeOnly=true` chỉ active (future Work Order picker, sắp `name ASC`); `POST` (`201`, body `{code? (1-50 `^[A-Za-z0-9_-]+$`), name (bắt buộc 1-150)}`); `PATCH` (`{name? (rename tại chỗ), code? (null = gỡ mã), isActive? (toggle), reason? (1-500)}`). Không có DELETE — soft-retire (deactivate) là đường xóa duy nhất.
- **A2 — một cấp + không hard delete (schema-enforced):** bảng `project_areas` KHÔNG có cột `parent_id` nên cấp thứ hai không thể tồn tại (không cần CHECK — document). FK `fk_project_areas_project_id ... ON DELETE RESTRICT` chặn xóa project còn areas. `work_orders.area_id` tham chiếu area nhưng module JOB chưa tồn tại nên usage count = 0 hôm nay; **hard delete bị cấm vĩnh viễn kể cả khi JOB landing** (areas bị WO tham chiếu không được hard-delete — retire thay thế).
- **A3 — uniqueness + constraint-order:** expression partial unique `ux_project_areas_active_name_ci (project_id, lower(name)) WHERE is_active` (migration 0006 — **DB-enforced case-insensitive**, đóng case-race của 0005: hai create đồng thời chỉ khác chữ hoa/thường không còn lọt qua DB; inactive giữ lịch sử, không chặn tái dùng tên) + `CHECK project_areas_name_ck (btrim(name) <> '')`. Trùng tên active → `409 {code:'AREA_DUPLICATE'}` (pre-check case-insensitive trong tx — cùng rule với DB, precedent P4 `#32`; race guard map đúng tên constraint). Trùng mã (index `ux_project_areas_project_code` KHÔNG partial — inactive vẫn giữ mã) → `409 {code:'AREA_CODE_DUPLICATE'}`. **Constraint cụ thể trước, bare `23505` rethrow (500)** — không swallow như members (quyết định slice này).
- **A4 — scope (deviation khỏi members M5, có lý do):** members M5 roles-only (scope defer `#37`); areas enforce membership ngay: ADMIN bypass, mọi role còn lại (kể cả PROJECT_MANAGER) phải có ACTIVE membership trong project — ngược lại `403` (project không tồn tại → `404` trước — thứ tự 404-trước-403 được giữ cố ý). **Residual đã chấp nhận:** thứ tự này cho phép kẻ gọi phân biệt project tồn tại/không tồn tại (existence oracle); chấp nhận được vì project id là UUID không đoán được (không liệt kê), không có endpoint list-all cho ngoài scope. Reads mở cho mọi ACTIVE member (kể cả WORKER — WO picker tương lai phục vụ cả worker), khác GET members (ADMIN+PM). Members đã align khi `#37` landing (§15). Từ #37, areas dùng chung `ProjectScopeService.assertProjectMemberScope` (API scope chung iam+prj): writes audit bypass, reads (`GET` list) bypass không audit (tránh ồn — decision §15 C); re-check membership trong cùng tx sau lock (revoke mid-flight → 403 rollback).
- **A5 — closed project:** add/update/deactivate area vẫn cho phép (không check status — precedent M5; 'CLOSED không tạo WO mới' vẫn defer slice JOB theo L6).
- **A6 — audit `PRJ_PROJECT_AREA_ADDED` / `PRJ_PROJECT_AREA_UPDATED`**, `entityType` `PROJECT`, `entityId`=projectId, tx-embedded `logWithClient` (fail closed — thiếu adapter → `500`), before/afterData = area row + `projectCode` (add: before null; update: `reason` ở cột `audit_logs.reason` và trong `afterData` khi gửi); catch-all audit fail → `500` rollback. Tx với `FOR UPDATE` trên project row (create) / area row (update). Idempotent: double-deactivate → `200 {alreadyInactive:true}`, không mutation, không audit (mirror `alreadyRemoved` `#30`/`#36`); PATCH không thay đổi hiệu lực → no-op không audit. **`reason` trên các đường no-op / deactivate-repeat bị bỏ qua cố ý** (idempotent repeat, không ghi audit row — nhất quán precedent L1 idempotency-wins: no-op kể cả khi thiếu reason).
- Hai shape `400` như các slice trước (ValidationPipe shape không `fieldErrors` cho body thiếu/sai format cơ bản; business-invalid có `fieldErrors`). Strict `X-Correlation-Id` trên writes (POST/PATCH sai UUID → `400`; GET list miễn).

## 14. Work types — PRJ-SRS-004 (#35) bounded decisions

Quản lý loại công việc: tên/mã + nhóm công việc + yêu cầu kỹ năng + danh sách dữ liệu bắt buộc + version cấu hình. API slice; UI Web thuộc web slice riêng. Closest precedent: trades `#26` (entity/repo/audit shape) + project areas `#34` (409 code shape, idempotency, audit tx-embedded).

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/work-types` | **ADMIN + PROJECT_MANAGER** | `{ code, name, description?, group?, requiredTradeId?, requiredFields?, defaultDurationMinutes?, defaultPriority? }` | `201` work-type profile | `400`; `409` trùng `code` |
| GET | `/api/v1/work-types` | **ADMIN + PROJECT_MANAGER** | query `status` (`ACTIVE`/`INACTIVE`/`ALL`, thiếu = ALL), `group` (khớp chính xác), `tradeId` (uuid), `search` (ILIKE code/name), `limit` (1-100, default 20), `offset` (≥0) — sort cố định `ORDER BY name` | `200 { data[], total, limit, offset }` + header `Cache-Control: no-store` | `400` query sai (`{ statusCode, message, fieldErrors }`) |
| GET | `/api/v1/work-types/active` | **ADMIN + PROJECT_MANAGER** | — (picker cho JOB: chỉ active, `ORDER BY name`) | `200 { data[], total }` + header `Cache-Control: no-store` | `401`/`403` |
| GET | `/api/v1/work-types/:id` | **ADMIN + PROJECT_MANAGER** | — | `200` work-type profile + `usage: { workOrders }` + header `Cache-Control: no-store` | `400` id sai; `404` |
| PATCH | `/api/v1/work-types/:id` | **ADMIN + PROJECT_MANAGER** | `{ code?, name?, description?, group?, requiredTradeId?, requiredFields?, defaultDurationMinutes?, defaultPriority?, expectedConfigVersion?, reason? }` | `200` work-type profile + `versionChanged` (+ `warning?`) | `400`; `404`; `409` trùng code / conflict version |
| POST | `/api/v1/work-types/:id/status` | **ADMIN + PROJECT_MANAGER** | `{ action: 'ACTIVATE' \| 'DEACTIVATE', reason? }` | `200` work-type profile + `alreadyInState` (+ `warning?`) | `400` action sai; `404` |

Response work-type profile: `{ id, code, name, description, group, requiredTradeId, requiredFields, configVersion, defaultDurationMinutes, defaultPriority, status, usableForNewWorkOrder, createdAt, updatedAt, usage?, warning?, alreadyInState? }` (`usableForNewWorkOrder` = đang ACTIVE; `warning` chỉ khi deactivate/config-đổi đang bị WO tham chiếu; `alreadyInState` chỉ ở status endpoint).

- **W1 — schema (migration 0007, chỉ ADD cột):** bảng `work_types` baseline 0001 đã có `code/name/description/required_trade_id/default_duration_minutes/default_priority/is_active`; migration thêm `work_type_group text NULL` (nhóm công việc, expose nguyên trạng, không CRUD riêng), `required_fields jsonb NOT NULL DEFAULT '[]'` (shape `{key,label,type}` validate ở app layer — policy + entity + repo guard — không DB CHECK để JOB/QUA thêm field kind không cần đổi schema), `config_version integer NOT NULL DEFAULT 1` + `CHECK (config_version >= 1)`. Không đụng FK/index hiện có (`ux_work_types_code`, `ix_work_types_trade_active`, `work_types_required_trade_id_fkey` giữ nguyên). Cột baseline khác (`default_duration_minutes`, `default_priority`) expose nguyên trạng trong DTO, không CRUD riêng.
- **W2 — uniqueness + constraint-order:** pre-check `findByCode` case-insensitive (`lower(code)`) + race guard trong tx map đúng tên `ux_work_types_code` → `409 {code:'WORK_TYPE_CODE_DUPLICATE'}`; **constraint cụ thể trước, bare `23505` rethrow** (precedent areas A3). **Residual đã chấp nhận:** `ux_work_types_code` là btree case-sensitive nên hai create đồng thời chỉ khác chữ hoa/thường có thể cùng lọt DB (case-race như areas pre-0006); sequential behavior vẫn CI-unique. Follow-up: expression index `(lower(code))` kiểu 0006 nếu owner yêu cầu.
- **W3 — trade validation:** `requiredTradeId` null = không yêu cầu skill; khi gửi phải là UUID trade **tồn tại VÀ `is_active`** — ngược lại `400 fieldErrors {requiredTradeId: 'Ngành nghề không tồn tại hoặc đã ngừng hoạt động'}` (check qua `findActiveTradeById` đọc trực tiếp `public.trades`, không import org module — seam contract cho JOB publish JOB-SRS-002).
- **W4 — optimistic locking (pre-check + SQL guard):** `PATCH` nhận `expectedConfigVersion` optional; mismatch ở pre-check → `409 {code:'WORK_TYPE_CONFIG_CONFLICT', fieldErrors:{expectedConfigVersion}}` (hai admin cập nhật đồng thời — không mất thay đổi). Không gửi = last-write-wins. Guard thật ở `PgWorkTypeRepository.save`: khi có expected → `UPDATE ... WHERE id=$ AND config_version=$expected`; rowcount 0 sau khi pass pre-check (race đồng thời) → 409 cùng code (đọc lại version hiện tại cho message). Config-relevant field đổi (code/name/group/requiredTradeId/requiredFields) → `config_version` +1 (`versionChanged: true`); chỉ đổi description/duration/priority → không bump. PATCH không thay đổi hiệu lực → no-op, không audit (precedent areas A6).
- **W5 — lifecycle PRJ-SRS-007 (không hard delete):** `ACTIVATE`→`ACTIVE`, `DEACTIVATE`→`INACTIVE` qua `POST /:id/status` (POST thay vì PATCH-trades để phân biệt action enum với partial update — quyết định slice này). Idempotent repeat → `200 {alreadyInState: true}`, không mutation, không audit. Deactivate khi WO đang tham chiếu **vẫn cho phép** (SRS: inactive không dùng cho WO mới — picker `/active` ẩn; WO cũ vẫn đọc chi tiết) nhưng kèm `warning` + `_warning` trong audit afterData. `GET /:id` luôn đọc được kể cả inactive (lịch sử).
- **W6 — usage/forward-ref JOB:** `GET /:id` kèm `usage: { workOrders }` = `COUNT work_orders WHERE work_type_id AND status ∉ (CANCELLED, CLOSED)` (`countActiveWorkOrders`; module JOB chưa tồn tại nên hôm nay = 0 — contract sẵn sàng, chỉ dùng cảnh báo, không chặn). Config đổi + `usage > 0` → `warning: 'Cấu hình đã thay đổi trong khi Work Order đang tham chiếu; các Work Order cũ giữ phiên bản trước'` (QUA-SRS-002 version snapshot: WO lưu version áp dụng khi JOB landing).
- **W7 — audit `PRJ_WORK_TYPE_CREATED` / `PRJ_WORK_TYPE_UPDATED` / `PRJ_WORK_TYPE_STATUS_CHANGED`**, `entityType` `WORK_TYPE`, `entityId`=workTypeId, tx-embedded `logWithClient` (fail closed → `500` rollback); update/status ghi `reason` ở cột `audit_logs.reason` (+ `afterData` khi có). Strict `X-Correlation-Id` trên writes (POST/PATCH/POST-status sai UUID → `400`; GET miễn). Hai shape `400` như các slice trước.

## 15. Project access control — PRJ-SRS-006 (#37) bounded decisions

Kiểm soát truy cập dự án: dùng role + membership giới hạn list/detail/operation (SRS.md PRJ-SRS-006; acceptance: ID tampering không bypass, admin exception phải audit).

### 15.1 Enforcement table (before → after)

| Method | Path | Before (#32/#33/#36) | After (#37) |
| --- | --- | --- | --- |
| POST | `/api/v1/projects` | ADMIN + PROJECT_MANAGER (global) | Giữ nguyên (create chưa có project-scope; PM tạo project tự thành MANAGER membership qua P9) |
| PATCH | `/api/v1/projects/:id` | ADMIN + PROJECT_MANAGER (global, roles-only) | ADMIN bypass (audited) HOẶC ACTIVE member MANAGER/COORDINATOR; PM global không member → 403 |
| PATCH | `/api/v1/projects/:id/status` | ADMIN + PROJECT_MANAGER (global, roles-only) | Như PATCH project (write-scope) |
| GET | `/api/v1/projects/:id/members` | ADMIN + PROJECT_MANAGER (global) | Bất kỳ ACTIVE member nào (WORKER/QC/VIEWER xem được đồng đội) + ADMIN bypass (audited) |
| POST | `/api/v1/projects/:id/members` | ADMIN + PROJECT_MANAGER (global, roles-only) | ADMIN bypass (audited) HOẶC ACTIVE member MANAGER/COORDINATOR |
| DELETE | `/api/v1/projects/:id/members/:memberId` | ADMIN + PROJECT_MANAGER (global, roles-only) | Như POST members (write-scope) |
| GET | `/api/v1/projects` (iam) | Đã scope (member-only, ADMIN all) | Giữ nguyên (không đụng read path iam) |
| GET | `/api/v1/projects/:id` (iam) | Đã scope (`assertAccess`) | Giữ nguyên (delegate sang `assertProjectMemberScope`) |
| GET/POST/PATCH | `/api/v1/projects/:projectId/areas...` | Global roles + membership (A4) | Giữ behavior, generalize qua `ProjectScopeService` (xem A4) |
| *work-types* | `/api/v1/work-types...` | ADMIN + PROJECT_MANAGER (global catalog) | KHÔNG ĐỤNG — catalog toàn cục, không project-scope (ghi rõ theo yêu cầu slice) |

- **S1 — API scope chung:** `ProjectScopeService` (iam `application/service`, export qua `IamModule`, `PrjModule` import dùng chung singleton) mở rộng: `assertProjectWriteScope` (ADMIN bypass audited HOẶC member MANAGER/COORDINATOR), `assertProjectMemberScope` (ADMIN bypass HOẶC bất kỳ ACTIVE member nào), `assertWriteScopeTxCheck`/`assertMemberScopeTxCheck` (re-check trong tx). Membership role đọc qua `findActiveProjectRole` mới trên iam membership port (`project_members.project_role`, chỉ `is_active`). Actor luôn server-derived từ JWT (`sub` + `roles` do login cấp, signed) — controller chỉ forward, không tin client.
- **S2 — enforce tại use-case level:** guard chạy TRƯỚC mọi 404/validation nghiệp vụ (anti-leak: non-ADMIN luôn 403 generic `Không có quyền truy cập dự án này` bất kể project tồn tại hay không; ADMIN check `exists()` trước → project missing vẫn 404). Controller prj bỏ `requireRoles` trên PATCH project/status + members routes (giữ cho `POST /projects` create và areas writes).
- **S3 — revoked mid-flight:** mutation flow đã trong tx (`FOR UPDATE` project row); guard re-check membership TRONG cùng tx ngay sau lock, trước mutation (`findActiveMemberWithClient` + `assert*TxCheck`, ADMIN skip). Revoke commit sau outer check nhưng trước lock → thấy ở đây → 403 → rollback, không partial-write. In-tx check không audit (tránh noise; outer check đã audit denied). Test: revoke → request kế tiếp reject (unit fresh-DB-check + e2e revoke test).
- **S4 — anti-leak:** 403 không phân biệt tồn tại/không (giữ như detail path). Mọi handler có project id đều qua guard (bảng trên + areas A4 + iam reads).
- **Audit decisions:**
  - (A) Admin bypass trên writes + members-reads + detail → `PROJECT_SCOPE_ADMIN_BYPASS` (`entityType` `PROJECT`, afterData `{reason: ADMIN_EXCEPTION, actorRoles, correlationId}`, `result` SUCCESS). Best-effort NHƯNG không nuốt âm thầm: fail → `Logger.warn` (action/project/actor/err) + vẫn cho qua — nhất quán precedent non-tx best-effort (API.md §8.5): scope decision đã đúng, audit là quan sát không phải authorization.
  - (B) Denied 403 NOT_MEMBER → `PROJECT_SCOPE_DENIED` (`entityType` `PROJECT`, afterData `{reason: NOT_MEMBER, scope: READ|WRITE, actorRoles}`, `result` FAILED), best-effort (fail → warn, denial vẫn đứng). Query được qua `GET /api/v1/audit-logs?action=PROJECT_SCOPE_DENIED` (ADMIN).
  - (C) List (`GET /api/v1/projects`) ADMIN bypass → log-only (debug, không audit row — rate-safe: mỗi lần list một row là noisy). Areas list bypass cũng log-only (`auditBypass: false`, giữ behavior A4). Audit bypass chỉ cho detail/write/members-read (1 row / 1 hành động có chủ đích).
- **Test contract:** `src/api/test/project-access.e2e.spec.ts` — ma trận member/non-member/admin/revoked × từng endpoint (tampering PM-A→B 403 không leak; revoked → 403; admin bypass → 200 + audit row; WORKER list chỉ thấy project mình) + unit spec service mở rộng + từng use-case bị đụng.
