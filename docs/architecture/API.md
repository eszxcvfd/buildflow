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

## 7. Domain và application conventions

- Tên use case là động từ nghiệp vụ (`CreateX`, `RegisterY`), không phải tên CRUD chung chung nếu domain có ngôn ngữ chính xác hơn.
- Entity bảo vệ invariant bằng method có ý nghĩa; không public mutable field để controller tự sửa state.
- Value object validate khi tạo và bất biến sau khi tạo.
- Repository interface nằm gần domain cần nó; repository implementation nằm ở infrastructure.
- Domain event chỉ mô tả sự kiện đã xảy ra; handler ở application/integration quyết định side effect.
- DTO transport và domain type là hai interface khác nhau; mapper là seam, không dùng `as` để bỏ qua mapping.
- Không đưa `any`, ORM decorator hoặc Nest decorator vào domain.

## 8. Test và proof

| Phạm vi | Kiểm tra | Adapter |
| --- | --- | --- |
| Domain | invariant, value object, policy, event | in-memory/pure |
| Application | outcome của use case, port calls ở mức interface | fake/in-memory adapter |
| Infrastructure | mapping, query, serialization, external failure | test database/test server khi cần |
| E2E | HTTP status, validation, auth, response contract | boot Nest app với test config |

Test phải bảo vệ observable outcome qua interface. Không giữ production API/state chỉ để test gọi private implementation. Khi có contract hard cut, audit producer, consumer, generated artifact, fixture và snapshot cùng lúc. Data integration test phải có PostgreSQL readiness/migration proof và Redis TTL/cache-miss/outage proof khi adapter bị ảnh hưởng.

## 9. Cross-cutting tối thiểu

Các concern sau được bootstrap một lần ở composition root, nhưng policy chi tiết vẫn thuộc owner thích hợp:

- cấu hình typed và fail-fast khi thiếu biến bắt buộc;
- global validation/transform;
- exception filter map lỗi domain/application sang transport;
- request ID và structured logging;
- health liveness/readiness;
- API versioning và OpenAPI;
- authentication/authorization khi domain requirement được chốt.

PostgreSQL và Redis được chọn cho data baseline; chi tiết Docker/Compose, persistence, TTL/eviction, migration và production topology thuộc [`DATA.md`](DATA.md). ORM, auth provider và production hosting chưa được chốt.

## 10. Checklist thêm module

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
