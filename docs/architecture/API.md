# API Architecture — NestJS

> **Status:** target design cho `src/api`; hiện chưa có source code hoặc package manifest.
> **Owner:** API workspace và mọi thay đổi domain/transport của server.

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
- Response `data[]` item gồm các trường: `id`, `actorUserId`, `action`, `entityType`, `entityId`, `beforeData`, `afterData`, `reason`, `result`, `ipAddress`, `userAgent`, `correlationId`, `createdAt`. `reason` là lý do nghiệp vụ nullable do producer ghi (write path hiện tại chưa ghi `reason` → thường `null`).

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
- **Producer coverage (một phần, theo scope IAM-SRS-008):** 3 producer đọc `X-Correlation-Id` từ request và đưa vào audit payload — role assignment (strict), status change `PATCH /api/v1/admin/users/:id/status` (strict) và login (lenient). 7 producer còn lại (create/update user, logout, các password flow, profile) chưa wire header — event của họ luôn insert (không dedup); wire thêm là follow-up khi cần. Retry cùng header trên producer đã wire: `AUTH_LOGIN_*` dedup thành đúng một record; audit của status change bị dedup thành no-op — business write vẫn commit, không abort (xem 8.4).
- **Policy header phân theo loại endpoint:** `X-Correlation-Id` trên các endpoint **admin** (role assignment, status change) phải là UUID — controller trả `400` nếu sai vì `audit_logs.correlation_id` là `uuid` (message actionable: `X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)`). Login là endpoint **public** nên xử lý **lenient**: header thiếu hoặc không phải UUID → `correlationId: undefined` (audit vẫn ghi với `correlation_id` null, không dedup); header sai **không bao giờ** block/400 login.

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

## References

- [NestJS documentation](https://docs.nestjs.com/)
- [NestJS modules](https://docs.nestjs.com/modules)
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [nestjs-ddd-devops template](https://github.com/andrea-acampora/nestjs-ddd-devops)
- [System architecture and routing](../../ARCHITECTURE.md)
- [Data layer architecture](DATA.md)
- [Dockerized data-layer ADR](../adr/0002-dockerized-data-layer.md)
