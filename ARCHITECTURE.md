# Kiến trúc hệ thống

> **Trạng thái:** baseline đề xuất cho giai đoạn scaffold; chưa phải mô tả runtime đã triển khai.
> **Phạm vi:** ba workspace hiện có trong `src/`: API, web và mobile.

## 1. Định hướng

### Sự thật đã kiểm chứng

- Repo hiện chỉ có ba thư mục khung rỗng: `src/api`, `src/web` và `src/mobile`.
- Chưa có `package.json`, entry point, schema, database adapter hay pipeline build trong các workspace.
- Vì vậy, các entry point và cây thư mục bên dưới là **target design**, không được hiểu là code đã tồn tại.

### Mục tiêu sản phẩm/kỹ thuật

- Xây API NestJS dạng **modular monolith**, tổ chức theo bounded context/feature và áp dụng Clean Architecture.
- Xây web bằng React + Next.js App Router + TypeScript; tổ chức theo feature, dùng Ark UI làm lớp primitive accessible/headless.
- Giữ mobile là một client mỏng, ưu tiên React Native + TypeScript + Expo framework; chỉ mở rộng native khi có nhu cầu thật.
- Cho phép web và mobile phát hành độc lập nhưng dùng chung hợp đồng API do API workspace sở hữu.
- Giữ domain logic độc lập với HTTP, Next.js, Ark UI, React Native, ORM và nhà cung cấp hạ tầng.

### Các mục tiêu không thuộc baseline này

- Chưa tách microservice, chưa đưa message broker hoặc event bus phân tán vào hệ thống.
- Chưa chọn database, ORM, cloud provider, authentication provider hay package manager cụ thể.
- Không dùng Next.js Route Handler để nhân bản domain logic của NestJS; `src/web/src/app/api` (nếu cần) chỉ dành cho BFF/webhook thật sự.
- Không dùng Ark UI trực tiếp cho mobile; Ark UI là primitive cho web, mobile có lớp native UI riêng.
- Không tạo một shared UI package giữa DOM và native chỉ để tránh lặp mã.

## 2. Hình dạng tổng thể

```text
                  ┌──────────────────────┐
                  │  Web: Next.js        │
                  │  App Router + Ark UI │
                  └──────────┬───────────┘
                             │ HTTPS / JSON / OpenAPI
                  ┌──────────▼───────────┐
                  │  API: NestJS         │
                  │  Modular Monolith    │
                  │  DDD + Clean Arch    │
                  └───────┬───────┬──────┘
                          │       │
                 adapters │       │ adapters
                          │       │
             ┌────────────▼─┐   ┌─▼────────────┐
             │ persistence  │   │ external     │
             │ / queues     │   │ integrations │
             └──────────────┘   └──────────────┘

                  ┌──────────────────────┐
                  │  Mobile: React Native│
                  │  TypeScript + Expo   │
                  └──────────┬───────────┘
                             └── HTTPS / JSON / OpenAPI
```

### Data layer

```text
API infrastructure adapters
  ├── PostgreSQL  → system of record / transactional state
  └── Redis       → cache / short-lived coordination

Docker Compose packages the local and integration data services.
```

PostgreSQL là nguồn dữ liệu giao dịch chính. Redis mặc định chỉ là cache/coordination không authoritative; Docker Compose quản lý process, network, healthcheck và local volume theo [`docs/architecture/DATA.md`](docs/architecture/DATA.md).
API là nơi sở hữu domain và hợp đồng giao tiếp. Web/mobile chỉ sở hữu presentation, state của client và trải nghiệm theo nền tảng; chúng không import code nội bộ của API.

## 3. Bản đồ workspace

| Workspace | Vai trò | Entry point mục tiêu | Tài liệu owner |
| --- | --- | --- | --- |
| `src/api` | API và domain server | `src/api/src/main.ts` | [`docs/architecture/API.md`](docs/architecture/API.md) |
| Data layer | PostgreSQL + Redis qua Docker Compose | `infra/docker/compose.yaml` (target) | [`docs/architecture/DATA.md`](docs/architecture/DATA.md) |
| `src/web` | Web app và web routing | `src/web/src/app/layout.tsx` | [`docs/architecture/WEB.md`](docs/architecture/WEB.md) |
| `src/mobile` | Mobile client | `src/mobile/app/_layout.tsx` | [`docs/architecture/MOBILE.md`](docs/architecture/MOBILE.md) |
| Giao tiếp giữa workspace | HTTP/JSON và OpenAPI | API contract | [`docs/architecture/NETCODE.md`](docs/architecture/NETCODE.md) |
| Vòng đời chạy | startup, health, deploy boundary | từng workspace | [`docs/architecture/RUNTIME.md`](docs/architecture/RUNTIME.md) |

Cây target tối thiểu:

```text
src/
├── api/                    # NestJS modular monolith
├── web/                    # Next.js App Router
└── mobile/                 # React Native + Expo
```

Infrastructure target:

```text
infra/
└── docker/
    └── compose.yaml        # PostgreSQL + Redis for local/integration
```
Cấu hình build, biến môi trường và dependency của từng workspace nằm trong workspace đó; không đặt một `src/` dùng chung cho cả ba nền tảng. Khi cần chia sẻ artifact, chỉ chia sẻ contract/generated artifact có owner rõ ràng, không chia sẻ domain implementation hay UI.

## 4. Nguyên tắc phụ thuộc

Phụ thuộc luôn hướng vào chính sách nghiệp vụ và interface nhỏ hơn:

```text
Web/Mobile presentation
        │ HTTP client / generated contract
        ▼
API transport adapter
        ▼
Application use case / handler
        ▼
Domain model
        ▲
Infrastructure adapter implements port
```

- `domain` không biết NestJS, decorator HTTP, ORM, database, logger cụ thể hoặc framework UI.
- `application` điều phối use case, nhận port/interface và không tạo adapter hạ tầng trực tiếp.
- `infrastructure` triển khai port bằng database, HTTP client, queue hoặc SDK bên ngoài.
- `api` ở backend chỉ parse/validate transport và map request/response; controller không chứa luật nghiệp vụ.
- Feature web/mobile chỉ đi qua public interface của feature; không import file nội bộ của feature khác.
- Một module sâu nên có interface nhỏ, che giấu nhiều implementation; seam chỉ được mở khi có biến thiên thật (production adapter và test adapter là hai adapter hợp lệ).

## 5. Luồng request chuẩn

```text
HTTP request
  → guard / pipe / validation
  → controller
  → command/query + use case
  → entity / value object / domain policy
  → repository or external port
  → infrastructure adapter
  → response mapper / DTO
  → HTTP response
```

Web và mobile không gọi database, không đọc event nội bộ của API và không quyết định trạng thái domain. Nếu cần dữ liệu mới, thay đổi tại API contract trước, sau đó cập nhật client consumer.

## 6. Trạng thái quyết định

| Quyết định | Trạng thái | Ghi chú |
| --- | --- | --- |
| API modular monolith + Clean Architecture | Chấp nhận cho baseline | Giảm chi phí vận hành, vẫn giữ seam để tách sau này. |
| Web feature-based + Next App Router | Chấp nhận cho baseline | Route composition tách khỏi feature implementation. |
| Ark UI headless cho web | Chấp nhận cho baseline | Ark UI cung cấp behavior/accessibility; repo sở hữu styling/token. |
| Mobile React Native + Expo + TypeScript | Đề xuất mạnh | Mobile ít dùng; framework giảm boilerplate native. Xem [`MOBILE.md`](docs/architecture/MOBILE.md). |
| REST/JSON + OpenAPI | Đề xuất mặc định | Sẽ trở thành contract chính khi endpoint đầu tiên được chấp nhận. |
| PostgreSQL + Docker Compose | Chấp nhận cho data baseline | PostgreSQL là system of record; Compose là local/integration packaging. |
| Redis cache/coordination | Chấp nhận có giới hạn | Không authoritative; TTL/eviction mặc định; durable use case cần ADR. |
| ORM cho PostgreSQL | Chấp nhận cho data baseline | Prisma, pin version khi cài; xem [`ADR-0003`](docs/adr/0003-orm-prisma-postgresql.md). |
| Auth/cloud/production data hosting | Chưa quyết định | Chỉ quyết định khi có requirement và owner tương ứng. |

Các quyết định có trade-off lớn được ghi tại [`docs/adr/0001-workspace-boundaries.md`](docs/adr/0001-workspace-boundaries.md), [`docs/adr/0002-dockerized-data-layer.md`](docs/adr/0002-dockerized-data-layer.md), [`docs/adr/0003-orm-prisma-postgresql.md`](docs/adr/0003-orm-prisma-postgresql.md) và [`docs/adr/0004-single-winner-claim-postgresql.md`](docs/adr/0004-single-winner-claim-postgresql.md). Data boundary thuộc [`docs/architecture/DATA.md`](docs/architecture/DATA.md); nguồn tham khảo framework/hạ tầng thuộc [`docs/architecture/STACK-REFERENCES.md`](docs/architecture/STACK-REFERENCES.md).

## 7. Routing tài liệu

- Định tuyến thay đổi giữa workspace: [`WORK-ROUTING.md`](WORK-ROUTING.md).
- Quyền sở hữu tài liệu: [`docs/README.md`](docs/README.md).
- Lane và bằng chứng cần có: [`docs/process/DEVELOPMENT.md`](docs/process/DEVELOPMENT.md).
- Runtime: [`docs/architecture/RUNTIME.md`](docs/architecture/RUNTIME.md).
- Protocol/contract: [`docs/architecture/NETCODE.md`](docs/architecture/NETCODE.md).
- Data layer: [`docs/architecture/DATA.md`](docs/architecture/DATA.md).

Nếu code và tài liệu mâu thuẫn, cập nhật tài liệu owner hoặc ghi bounded inference trước khi dùng quy tắc mới. Không tạo routing rule thứ hai trong issue, skill hoặc workspace README.

## 8. Bằng chứng hiện tại và việc cần làm tiếp

Baseline này được xây từ skeleton directory và các tài liệu framework/template được liệt kê trong phần References. Chưa chạy được test/build vì repo chưa có toolchain hoặc source code.

Việc triển khai tiếp theo nên đi theo thứ tự:

1. Chốt domain language và bounded context thật trong một ADR/CONTEXT khi nghiệp vụ được cung cấp.
2. Scaffold độc lập `src/api`, `src/web`, `src/mobile`; khóa scripts/typecheck/lint của từng workspace.
3. Scaffold `infra/docker/compose.yaml`, healthcheck và local env cho PostgreSQL/Redis.
4. Tạo API contract đầu tiên và generated client cho web/mobile.
5. Xây vertical slice đầu tiên qua API → PostgreSQL/Redis adapter → web; chỉ sau đó mở mobile flow tối thiểu.

## References

- [NestJS documentation](https://docs.nestjs.com/)
- [NestJS DDD/DevOps template](https://github.com/andrea-acampora/nestjs-ddd-devops)
- [Next.js documentation](https://nextjs.org/docs)
- [Next feature-based template](https://github.com/rufatalv/next-feature-based)
- [Ark UI](https://ark-ui.com/)
- [React Native getting started](https://reactnative.dev/docs/getting-started)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/)
- [Redis documentation](https://redis.io/docs/latest/)
