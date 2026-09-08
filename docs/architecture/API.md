# API Architecture — NestJS

> **Status:** target design cho `src/api`; hiện chưa có source code hoặc package manifest.
> **Owner:** API workspace và mọi thay đổi domain/transport của server.
>
> **Endpoint contract:** chi tiết endpoint nghiệp vụ đã implement (method/path/auth/body/response/lỗi) thuộc `docs/architecture/ENDPOINTS.md`; file này giữ policy kiến trúc và audit producer coverage.

## 1. Mục tiêu

API là một **modular monolith**: một deployment unit ở giai đoạn đầu, nhưng mỗi bounded context/feature có module, interface, test surface và ownership rõ ràng. NestJS cung cấp module/DI/transport; Clean Architecture giữ domain không phụ thuộc framework.

Thiết kế này lấy cảm hứng từ [NestJS DDD DevOps template](https://github.com/andrea-acampora/nestjs-ddd-devops), nhưng không sao chép domain, ORM, database hay pipeline của template. Các quy tắc NestJS chính phải đối chiếu với [NestJS documentation](https://docs.nestjs.com/).

## 2. Cây thư mục target

```text
src/api/
├── src/
│   ├── main.ts                         # bootstrap Nest application
│   ├── app.module.ts                   # composition root
│   ├── config/                         # env/configuration only
│   ├── shared/                         # cross-cutting, không chứa domain
│   │   ├── api/                         # versioning, response/error contract
│   │   ├── exceptions/                  # exception mapping/filter
│   │   ├── logging/                     # logging/trace adapter
│   │   └── validation/                  # global pipes and validators
│   └── modules/
│       └── <context>/
│           ├── <context>.module.ts
│           ├── <context>.tokens.ts
│           ├── domain/
│           │   ├── entity/
│           │   ├── value-object/
│           │   ├── event/
│           │   ├── repository/          # ports owned by domain
│           │   └── service/              # domain policy nếu cần
│           ├── application/
│           │   ├── command/
│           │   ├── query/
│           │   ├── handler/
│           │   ├── use-case/
│           │   └── port/                # external/application ports
│           ├── api/
│           │   └── rest/
│           │       ├── controller/
│           │       └── presentation/
│           │           ├── body/
│           │           ├── params/
│           │           ├── dto/
│           │           └── mapper/
│           └── infrastructure/
│               ├── database/
│               │   ├── entity/
│               │   ├── mapper/
│               │   └── repository/
│               ├── cache/
│               │   └── redis/             # Redis cache/coordination adapter
│               └── integration/         # SDK/HTTP/queue adapters
└── test/
    ├── unit/
    ├── integration/
    └── e2e/
```

`<context>` là tên domain được chốt trong glossary/ADR sau này; không đặt tên theo database table hoặc controller. Nếu module chỉ là technical capability (ví dụ health), ghi rõ nó là platform module chứ không giả làm bounded context.

## 3. Dependency rule

```text
api/rest ────────┐
                 ▼
application ───► domain ◄── infrastructure implements ports
```

- **Domain:** entity, value object, domain event và invariant. Không import `@nestjs/*`, ORM, HTTP DTO, database hoặc SDK.
- **Application:** use case/command/query orchestration. Nó gọi domain và các port; không biết adapter cụ thể.
- **API/presentation:** controller, guard, pipe, request/response DTO và mapper. Nó chuyển transport thành input của application rồi map output thành contract.
- **Infrastructure:** adapter triển khai repository/external port; PostgreSQL persistence và Redis cache nằm ở đây; mapping persistence không rò vào domain.
- **Composition root:** `<context>.module.ts` đăng ký provider, token và adapter bằng DI. Module chỉ export interface/provider thật sự là public surface.
- **Shared:** chỉ dành cho policy kỹ thuật dùng chung (validation, error mapping, tracing). Không đặt `User`, `Order` hay business rule vào `shared` để né quyết định ownership.

Mỗi module nên là một deep module: public interface nhỏ, implementation được che giấu phía sau. Test đi qua interface của module/use case; không expose private seam chỉ để test.

## 4. Data adapters: PostgreSQL và Redis

- PostgreSQL là system of record; mỗi context định nghĩa repository port, còn adapter cụ thể nằm trong `infrastructure/database` và được wiring bằng Nest DI.
- Redis chỉ là `CachePort`/coordination adapter cho dữ liệu có TTL hoặc có thể rebuild; không dùng Redis để lưu domain truth.
- API dùng `DATABASE_URL` và `REDIS_URL`/typed config qua adapter; use case không tạo client connection trực tiếp.
- Cache miss, Redis timeout và Redis outage phải có behavior được test. Với cache-aside, fallback đọc PostgreSQL; không retry vô hạn hoặc biến cache thành transaction store.
- Docker Compose lifecycle, service name, healthcheck và volume thuộc [`DATA.md`](DATA.md); API sở hữu migration/schema và adapter contract.
- File/binary (attachments PRJ-SRS-009, xem [`ENDPOINTS.md`](ENDPOINTS.md) §18) đi qua storage port riêng (`AttachmentStoragePort`, adapter local disk `uploads/{projectId}/{uuid}-{safeName}`): upload nhận multipart qua controller → use case validate (size/mime/magic/tên) → ghi file NGOÀI tx → DB tx (metadata + audit) sau; DB/audit fail → xóa file (orphan cleanup). File operation không bao giờ nằm trong DB tx.

## 5. Quy tắc NestJS module

Một Nest module có thể khai báo `imports`, `controllers`, `providers` và `exports`. Áp dụng các quy tắc sau:

1. Mỗi context có một `<context>.module.ts` làm composition root cục bộ.
2. Controller chỉ nhận dependency là application interface/use case; controller không gọi repository.
3. Provider được inject qua token khi dependency là port; không inject concrete database class vào application.
4. Chỉ export public application interface hoặc event publisher cần cho context khác; không export toàn bộ infrastructure.
5. `app.module.ts` chỉ ghép module và platform concerns; không trở thành god module.
6. Cross-context synchronous call phải đi qua public application interface. Nếu quan hệ là eventual, dùng domain/integration event sau khi có nhu cầu thật; không tự thêm broker từ đầu.
7. Mọi external dependency phải có adapter production và test substitute hợp lý trước khi tạo seam công khai.

## 6. Luồng HTTP

```text
request
  → middleware / request-id
  → guard (authentication/authorization nếu có)
  → validation pipe
  → controller
  → command/query DTO nội bộ
  → use case / handler
  → domain invariant
  → repository/external port
  → response mapper
  → versioned JSON response
```

Controller không được:

- chứa transaction/business decision;
- trả thẳng persistence entity;
- nhận ORM model làm request DTO;
- gọi SDK bên ngoài trực tiếp;
- tạo `new` adapter thay vì nhận qua DI.

Chi tiết transport/compatibility thuộc [`NETCODE.md`](NETCODE.md). Khi endpoint đầu tiên được chốt, OpenAPI phải được sinh/kiểm tra từ API owner và consumer phải cập nhật cùng contract change.

## 7. Password management (IAM-SRS-007)

Đổi mật khẩu và self-service password reset thuộc IAM context. Ba endpoint dưới đây là contract công bố cho web/mobile; thay đổi breaking phải route qua [`NETCODE.md`](NETCODE.md) và đồng bộ consumer trong cùng PR.

| Method | Path | Auth | Body | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| PATCH | `/api/v1/me/password` | JWT bắt buộc | `{ currentPassword, newPassword, confirmPassword }` | `200 { message, reauthRequired: true }` | `400` sai `currentPassword` (field error), `confirmPassword` không khớp, vi phạm policy; `401` chưa xác thực |
| POST | `/api/v1/auth/password-reset/request` | Public | `{ email }` | LUÔN `200 { message }` generic | `400` chỉ khi body sai định dạng (ValidationPipe) |
| POST | `/api/v1/auth/password-reset/confirm` | Public | `{ token, newPassword, confirmPassword }` | `200 { message, reauthRequired: true }` | `400` `confirmPassword` không khớp, vi phạm policy; `401` token sai/đã dùng/hết hạn |

Quy tắc nghiệp vụ:

- **Password policy:** `newPassword` (áp dụng cho cả hai luồng) dài tối thiểu 8, tối đa 128 ký tự, gồm ít nhất 1 chữ cái và 1 chữ số.
- **`confirmPassword` bắt buộc** và phải khớp `newPassword`; lệch là lỗi `400`, không phụ thuộc validate phía client.
- **Anti-enumeration:** `/password-reset/request` luôn trả `200` với message generic bất kể email có tài khoản hay không; response không chứa `resetUrl` hay bất kỳ dấu hiệu tiết lộ sự tồn tại của email, ở **mọi** môi trường.
- **Token lifecycle:** reset token là one-time, hết hạn sau 30 phút; database chỉ lưu SHA-256 hash của token. Request reset mới đồng thời dọn các token đã hết hạn. `/password-reset/confirm` chạy trong một transaction nguyên tử: mật khẩu mới, vô hiệu hoá token và audit được ghi cùng lúc hoặc không gì cả.
- **Session cutoff + reauth:** đổi/đặt lại mật khẩu thành công cập nhật `password_changed_at`; JWT phát hành trước thời điểm đó bị từ chối với `401`. Guard có cache cutoff 30s/instance, nên cửa sổ lệch tối đa 30s. Response trả `reauthRequired: true`; client phải đưa người dùng về đăng nhập lại.
- **Ánh xạ lỗi:** `400` → `message` dạng mảng (ValidationPipe) hoặc `{ message, errors: { field: msg } }` cho lỗi nghiệp vụ (ví dụ field `currentPassword` khi mật khẩu hiện tại sai); `401` → chưa xác thực, hoặc reset token sai/hết hạn/đã dùng; `403` → cấm. Error contract chung thuộc [`NETCODE.md`](NETCODE.md).
- **Demo/E2E:** token reset không bao giờ được cấp qua API response. Operator sinh token bằng `npm run dev:reset-token -- --email <email>` trong `src/api` (yêu cầu quyền DB); script tạo token mới 30 phút và in link `http://localhost:3001/reset-password?token=...`.
- **Audit:** `IAM_PASSWORD_CHANGED`, `IAM_PASSWORD_CHANGE_FAILED`, `IAM_PASSWORD_RESET_REQUESTED`, `IAM_PASSWORD_RESET_FAILED`, `IAM_PASSWORD_RESET_COMPLETED` — không chứa credential hay token.

**Multi-instance revocation (IAM-SRS-002/007):** adapter revocation được chọn theo deployment, không theo code — đặt `REDIS_URL` (non-empty) thì `TOKEN_REVOCATION_PORT` dùng `RedisTokenRevocationService`: jti denylist (`iam:revoked:jti:<jti>`, TTL = thời gian còn lại của token) và user cutoff (`iam:revoked:user:<userId>`, TTL = max TTL của token) lan truyền cross-instance qua Redis, mọi instance enforce revocation gần như tức thời; không đặt `REDIS_URL` thì fallback in-memory per-instance như trước. `password_changed_at` trong PostgreSQL vẫn là **source of truth** theo [`DATA.md`](DATA.md): Redis chỉ là cache/coordination tăng tốc lan truyền, guard luôn đọc và enforce cutoff từ DB (kèm cache cutoff 30s/instance nên cửa sổ lệch tối đa 30s vẫn được chấp nhận). Khi Redis outage: jti denylist fail-open (không treo request, chấp nhận miss một revocation), user cutoff tự fallback về giá trị DB truyền vào guard — DB vẫn luôn được guard check riêng nên phiên không bị nhầm trạng thái; lỗi ghi Redis chỉ warn, không phá request đổi mật khẩu.

## 8. Audit log (IAM-SRS-008)

Audit trail ghi lại các event bảo mật/IAM quan trọng (login success/failed, logout, user create/update, lock/unlock/deactivate/reactivate, role change, password flows, project scope bypass). Write path đi qua `AuditPort` (`application/port/audit.port.ts` → `PgAuditRepository`); read path là read-only qua `AUDIT_LOG_REPOSITORY` → `QueryAuditLogsUseCase`.

### 8.1 Read endpoint

| Method | Path | Auth | Query filters | Response | Lỗi |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/audit-logs` | JWT bắt buộc, **ADMIN-only** (server-derived roles, check trong use case) | `action`, `actorUserId`, `entityType`, `entityId`, `result` (`SUCCESS`/`FAILED`), `correlationId`, `from`, `to` (ISO 8601 strict — date-only `YYYY-MM-DD` hoặc timestamp RFC3339 (`YYYY-MM-DDTHH:mm[:ss[.mmm]]` + `Z` hoặc `±HH:MM`); giá trị khác → `400`; date-only `from` được chuẩn hóa về `00:00:00.000Z`, date-only `to` về `23:59:59.999Z` — end-of-day inclusive, chọn đúng ngày cuối vẫn được bao gồm; `from ≤ to` vẫn bắt buộc), `limit` (1-100, default 20), `offset` (≥ 0) | `200 { data, total, limit, offset }`, `data[]` sort giảm dần theo `createdAt` | `401` chưa xác thực; `403` non-admin; `400` query sai (enum/date/limit/offset) |

- Phân trang là limit/offset kèm `total` tuyệt đối; chưa có cursor pagination.
- Response `data[]` có leak guard: nếu before/after data vi phạm `AuditLogEntity.isSanitized()` (xem 8.5) thì request bị từ chối `400` — defense in depth phía read.
- Body lỗi hiện tại là shape Nest default `{ statusCode, message }`; freeze sang Problem Details ([`NETCODE.md`](NETCODE.md) §3) phải đi cùng OpenAPI và đồng bộ consumer.
- Response `data[]` item gồm các trường: `id`, `actorUserId`, `action`, `entityType`, `entityId`, `beforeData`, `afterData`, `reason`, `result`, `ipAddress`, `userAgent`, `correlationId`, `createdAt`. `reason` là lý do nghiệp vụ nullable do producer ghi; write path wire lần đầu ở ORG-SRS-004 (issue #27): `PATCH /api/v1/workers/:id/status` và `PATCH /api/v1/contractors/:id/status` ghi `reason` (bắt buộc 1-500 cho SUSPEND/TERMINATE, optional cho ACTIVATE) vào cột `audit_logs.reason`; các producer còn lại chưa ghi `reason` → `null`.

Ví dụ một item trong `data[]`:

```json
{
  "id": "0f8f2a5e-9d1c-4b7a-8e3f-2c6d5b4a9e10",
  "actorUserId": "33333333-3333-3333-3333-333333333333",
  "action": "AUTH_LOGIN_SUCCESS",
  "entityType": "USER",
  "entityId": "33333333-3333-3333-3333-333333333333",
  "beforeData": null,
  "afterData": { "email": "admin@buildflow.vn", "roles": ["ADMIN"] },
  "reason": null,
  "result": "SUCCESS",
  "ipAddress": "10.0.0.15",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "correlationId": "6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b",
  "createdAt": "2026-08-27T01:23:45.678Z"
}
```

### 8.2 Idempotency — mỗi event đúng một record

- DB ràng buộc unique partial index `ux_audit_correlation_action (correlation_id, action) WHERE correlation_id IS NOT NULL` (migration 0003): một event mang `correlation_id` chỉ tạo đúng một record; retry/duplicate không nhân bản.
- `PgAuditRepository` dùng `INSERT ... ON CONFLICT (correlation_id, action) WHERE correlation_id IS NOT NULL DO NOTHING` khi có `correlation_id`: insert trùng là no-op (rowCount 0), **không phải lỗi**. Event không có `correlation_id` luôn ghi mới.
- **Producer coverage (đầy đủ):** mọi producer audit trong `src/api` đọc `X-Correlation-Id` từ request và đưa vào audit payload — index dedup `ux_audit_correlation_action` bao phủ tất cả audit actions. Retry cùng header trên một producer: `AUTH_LOGIN_*` dedup thành đúng một record; audit tx-embedded (status change, role assignment, create/update user, org create/update) bị dedup thành no-op — business write vẫn commit, không abort (xem 8.4).
- **Policy header phân theo loại endpoint:**
  - **Strict (admin/management — `X-Correlation-Id` phải là UUID; controller trả `400` nếu sai** vì `audit_logs.correlation_id` là `uuid`, message actionable: `X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)`; header thiếu/không gửi là hợp lệ → audit ghi `correlation_id` null, không dedup):
    - `PUT /api/v1/admin/users/:id/roles` → `IAM_ROLE_ASSIGNED`
    - `PATCH /api/v1/admin/users/:id/status` → `IAM_USER_STATUS_CHANGED`/`IAM_USER_LOCKED`/`IAM_USER_UNLOCKED`/`IAM_USER_DEACTIVATED`/`IAM_USER_REACTIVATED`
    - `POST /api/v1/admin/users` → `IAM_USER_CREATED`
    - `PATCH /api/v1/admin/users/:id` → `IAM_USER_UPDATED`
    - `POST /api/v1/workers` → `ORG_WORKER_CREATED`; `PATCH /api/v1/workers/:id` → `ORG_WORKER_UPDATED`
    - `PATCH /api/v1/workers/:id/status` → `ORG_WORKER_SUSPENDED`/`ORG_WORKER_TERMINATED`/`ORG_WORKER_REACTIVATED` (ORG-SRS-004, action `SUSPEND`/`TERMINATE`/`ACTIVATE`)
    - `POST /api/v1/contractors` → `ORG_CONTRACTOR_CREATED`; `PATCH /api/v1/contractors/:id` → `ORG_CONTRACTOR_UPDATED`/`ORG_CONTRACTOR_STATUS_CHANGED`
    - `PATCH /api/v1/contractors/:id/status` → `ORG_CONTRACTOR_SUSPENDED`/`ORG_CONTRACTOR_TERMINATED`/`ORG_CONTRACTOR_REACTIVATED` (ORG-SRS-004, action `SUSPEND`/`TERMINATE`/`ACTIVATE`)
    - `POST /api/v1/trades` → `ORG_TRADE_CREATED`; `PATCH /api/v1/trades/:id` → `ORG_TRADE_UPDATED`; `PATCH /api/v1/trades/:id/status` → `ORG_TRADE_STATUS_CHANGED`
    - `POST /api/v1/crews` → `ORG_CREW_CREATED`; `PATCH /api/v1/crews/:id` → `ORG_CREW_UPDATED` (đổi tên/mô tả/nhà thầu) hoặc `ORG_CREW_LEAD_CHANGED` (đổi trưởng nhóm); `PATCH /api/v1/crews/:id/status` → `ORG_CREW_SUSPENDED`/`ORG_CREW_TERMINATED`/`ORG_CREW_REACTIVATED` (ORG-SRS-006, action `SUSPEND`/`TERMINATE`/`ACTIVATE`)
    - `POST /api/v1/crews/:id/members` → `ORG_CREW_MEMBER_ADDED`; `DELETE /api/v1/crews/:id/members/:memberId` → `ORG_CREW_MEMBER_REMOVED` (ORG-SRS-007, issue `#30`; `alreadyRemoved` idempotent không audit; `reason` ở cột `audit_logs.reason`)
    - `POST /api/v1/projects` → `PRJ_PROJECT_CREATED`; `PATCH /api/v1/projects/:id` → `PRJ_PROJECT_UPDATED` (PRJ-SRS-001, issue `#32`; `entityType` `PROJECT`)
    - `PATCH /api/v1/projects/:id/status` → `PRJ_PROJECT_STATUS_CHANGED` (PRJ-SRS-002, issue `#33`; `entityType` `PROJECT`; `alreadyInState` idempotent không audit; `reason` ở cột `audit_logs.reason`)
    - `POST /api/v1/projects/:id/members` → `PRJ_PROJECT_MEMBER_ADDED`; `DELETE /api/v1/projects/:id/members/:memberId` → `PRJ_PROJECT_MEMBER_REMOVED` (PRJ-SRS-005, issue `#36`; `entityType` `PROJECT`; `alreadyRemoved` idempotent không audit; `reason` ở cột `audit_logs.reason`; membership manager → `409 MANAGER_MEMBER`)
    - `POST /api/v1/projects/:projectId/areas` → `PRJ_PROJECT_AREA_ADDED`; `PATCH /api/v1/projects/:projectId/areas/:areaId` → `PRJ_PROJECT_AREA_UPDATED` + (khi transition `isActive`) `PRJ_AREA_STATUS_CHANGED` (PRJ-SRS-003, issue `#34` + PRJ-SRS-007, issue `#38`; `entityType` `PROJECT`, `entityId`=projectId; double-deactivate idempotent `alreadyInactive` không audit; `reason` ở cột `audit_logs.reason` và trong `afterData` khi gửi; retire kèm `usage`/`warning` + `_warning` khi WO mở tham chiếu; xem `ENDPOINTS.md` §13–§13.1)
    - `POST /api/v1/work-types` → `PRJ_WORK_TYPE_CREATED`; `PATCH /api/v1/work-types/:id` → `PRJ_WORK_TYPE_UPDATED`; `POST /api/v1/work-types/:id/status` → `PRJ_WORK_TYPE_STATUS_CHANGED` (PRJ-SRS-004, issue `#35`; `entityType` `WORK_TYPE`, `entityId`=workTypeId; idempotent repeat `alreadyInState` không audit; no-op update không audit; `reason` ở cột `audit_logs.reason`; xem `ENDPOINTS.md` §14)
    - `POST /api/v1/work-order-templates` → `PRJ_WO_TEMPLATE_CREATED`; `PATCH /api/v1/work-order-templates/:id` → `PRJ_WO_TEMPLATE_UPDATED`; `POST /api/v1/work-order-templates/:id/status` → `PRJ_WO_TEMPLATE_STATUS_CHANGED` (PRJ-SRS-008, issue `#39`; `entityType` `WORK_ORDER_TEMPLATE`, `entityId`=templateId; idempotent repeat `alreadyInState` không audit; no-op update không audit; `reason` ở cột `audit_logs.reason`; xem `ENDPOINTS.md` §16)
    - `POST /api/v1/work-orders` → `JOB_WORK_ORDER_CREATED` (JOB-SRS-001, issue `#41`; `entityType` `WORK_ORDER`, `entityId`=workOrderId; `requestKey` trùng → replay `200` + `idempotentReplay`, không audit mới; xem `ENDPOINTS.md` §17)
    - `PATCH /api/v1/work-orders/:id` → `JOB_WORK_ORDER_UPDATED` (đổi lịch/skill/work-type kèm notification row cho creator trong cùng tx; `customFields` merge không notification/không đòi reason) hoặc `WORK_ORDER_EXCEPTION_EDIT` (sửa terminal `WORK_DONE`/`CLOSED`/`CANCELLED` — chỉ ADMIN + reason ≥10 ký tự) (JOB-SRS-003, issue `#43`; `entityType` `WORK_ORDER`, `beforeData`/`afterData` per-field changed, no-op không audit; xem `ENDPOINTS.md` §17 J7–J8)
  - **Lenient (public/self-service — header thiếu hoặc không phải UUID → `correlationId: undefined` (audit vẫn ghi với `correlation_id` null, không dedup); header sai không bao giờ block/400):**
    - `POST /api/v1/auth/login` → `AUTH_LOGIN_SUCCESS`/`AUTH_LOGIN_FAILED`
    - `POST /api/v1/auth/logout` (authenticated self-service) → `AUTH_LOGOUT`
    - `POST /api/v1/auth/password-reset/request` → `IAM_PASSWORD_RESET_REQUESTED` (cả nhánh email tồn tại lẫn unknown/inactive)
    - `POST /api/v1/auth/password-reset/confirm` → `IAM_PASSWORD_RESET_COMPLETED`/`IAM_PASSWORD_RESET_FAILED` (mọi reason)
    - `PATCH /api/v1/me/password` → `IAM_PASSWORD_CHANGED`/`IAM_PASSWORD_CHANGE_FAILED`
    - `PATCH /api/v1/me/profile` → `IAM_PROFILE_UPDATED`
    - Ngoài bảng (pre-existing): `GET /api/v1/projects/:id` → `PROJECT_SCOPE_ADMIN_BYPASS` — đã wire nhưng header đi qua **raw** (không trim/UUID check, không 400); normalize theo 2 policy trên là follow-up.
    - PRJ-SRS-006 (issue `#37`, xem `ENDPOINTS.md` §15): admin bypass trên project writes + members-reads + detail → `PROJECT_SCOPE_ADMIN_BYPASS` (best-effort, fail → warn log + cho qua); mọi 403 NOT_MEMBER → `PROJECT_SCOPE_DENIED` (`entityType` `PROJECT`, `result` FAILED, query qua `GET /api/v1/audit-logs?action=PROJECT_SCOPE_DENIED`); list (`GET /api/v1/projects`) và areas-list bypass chỉ log-only (không audit row — rate-safe).
- Ngoại lệ chưa wire: không có. Toàn bộ producer audit hiện tại của `src/api` đều đã wire (không xét producer ngoài `src/api`).

### 8.3 Append-only

- `audit_logs` là append-only ở mức DB: trigger `audit_logs_append_only_rows` (BEFORE UPDATE/DELETE FOR EACH ROW) và `audit_logs_append_only_truncate` (BEFORE TRUNCATE) raise exception — chỉ INSERT được phép (migration 0003). Integration test chứng minh UPDATE/DELETE/TRUNCATE bị từ chối.

### 8.4 Reliability policy

- **Tx-embedded mandatory** (status change, role change): audit chạy trong cùng transaction nghiệp vụ qua `logWithClient`; audit thất bại thật = business failure (500, rollback nguyên tử). Dedup không phải thất bại — business write vẫn commit. Không retry bên trong transaction (tx đã aborted sau một statement lỗi).
- **Non-tx best-effort** (login/logout/password flows): audit không bao giờ phá business flow. `PgAuditRepository.log()` retry đúng 1 lần cho lỗi transient (connection/network, serialization failure, deadlock, pool exhaustion, server shutdown) sau 100ms; thất bại cuối cùng ghi một dòng structured error gồm `correlationId` + `action` + driver code rồi trả về bình thường — không throw về producer.

### 8.5 No-secrets

- Write path không nhận secret: `beforeData`/`afterData` chỉ chứa dữ liệu public profile; `AuditLogEntity.isSanitized()` chặn key `password`/`passwd`/`pwd`/`password_hash`/`secret`/`resetCode`/`reset_code`/`token`/`jwt`/`hash` (kể cả lồng nhau). Read path đối chiếu cùng key set qua leak guard (8.1). Structured error log của audit không bao giờ chứa payload/secret.

### 8.6 Retention

- Retention **owner-approved** (session 2026-09-05): **default 365 ngày**, cấu hình qua env `AUDIT_RETENTION_DAYS` (integer > 0, giá trị sai fallback về default kèm warn; app config `auditRetentionDays`).
- Purge theo tuổi chạy qua operator script — trong `src/api`: `npm run db:purge-audit` (dry-run: in số record sẽ xóa, không xóa gì, exit 0) hoặc `npm run db:purge-audit -- --yes` (xóa thật); retention cụ thể qua `--days N` hoặc env. Script mở transaction riêng và dùng `SET LOCAL audit.purge_enabled = 'on'` — GUC session (migration 0004) là điều kiện duy nhất để row-level DELETE trên `audit_logs` được trigger `audit_logs_append_only_rows` cho phép. Không bao giờ dùng TRUNCATE cho purge: `audit_logs_append_only_truncate` vẫn chặn statement-level.
- UPDATE trên `audit_logs` bị chặn **tuyệt đối**, kể cả khi `audit.purge_enabled` đang bật. Append-only giữ nguyên cho mọi đường ghi khác.
- Residual risk (xem [`DATA.md`](DATA.md) §7): purge dựa trên mô hình tin cậy app DB role là owner của trigger/function; production nên chạy migration + purge bằng owner role riêng và connect app bằng non-owner role.

## 9. Domain và application conventions

- Tên use case là động từ nghiệp vụ (`CreateX`, `RegisterY`), không phải tên CRUD chung chung nếu domain có ngôn ngữ chính xác hơn.
- Entity bảo vệ invariant bằng method có ý nghĩa; không public mutable field để controller tự sửa state.
- Value object validate khi tạo và bất biến sau khi tạo.
- Repository interface nằm gần domain cần nó; repository implementation nằm ở infrastructure.
- Domain event chỉ mô tả sự kiện đã xảy ra; handler ở application/integration quyết định side effect.
- DTO transport và domain type là hai interface khác nhau; mapper là seam, không dùng `as` để bỏ qua mapping.
- Không đưa `any`, ORM decorator hoặc Nest decorator vào domain.

## 10. Test và proof

| Phạm vi | Kiểm tra | Adapter |
| --- | --- | --- |
| Domain | invariant, value object, policy, event | in-memory/pure |
| Application | outcome của use case, port calls ở mức interface | fake/in-memory adapter |
| Infrastructure | mapping, query, serialization, external failure | test database/test server khi cần |
| E2E | HTTP status, validation, auth, response contract | boot Nest app với test config |

Test phải bảo vệ observable outcome qua interface. Không giữ production API/state chỉ để test gọi private implementation. Khi có contract hard cut, audit producer, consumer, generated artifact, fixture và snapshot cùng lúc. Data integration test phải có PostgreSQL readiness/migration proof và Redis TTL/cache-miss/outage proof khi adapter bị ảnh hưởng.

## 11. Cross-cutting tối thiểu

Các concern sau được bootstrap một lần ở composition root, nhưng policy chi tiết vẫn thuộc owner thích hợp:

- cấu hình typed và fail-fast khi thiếu biến bắt buộc;
- global validation/transform;
- exception filter map lỗi domain/application sang transport;
- request ID và structured logging;
- health liveness/readiness;
- API versioning và OpenAPI;
- authentication/authorization khi domain requirement được chốt.

PostgreSQL và Redis được chọn cho data baseline; chi tiết Docker/Compose, persistence, TTL/eviction, migration và production topology thuộc [`DATA.md`](DATA.md). ORM, auth provider và production hosting chưa được chốt.

## 12. Checklist thêm module

- [ ] Context/feature và owner đã được gọi tên bằng domain language.
- [ ] Invariant nằm ở domain, không nằm ở controller.
- [ ] Use case/application interface có test surface nhỏ.
- [ ] Port nằm ở phía policy cần nó; adapter nằm trong infrastructure.
- [ ] Module chỉ export public surface cần thiết.
- [ ] DTO, mapper, validation và OpenAPI được cập nhật.
- [ ] Unit/application/integration/e2e proof được chọn theo thay đổi.
- [ ] Nếu endpoint thay đổi, đã route qua [`WORK-ROUTING.md`](../../WORK-ROUTING.md).
- [ ] Nếu data adapter/schema/cache policy thay đổi, đã cập nhật [`DATA.md`](DATA.md), migration/TTL proof và ADR khi cần.

## 13. Resource directory roles — ORG-SRS-005 (#28)

Tra cứu nguồn lực (issue `#28`, API slice; UI Web thuộc web slice riêng). Contract chi tiết thuộc [`ENDPOINTS.md`](ENDPOINTS.md) §1–§4 và bounded decisions §7.

| Endpoint | ADMIN | PROJECT_MANAGER | WORKER-role | Anon |
| --- | --- | --- | --- | --- |
| `GET /api/v1/workers`, `GET /api/v1/workers/:id` | OK | OK (read-only) | `403` | `401` |
| `GET /api/v1/workers/:workerId/crews` (ORG-03/ORG-05 Worker ↔ Crew link, xem `ENDPOINTS.md` §8.2) | OK | OK (read-only) | `403` | `401` |
| `GET /api/v1/contractors`, `GET /api/v1/contractors/:id` | OK | OK (read-only) | `403` | `401` |
| `GET /api/v1/trades`, `GET /api/v1/trades/:id` | OK | OK (read-only) | `403` | `401` |
| `POST`/`PATCH` workers/contractors/trades, `PATCH .../:id/status`, `GET .../:id/open-work` | OK | `403` | `403` | `401` |
| `POST /api/v1/projects` (PRJ-SRS-001, `#32`, module `prj`) | OK | OK (write, global — create chưa có project-scope) | `403` | `401` |
| `PATCH /api/v1/projects/:id` (PRJ-SRS-001 + PRJ-SRS-006 `#37`, module `prj`) | OK (bypass, audited) | OK chỉ khi ACTIVE member MANAGER/COORDINATOR (non-member → `403`) | `403` (trừ khi là project MANAGER/COORDINATOR) | `401` |
| `PATCH /api/v1/projects/:id/status` (PRJ-SRS-002 + PRJ-SRS-006 `#37`, module `prj`) | OK (bypass, audited) | OK chỉ khi ACTIVE member MANAGER/COORDINATOR (non-member → `403`) | `403` (trừ khi là project MANAGER/COORDINATOR) | `401` |
| `GET /api/v1/projects/:id/members` (PRJ-SRS-005 + PRJ-SRS-006 `#37`, module `prj`) | OK (bypass, audited) | OK (member) | OK (**member** — mọi ACTIVE member; non-member → `403`) | `401` |
| `POST /api/v1/projects/:id/members`, `DELETE /api/v1/projects/:id/members/:memberId` (PRJ-SRS-005 + PRJ-SRS-006 `#37`, module `prj`) | OK (bypass, audited) | OK chỉ khi ACTIVE member MANAGER/COORDINATOR (non-member → `403`) | `403` (trừ khi là project MANAGER/COORDINATOR) | `401` |
| `POST /api/v1/projects/:projectId/areas`, `PATCH /api/v1/projects/:projectId/areas/:areaId` (PRJ-SRS-003, `#34`, module `prj`) | OK | OK (write; + ACTIVE membership scope, xem `ENDPOINTS.md` §13 A4) | `403` | `401` |
| `GET /api/v1/projects/:projectId/areas` (PRJ-SRS-003, `#34`, module `prj`) | OK (bypass) | OK (member) | OK (**member** — mọi ACTIVE member, kể cả WORKER; non-member → `403`) | `401` |
- **Areas writes guard (PRJ-SRS-006 review P2-1):** `POST`/`PATCH` areas giữ thêm controller guard toàn cục `ADMIN` + `PROJECT_MANAGER` (`PROJECT_WRITE_ROLES`) ngoài membership scope ở use-case — fail-closed (role lạ → `403` trước khi tới scope; không đổi behavior).
| `GET /api/v1/work-types`, `GET /api/v1/work-types/active`, `GET /api/v1/work-types/:id` (PRJ-SRS-004, `#35`, module `prj`) | OK | OK (read) | `403` | `401` |
| `POST /api/v1/work-types`, `PATCH /api/v1/work-types/:id`, `POST /api/v1/work-types/:id/status` (PRJ-SRS-004, `#35`, module `prj`) | OK | OK (write) | `403` | `401` |
| `GET /api/v1/work-order-templates`, `GET /api/v1/work-order-templates/active`, `GET /api/v1/work-order-templates/:id` (PRJ-SRS-008, `#39`, module `prj`) | OK | OK (read) | `403` | `401` |
| `POST /api/v1/work-order-templates`, `PATCH /api/v1/work-order-templates/:id`, `POST /api/v1/work-order-templates/:id/status` (PRJ-SRS-008, `#39`, module `prj`) | OK | OK (write) | `403` | `401` |
| `POST /api/v1/work-orders` (JOB-SRS-001, `#41`, module `job`) | OK (bypass, audited) | OK chỉ khi ACTIVE member MANAGER/COORDINATOR (non-member → `403`; project missing vẫn `403` cho non-admin — scope-first, xem `ENDPOINTS.md` §17 J1) | `403` (trừ khi là project MANAGER/COORDINATOR) | `401` |
| `GET /api/v1/work-orders/:id` (JOB-SRS-001, `#41`, module `job`) | OK (bypass, audited; missing → `404`) | OK (member) | OK (**member** — mọi ACTIVE member, kể cả WORKER; non-member → `403` kể cả id không tồn tại) | `401` |
| `GET /api/v1/work-orders` (list, module `job`) | OK (tất cả, bypass chỉ debug-log — không audit row) | OK (PM/…) | OK (**member** — chỉ WO của các project mình là ACTIVE member; membership rỗng → `200 []`, không `403`; `projectId` ngoài scope → `403` generic) | `401` |
| `PATCH /api/v1/work-orders/:id` (JOB-SRS-003, `#43`, module `job`) | OK (bypass, audited; missing → `404`) | OK chỉ khi ACTIVE member MANAGER/COORDINATOR của project chứa WO (non-member → `403` kể cả id không tồn tại; WORKER member → `403`) | `403` | `401` |

- **Helper dùng chung:** `requireRoles(req, roles)` trong `modules/iam/api/rest/guard/roles.guard.ts` (RolesGuard đã có logic tương tự nhưng không dùng ở các controller này). Chỉ các GET path widen gọi `requireRoles(req, ['ADMIN', 'PROJECT_MANAGER'])`; write path giữ `assertAdmin` cục bộ.
- **Ngoại lệ crews (ORG-SRS-006, `#29`):** crews mở `ADMIN` + `PROJECT_MANAGER` trên cả read lẫn write (SRS actor Điều phối viên) — xem `ENDPOINTS.md` §7 bounded decision và §8. Không widen nhầm endpoint workers/contractors/trades.
- **Thành viên đội (ORG-SRS-007, `#30`, xem `ENDPOINTS.md` §8.1):** `GET`/`POST /api/v1/crews/:id/members` và `DELETE /api/v1/crews/:id/members/:memberId` dùng chung `CREW_ROLES` (`ADMIN` + `PROJECT_MANAGER`). POST chỉ tạo `MEMBER` (`201`; overlap đội khác WARN kèm `warning` + `_warning` audit, trùng cùng đội `409 MEMBER_DUPLICATE`); DELETE là soft-deactivate giữ lịch sử (idempotent `alreadyRemoved`, không audit; row LEAD → `409 MEMBER_IS_LEAD`, đổi trưởng nhóm qua `PATCH /crews/:id` `leaderUserId`); audit `ORG_CREW_MEMBER_ADDED`/`ORG_CREW_MEMBER_REMOVED` tx-embedded.
- **Dự án writes (PRJ-SRS-001, `#32`, + PRJ-SRS-006 `#37`, xem `ENDPOINTS.md` §10/§15):** `POST /api/v1/projects` trong module mới `prj` (`ADMIN` + `PROJECT_MANAGER` via `requireRoles`; STAFF/WORKER → `403`, anon → `401`); `PATCH /api/v1/projects/:id` enforce project-scope tại use-case (`ADMIN` bypass audited HOẶC ACTIVE member `MANAGER`/`COORDINATOR` — membership là source of truth, PM global không member → `403`). Reads (`GET`, `GET :id`) ở lại iam (scope-integrated). Create ép `status='DRAFT'`; PATCH whitelist name/description/address/timezone/plannedStartDate/plannedEndDate/managerId (`code` bất biến, `status` thuộc lifecycle `#33` — có mặt → `400` fieldErrors); trùng code → `409 { code: 'PROJECT_CODE_DUPLICATE' }`; audit `PRJ_PROJECT_CREATED`/`PRJ_PROJECT_UPDATED` (`entityType` `PROJECT`) tx-embedded; strict `X-Correlation-Id`.
- **Dự án lifecycle (PRJ-SRS-002, `#33`, + PRJ-SRS-006 `#37`, xem `ENDPOINTS.md` §11/§15):** `PATCH /api/v1/projects/:id/status` (project-scope như PATCH project — `ADMIN` bypass audited HOẶC member `MANAGER`/`COORDINATOR`) với transition map L1 (DRAFT→ACTIVE/CLOSED, ACTIVE→PAUSED/COMPLETED, PAUSED→ACTIVE, COMPLETED→CLOSED, CLOSED→ACTIVE); reason bắt buộc 1-500 cho PAUSE/CLOSE/REOPEN (thiếu → `400 fieldErrors {reason}`); action sai trạng thái → `409 { code: 'INVALID_TRANSITION', allowedTransitions }`; idempotent repeat → `200 {alreadyInState: true}` không audit; audit `PRJ_PROJECT_STATUS_CHANGED` tx-embedded (before/after `{status}`, `reason` ở cột audit); history = `audit_logs` append-only; 'CLOSED không tạo WO mới' defer slice JOB.
- **Thành viên dự án (PRJ-SRS-005, `#36`, xem `ENDPOINTS.md` §12):** `GET`/`POST /api/v1/projects/:id/members` và `DELETE /api/v1/projects/:id/members/:memberId` dùng chung `PROJECT_WRITE_ROLES` (`ADMIN` + `PROJECT_MANAGER`) cho areas writes; members routes enforce project-scope từ `#37` (GET list: mọi ACTIVE member + ADMIN; POST/DELETE: `ADMIN` bypass audited HOẶC member `MANAGER`/`COORDINATOR` — xem `ENDPOINTS.md` §15). POST chỉ tạo `COORDINATOR`/`QC`/`WORKER`/`VIEWER` (`201`; `MANAGER` → `400` fieldErrors `{projectRole}`, đặt qua `PATCH /projects/:id` `managerId`; trùng cùng project `409 MEMBER_DUPLICATE`); DELETE là soft-deactivate giữ lịch sử (`is_active=false`, `left_at=CURRENT_TIMESTAMP` — xem §12 M2 deviation; idempotent `alreadyRemoved`, không audit; membership của manager hiện tại → `409 MANAGER_MEMBER`, đổi quản lý qua PATCH); audit `PRJ_PROJECT_MEMBER_ADDED`/`PRJ_PROJECT_MEMBER_REMOVED` tx-embedded (`entityType` `PROJECT`). P11: UPDATE đổi `managerId` auto-insert membership `MANAGER` cho manager mới trong cùng tx (manager cũ giữ nguyên).
- **Team filter workers (D9, `#30` — defer `#28` đã đóng):** `GET /api/v1/workers` nhận thêm `crewId` (uuid) = workers có ACTIVE membership trong đội (join `crew_members` `is_active`); sai format → `400 fieldErrors { crewId }`.
- **Sort:** `GET /workers` và `GET /contractors` nhận `sort` (`name`/`createdAt`) + `order` (`asc`/`desc`, default `createdAt`/`desc`); whitelist mapping sang cột ở repository layer (worker `name`→`full_name`, contractor `name`→`name`, cả hai `createdAt`→`created_at`); sai giá trị → `400 { statusCode, message, fieldErrors }`. `GET /trades` giữ `ORDER BY name` cố định.
- **Field-level filter errors:** lỗi validation filter trả `400 { statusCode, message, fieldErrors: { <field>: [msg] } }`, `message` giữ nguyên text cũ (web hiện chỉ đọc `message` nên không break).
- **Current data:** các GET search + detail trả `Cache-Control: no-store` (qua `@Header`).
- **Eligibility (ORG-SRS-008, `#31`):** endpoint điều kiện nhận việc thuộc [`ENDPOINTS.md`](ENDPOINTS.md) §9 — read-only, không ghi audit.
- **Liên kết Worker ↔ Crew (ORG-03/ORG-05, BR-06 — xem `ENDPOINTS.md` §8.2, W1–W6):** `GET /api/v1/workers/:workerId/crews` (`GetWorkerCrewsUseCase`, pattern read-only `GetWorkerOpenWorkUseCase` — không tx, không audit; chỉ active memberships kèm `crewStatus`/`memberRole`/dates) với guard mirror `GET /workers/:id` (`ADMIN` + `PROJECT_MANAGER` read-only). Enrichment: worker list/detail kèm `crews[]` (`{ crewId, crewCode, crewName, memberRole }`, batch 1 query `findMembershipsByUserIds` tránh N+1); crews list kèm `leaderName` (join `users` qua LEAD active) + `memberCount` (COUNT `crew_members` active, batch 1 query `findListEnrichments`). KHÔNG đổi add/remove member, leader-swap (D1) hay eligibility.
- **Khu vực dự án (PRJ-SRS-003, `#34` + PRJ-SRS-007, `#38`, xem `ENDPOINTS.md` §13–§13.1):** `GET`/`POST /api/v1/projects/:projectId/areas`, picker `GET /api/v1/projects/:projectId/areas/active` (chỉ active, cho giao dịch mới — mirror `/work-types/active`) và `PATCH /api/v1/projects/:projectId/areas/:areaId` trong module `prj` (reads `GET /projects` ở lại iam). Writes = `PROJECT_WRITE_ROLES` + ACTIVE membership scope (ADMIN bypass, non-member PM → `403`); reads mở mọi ACTIVE member (kể cả WORKER — WO picker). Một cấp (không `parent_id`); trùng tên active → `409 AREA_DUPLICATE`, trùng mã → `409 AREA_CODE_DUPLICATE` (constraint-cụ-thể-trước, bare `23505` rethrow); double-deactivate idempotent `alreadyInactive`; retire kèm `usage: { workOrders }` (`countOpenWorkOrders`, forward-ref JOB) + `warning` khi WO mở tham chiếu (không chặn); audit `PRJ_PROJECT_AREA_ADDED`/`PRJ_PROJECT_AREA_UPDATED` + `PRJ_AREA_STATUS_CHANGED` (mọi transition `isActive`, tx-embedded, `entityType` `PROJECT`). Skills KHÔNG phải catalog độc lập (thuộc tính `skill_level` 1-5 của `resource_trades`, không lifecycle riêng); rename trades/work-types/areas lan tỏa label hiển thị, không đổi kết quả nghiệp vụ đã lưu (FK + snapshot); `work_orders` FKs inline `REFERENCES` (`NO ACTION`) + không expose delete nên đủ, không migration 0008 (xem §13.1 A8–A10).
- **Loại công việc (PRJ-SRS-004, `#35`, xem `ENDPOINTS.md` §14):** `POST`/`GET`/`GET /active`/`GET /:id`/`PATCH /:id`/`POST /:id/status` trên `/api/v1/work-types` trong module `prj`; read + write = `ADMIN` + `PROJECT_MANAGER` (WORKER → `403`, anon → `401`). Trùng code CI → `409 WORK_TYPE_CODE_DUPLICATE` (constraint-cụ-thể-trước, bare `23505` rethrow); trade không tồn tại/inactive → `400 fieldErrors {requiredTradeId}`; `expectedConfigVersion` mismatch → `409 WORK_TYPE_CONFIG_CONFLICT` + fieldErrors (optimistic locking); config đổi → `config_version` +1 (+ `warning` phạm vi áp dụng khi WO đang tham chiếu); idempotent repeat status → `alreadyInState` không audit; audit `PRJ_WORK_TYPE_CREATED`/`PRJ_WORK_TYPE_UPDATED`/`PRJ_WORK_TYPE_STATUS_CHANGED` tx-embedded (`entityType` `WORK_TYPE`). Picker `/active` + `requiredFields`/`configVersion` là contract sẵn sàng cho JOB publish và QUA-SRS-002 version snapshot (JOB module chưa tồn tại — không đụng).
- **Mẫu công việc (PRJ-SRS-008, `#39`, xem `ENDPOINTS.md` §16):** `POST`/`GET`/`GET /active`/`GET /:id`/`PATCH /:id`/`POST /:id/status` (`ACTIVATE`/`DEACTIVATE`) trên `/api/v1/work-order-templates` trong module `prj`; read + write = `ADMIN` + `PROJECT_MANAGER` (WORKER → `403`, anon → `401`; catalog toàn cục, không project-scope). Trùng code CI → `409 WORK_ORDER_TEMPLATE_CODE_DUPLICATE`; `workTypeId`/`requiredTradeId`/`requiredSkills[].code` không tồn tại/inactive → `400` fieldErrors; `sourceChecklistTemplateId` không tồn tại → `400`; `expectedVersion` mismatch → `409 WORK_ORDER_TEMPLATE_CONFIG_CONFLICT` (pre-check + SQL guard); nội dung đổi → `version` +1; DEACTIVATE từ DRAFT → `400`; ACTIVATE mẫu rỗng (thiếu skill + checklist) → `400`; idempotent repeat → `alreadyInState` không audit; audit `PRJ_WO_TEMPLATE_CREATED`/`PRJ_WO_TEMPLATE_UPDATED`/`PRJ_WO_TEMPLATE_STATUS_CHANGED` tx-embedded (`entityType` `WORK_ORDER_TEMPLATE`). KHÔNG endpoint `/apply` — prefill ở JOB-SRS-001 dùng `GET /active` + `GET /:id` (snapshot-copy, cho phép chỉnh trước khi lưu).
- **Tạo Work Order nháp (JOB-SRS-001, `#41`, xem `ENDPOINTS.md` §17):** `POST`/`GET /:id`/`GET /` (list) trên `/api/v1/work-orders` trong module mới `job` (mirror cấu trúc slice work-types `#35`); write = ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR (scope-first J1 — non-admin luôn `403` kể cả project missing), read = ADMIN bypass hoặc bất kỳ ACTIVE member nào (kể cả WORKER đọc nháp project mình; non-member `403` kể cả id không tồn tại). List: ADMIN = tất cả, non-ADMIN = WO các project member (`project_id = ANY(...)`, rỗng → `200 []`); filter `projectId`/`status`/`search` + `limit`/`offset`, response kèm `workTypeName?`/`projectName?` batch. `workTypeId` phải tồn tại VÀ ACTIVE, `areaId` cùng project VÀ ACTIVE, `requiredTradeId` ACTIVE → else `400` fieldErrors (thiếu `requiredTradeId` → auto-fill từ `work_types.required_trade_id`, gửi khác ngành yêu cầu → `400 fieldErrors {requiredTradeId}` — xem §17 J8); trùng code CI → `409 WORK_ORDER_CODE_DUPLICATE` (constraint-cụ-thể-trước, bare `23505` rethrow), absent → server sinh `WO-`+base36+rand; `requestKey` trùng → `200` + `idempotentReplay`, không audit mới (partial unique 0009); luôn `DRAFT`; audit `JOB_WORK_ORDER_CREATED` tx-embedded (`entityType` `WORK_ORDER`). Không gán/không job board (defer `#42`/`#44`).
- **Cập nhật Work Order (JOB-SRS-003, `#43`, xem `ENDPOINTS.md` §17 J7–J8):** `PATCH /api/v1/work-orders/:id` (write-scope của project chứa WO — ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR; non-member `403` kể cả id missing, ADMIN missing → `404`); state policy `DRAFT`/`READY` full 9 field → `OPEN` chỉ `description`/`instructions`/`dueAt`/`customFields` → `ASSIGNED`/`IN_PROGRESS` chỉ `description`/`instructions`/`customFields` (+ lịch/skill/work-type kèm `reason` bắt buộc) → `WORK_DONE`/`CLOSED`/`CANCELLED` toàn bộ khóa, chỉ ADMIN + reason ≥10 ký tự (ngoại lệ); field khóa → `400 WORK_ORDER_FIELD_LOCKED` per-field; `expectedVersion` mismatch → `409 WORK_ORDER_CONFLICT` (pre-check + SQL guard `AND version`); audit `JOB_WORK_ORDER_UPDATED` (before/after per-field changed) hoặc `WORK_ORDER_EXCEPTION_EDIT` tx-embedded, no-op không audit; đổi lịch/skill/work-type → 1 notification row cho creator trong cùng tx (`dedup_key` `woupd-<sha256(woId|fields|version)>`, fail → 500 rollback). Response summary thêm `dueAt` (cột `due_at` có sẵn từ 0001 — create để null) + `customFields` (`custom_fields` jsonb, migration 0011 — POST full object, PATCH partial merge; publish-check J8 đọc `required_fields` tùy chỉnh từ đây).
- **Bounded decisions** (chi tiết ở `ENDPOINTS.md` §7): team filter defer `#29` đã resolved cho crews; team filter workers defer `#30` (D9) đã đóng; project scope N/A (org-level directory, enforcement = role scope); PII giữ `email`/`phone` phục vụ điều phối, mapper không đổi.

## References

- [NestJS documentation](https://docs.nestjs.com/)
- [NestJS modules](https://docs.nestjs.com/modules)
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [nestjs-ddd-devops template](https://github.com/andrea-acampora/nestjs-ddd-devops)
- [System architecture and routing](../../ARCHITECTURE.md)
- [Data layer architecture](DATA.md)
- [Dockerized data-layer ADR](../adr/0002-dockerized-data-layer.md)
