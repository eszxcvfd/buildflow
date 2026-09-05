# Endpoint contract — ORG catalog slices (workers/contractors/trades)

> **Owner:** API/Contract workspace (xem [`WORK-ROUTING.md`](../../WORK-ROUTING.md) — HTTP endpoint/DTO/validation thuộc `src/api` Contract lane).
> **Phạm vi:** các endpoint org catalog đã implement theo vertical slice `#24` (`ORG-SRS-001` workers), `#25` (`ORG-SRS-002` contractors) và `#26` (`ORG-SRS-003` trades). Đây là contract công bố cho web/mobile; thay đổi breaking phải route qua `NETCODE.md` và đồng bộ consumer trong cùng thay đổi.
> **File gốc:** endpoint policy được cập nhật cùng slice trong `docs/architecture/API.md`; file này chép/bám sát nội dung đó để làm tài liệu tra cứu endpoint (không tạo một policy thứ hai).

---

## 1. Nguyên tắc chung

- Base path versioned: `/api/v1`.
- Tất cả endpoint dưới đây là **ADMIN-only**, yêu cầu JWT bắt buộc: chưa xác thực → `401`; đã xác thực nhưng không phải ADMIN → `403`.
- **Strict `X-Correlation-Id` policy** (admin/management, IAM-SRS-008): header thiếu/không gửi là hợp lệ → audit ghi `correlation_id` null; header có mặt nhưng không phải UUID → `400` với message `X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)`, request không vào use case.
- Mọi write chạy **tx-embedded audit** (`AuditPort.logWithClient`) — ghi nghiệp vụ + audit cùng transaction; audit thất bại thật = `500`, rollback nguyên tử. `ux_audit_correlation_action` dedup khi retry cùng `X-Correlation-Id`.
- Error mapping chung: `400` validation/status không hợp lệ (body sai bị ValidationPipe chặn trước khi vào use case); `401` chưa xác thực; `403` non-admin; `404` không tìm thấy (không leak tồn tại qua lỗi khác biệt); `409` trùng mã/khóa unique; `500` lỗi hệ thống/audit.
- Catalog đã dùng **không hard delete** — không có DELETE endpoint; chỉ deactivate qua status endpoint.
- Audit no-secrets: `beforeData`/`afterData` chỉ chứa public fields (xem 8.5 API.md); key `_warning` (khi có) là text tiếng Việt, hợp lệ với `AuditLogEntity.isSanitized()`.

## 2. Workers — ORG-SRS-001 (#24)

| Method | Path | Body | Response | Lỗi |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/workers` | `{ email, password, fullName, phone?, avatarUrl?, employeeCode?, contractorId?, trades?: [{ tradeId, skillLevel 1-5 }] }` | `200` worker profile | `400`/`409` trùng email hoặc employeeCode; `400` trade inactive/không tồn tại |
| GET | `/api/v1/workers` | query `status` (`ACTIVE`/`INACTIVE`/`LOCKED`), `search`, `tradeId`, `skillLevel`, `limit` (1-100, default 20), `offset` (≥0) | `200 { data[], total, limit, offset }` | `400` query sai |
| GET | `/api/v1/workers/:id` | — | `200` worker profile | `400` id sai; `404` |
| PATCH | `/api/v1/workers/:id` | `{ fullName?, phone?, avatarUrl?, employeeCode?, contractorId?, trades? }` | `200` worker profile | `400`/`409`; `404` |

- Audit actions: `ORG_WORKER_CREATED`, `ORG_WORKER_UPDATED` (xem 8.2 API.md). Worker trong org module quản lý profile + trades; account IAM lifecycle (status) nằm ở `/api/v1/admin/users/:id/status`.
- Trade gán cho worker phải đang ACTIVE — inactive không qua được (không dùng cho phân công mới).
- **PATCH `/workers/:id` — `trades` = replace toàn bộ:** nếu payload có gửi `trades` thì danh sách đó **thay thế toàn bộ** trades hiện có của worker (row cũ bị deactivate, insert row mới). Client giữ nguyên phần ngành nghề phải **OMIT** key `trades` khỏi payload; không có khái niệm gửi danh sách trống để “giữ nguyên”.

## 3. Contractors — ORG-SRS-002 (#25)

| Method | Path | Body | Response | Lỗi |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/contractors` | `{ code, name, contactName, phone?, email?, scope, status? }` | `200` contractor profile (`eligible` = ACTIVE) | `400`; `409` trùng code |
| GET | `/api/v1/contractors` | query `status`, `search`, `scope`, `eligibleOnly`, `limit`, `offset` | `200 { data[], total, limit, offset }` | `400` query sai (eligibleOnly + INACTIVE bị chặn) |
| GET | `/api/v1/contractors/:id` | — | `200` contractor profile | `400` id sai; `404` |
| PATCH | `/api/v1/contractors/:id` | `{ code?, name?, contactName?, phone?, email?, scope?, status? }` | `200` contractor profile | `400`; `409` trùng code (excl. self); `404` |

- Same-status PATCH là no-op idempotent (không reject) — form edit luôn kèm status hiện tại (#25).
- Deactivate contractor đang có lịch sử: vẫn cho phép (không hard delete), audit afterData gắn `_warning: 'Nhà thầu có lịch sử công việc, không xóa liên kết'`.
- Audit actions: `ORG_CONTRACTOR_CREATED`, `ORG_CONTRACTOR_UPDATED`, `ORG_CONTRACTOR_STATUS_CHANGED` (khi status thật sự đổi).
- Code rules: 2-50 ký tự, `^[A-Za-z0-9_-]+$`; name 2-200; contactName bắt buộc ≤150; scope bắt buộc ≤1000; phone/email optional.

## 4. Trades — ORG-SRS-003 (#26)

Danh mục ngành nghề/kỹ năng. Bảng `public.trades` (migration 0001): `code varchar(50)` unique `ux_trades_code`, `name varchar(120)`, `description varchar(500)`, `is_active boolean`. FK tham chiếu: `resource_trades.trade_id`, `work_types.required_trade_id`, `work_orders.required_trade_id` — catalog đã tham chiếu **chỉ được ngừng hoạt động**, không hard delete, không migration mới.

| Method | Path | Body | Response | Lỗi |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/trades` | `{ code, name, description?, status? }` | `200` trade profile | `400` validation; `409` trùng `code` |
| GET | `/api/v1/trades` | query `status` (`ACTIVE`/`INACTIVE`/`ALL`, thiếu = ALL), `search` (ILIKE code/name), `limit` (1-100, default 20), `offset` (≥0) | `200 { data[], total, limit, offset }` sort theo `name` | `400` query sai |
| GET | `/api/v1/trades/:id` | — | `200` trade profile | `400` id sai; `404` |
| PATCH | `/api/v1/trades/:id` | `{ code?, name?, description? }` | `200` trade profile | `400`; `409` trùng code (excl. self); `404` |
| PATCH | `/api/v1/trades/:id/status` | `{ status: 'ACTIVE' \| 'INACTIVE' }` | `200` trade profile, kèm `warning` nếu có | `400` status không hợp lệ/same-status; `404` |

Rules:

- Code: 2-50 ký tự, `^[A-Za-z0-9_-]+$`. Name: 1-120 ký tự. Description: optional, ≤500 ký tự.
- Create: dup code pre-check (`findByCode`) + race guard trong transaction (23505/`ux_trades_code` → `409`); mặc định `ACTIVE` khi không gửi `status`.
- **Deactivate đang được dùng:** được phép (SRS: catalog đã dùng chỉ ngừng hoạt động) nhưng nếu `countActiveUsage(tradeId) > 0` (reference đang hiệu lực: `resource_trades` is_active=true, `work_types.required_trade_id` is_active=true, `work_orders.required_trade_id` status ∉ CANCELLED/CLOSED, đếm qua UNION không double-count) thì response kèm `warning: 'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực'` và audit afterData gắn `_warning` cùng text — payload vẫn pass no-secrets sanitize. Reactivate không tính usage.
- Response trade profile: `{ id, code, name, description, status, assignable, createdAt, updatedAt, warning? }` (`assignable` = đang ACTIVE; `warning` chỉ xuất hiện khi deactivate đang dùng).
- Không có DELETE; inactive trade vẫn truy được chi tiết (lịch sử catalog).
- Audit actions: `ORG_TRADE_CREATED` (afterData), `ORG_TRADE_UPDATED` (before/afterData), `ORG_TRADE_STATUS_CHANGED` (before/afterData).

## 5. Audit action list (bổ sung org trades)

Strict `X-Correlation-Id` producer (bảng 8.2 API.md):

| Endpoint | Audit action |
| --- | --- |
| `POST /api/v1/trades` | `ORG_TRADE_CREATED` |
| `PATCH /api/v1/trades/:id` | `ORG_TRADE_UPDATED` |
| `PATCH /api/v1/trades/:id/status` | `ORG_TRADE_STATUS_CHANGED` |

## References

- [`docs/architecture/API.md`](API.md) — module/domain conventions, audit policy (8.2/8.3/8.4/8.5)
- [`docs/architecture/NETCODE.md`](NETCODE.md) — transport/error contract
- SRS/issue: workers `#24`, contractors `#25`, trades `#26`
