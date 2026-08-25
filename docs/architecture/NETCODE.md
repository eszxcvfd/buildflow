# Network and API Contract Architecture

> **Status:** proposed current contract cho giai đoạn pre-implementation; chưa có endpoint/spec thực tế.
> **Owner:** API producer và mọi web/mobile consumer của wire contract.

## 1. Contract mặc định

- Transport: HTTPS trong môi trường được triển khai; HTTP chỉ dùng local development.
- Format: JSON UTF-8.
- Style: REST resource/command endpoints, do NestJS API sở hữu.
- Description: OpenAPI là artifact kiểm tra và sinh typed client; source contract nằm trong API workspace. Toolchain đã chốt: `@nestjs/swagger` sinh OpenAPI document từ API workspace; web tiêu thụ qua types sinh bởi `openapi-typescript` — không sửa generated file thủ công.
- Prefix đề xuất: `/api/v1`; health/readiness có thể nằm ở `/health/*` để không bị coi là business resource.
- Web/mobile không gọi database, không gọi private Nest provider và không import source từ `src/api`.

Đây là baseline để scaffold, không phải claim rằng repo đã có OpenAPI document. Khi endpoint đầu tiên được chấp nhận, cần tạo spec/generator và thay các placeholder bằng schema thật.

## 2. Ranh giới sở hữu

```text
src/api
  ├── owns domain/application meaning
  ├── owns HTTP DTO + OpenAPI schema
  └── publishes generated client/model artifact
       ├── src/web consumer
       └── src/mobile consumer
```

- Domain entity không phải wire DTO.
- API response mapper là seam giữa application result và public contract.
- Web/mobile có view model riêng khi presentation cần shape khác; không để generated DTO lan khắp UI.
- Nếu hai consumer cần cùng một field, field vẫn phải được API contract owner chốt; không tự tạo shared type để vượt qua API.

## 3. Shape và quy ước cần chốt khi có domain

Baseline chỉ quy định các invariant kỹ thuật sau; tên resource/field phải đến từ domain language:

- ID có format ổn định và được validate ở transport boundary.
- Timestamp dùng ISO 8601 UTC; client không suy đoán timezone từ string không rõ nghĩa.
- Enum và discriminator là closed set cho current contract; thêm giá trị phải audit toàn bộ consumer.
- Request validation trả lỗi có thể map theo field; server vẫn là authority cho invariant/authorization.
- Collection endpoint phải công bố rõ pagination, sorting, filtering và total/next cursor semantics; không tự thêm pagination chung khi chưa có use case.

Shape lỗi đề xuất (Problem Details-inspired, cần freeze cùng OpenAPI):

```json
{
  "type": "https://example.invalid/problems/validation-error",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "detail": "Request contains invalid fields",
  "traceId": "request-trace-id",
  "errors": {
    "field": ["reason"]
  }
}
```

`type`, `code`, field names và status mapping là public contract; đừng expose stack trace, ORM error hoặc secret.

## 4. Versioning và compatibility

Repo đang ở scaffold/pre-publication theo bounded inference từ việc chưa có source/package/release artifact. Khi contract được chốt trước public shipment:

- giữ đúng một current contract;
- validate contract trước khi mutate state;
- breaking change cập nhật producer, consumer, generated artifact, test và fixture cùng một change;
- không dual-read/dual-write, không fallback diễn giải version cũ và không thêm compatibility facade chỉ để giữ tên cũ;
- giữ `v1` là current API version cho đến khi có public compatibility policy thật sự.

Sau public shipment, bất kỳ thay đổi tương thích/ngắt tương thích nào phải được ghi ADR; không tự mở `v2` trong client để che một contract chưa quyết định.

## 5. Auth, headers và observability

Auth mechanism đã chốt cho v1: **bearer opaque token** lưu hash trong bảng sessions của PostgreSQL, revoke bằng cách xóa dòng; mật khẩu hash bcrypt cost 12 — xem [`ADR-0005`](../adr/0005-opaque-session-tokens.md). Provider bên ngoài và refresh-token policy chưa chốt.

Các metadata kỹ thuật nên chuẩn hóa ở transport adapter:

- request/correlation ID;
- content type và cache semantics;
- timeout/retry policy theo endpoint idempotency;
- rate limit response nếu product cần;
- structured error và redaction policy.

Không retry mù mutation; không log token, credential, PII hoặc raw request body không cần thiết.

## 6. Contract change procedure

1. Owner API mô tả use case và schema trong `API.md`/OpenAPI.
2. Đánh giá breaking surface: endpoint, DTO, enum, error, auth, generated artifact.
3. Cập nhật API producer trước; viết contract/application tests.
4. Regenerate/audit web và mobile consumer; không sửa generated file thủ công.
5. Chạy proof theo [`docs/process/DEVELOPMENT.md`](../process/DEVELOPMENT.md).
6. Ghi decision/unknown vào ADR nếu trade-off khó đảo ngược.

## 7. Open questions

Các câu hỏi sau cố ý chưa đoán:

- Domain resource và bounded context nào sẽ xuất hiện đầu tiên?
- REST có đủ cho mọi consumer hay có use case cần GraphQL/streaming?
- Persistence, file upload và rate limit do hệ thống nào sở hữu?


Câu trả lời phải được ghi ở owner document/ADR trước khi trở thành rule.

Đã chốt: auth/session = bearer opaque token trong PostgreSQL (ADR-0005); OpenAPI generation chạy trong API workspace bằng `@nestjs/swagger`, web dùng types từ `openapi-typescript`.

## References

- [NestJS documentation](https://docs.nestjs.com/)
- [NestJS DDD/DevOps template](https://github.com/andrea-acampora/nestjs-ddd-devops)
- [Next.js documentation](https://nextjs.org/docs)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [Workspace routing](../../WORK-ROUTING.md)
