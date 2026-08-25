# Data Layer Architecture — Docker, PostgreSQL và Redis

> **Status:** baseline được ghi nhận cho scaffold; chưa có `compose.yaml`, migration, schema hoặc adapter implementation.
> **Owner:** data service boundary, persistence/cache policy, Docker Compose và data-runtime proof.

## 1. Quyết định baseline

- **PostgreSQL** là nguồn dữ liệu giao dịch chính và system of record cho domain state.
- **Redis** là in-memory store cho cache và coordination ngắn hạn; mặc định không chứa domain truth.
- **Docker Compose** là boundary đóng gói và khởi động PostgreSQL/Redis cho local development và integration test.
- API là consumer duy nhất của data layer; web/mobile chỉ gọi API qua HTTP contract.
- Production hosting (self-hosted container hay managed service), backup/replication và version image cụ thể chưa được chốt.

Tài liệu này không biến Docker Compose thành production deployment policy. Khi production topology được quyết định, ghi ADR/owner document riêng và giữ interface adapter của API ổn định.

## 2. Topology

```text
                    ┌──────────────────────────┐
                    │ API infrastructure layer │
                    │ PostgreSQL adapter       │
                    │ Redis cache adapter      │
                    └─────────────┬────────────┘
                                  │ Docker network / connection URL
                    ┌─────────────▼────────────┐
                    │ Docker Compose            │
                    │  ├─ postgres              │
                    │  └─ redis                 │
                    └──────────────────────────┘
```

Target infrastructure layout:

```text
infra/
└── docker/
    ├── compose.yaml                 # local data services
    ├── postgres/                    # init/migration support nếu cần
    └── redis/                       # cache config nếu cần
```

`infra/docker/compose.yaml` là target path, hiện chưa tồn tại. Không đặt Docker service implementation vào `src/api/src/domain` hoặc vào client workspace.

## 3. PostgreSQL contract

### Vai trò

- Lưu entity/aggregate state, relationship, transaction và dữ liệu cần durability.
- Application use case đi qua repository port; PostgreSQL adapter nằm trong `src/api/src/modules/<context>/infrastructure/database`.
- Schema/migration do API/data owner quản lý; Docker chỉ cung cấp process/volume, không quyết định business model.

### Runtime policy

- Compose service name: `postgres`.
- Local port chỉ bind loopback khi expose ra host; container-to-container dùng service name, không hard-code IP.
- Dùng named volume cho local development để dữ liệu không mất khi container restart; test dùng volume/project cô lập.
- Readiness dùng `pg_isready`; API không coi container `started` đồng nghĩa database đã nhận connection.
- Credentials lấy từ env/secret mechanism; không commit password thật hoặc seed dữ liệu nhạy cảm.

### Không được làm

- Không cho web/mobile kết nối trực tiếp PostgreSQL.
- Không đưa ORM entity/decorator vào domain.
- Không dùng Redis để bypass transaction hoặc thay PostgreSQL cho domain truth.
- Không chỉnh schema thủ công ngoài migration đã owner.

## 4. Redis contract

### Vai trò mặc định

Redis chỉ được dùng cho:

- cache-aside/read cache có TTL và khả năng rebuild từ PostgreSQL;
- rate-limit/counter ngắn hạn nếu requirement cần;
- coordination/lock ngắn hạn khi có port và failure policy rõ.

Redis không phải source of truth. Cache miss phải có behavior rõ (thường đọc PostgreSQL); Redis outage không được làm mất domain state.

### Runtime policy

- Compose service name: `redis`.
- Healthcheck dùng `redis-cli PING` và không in password trong command/log.
- Mọi key phải có namespace, schema/version và TTL hoặc eviction policy được ghi rõ.
- Baseline cache không cần durable volume; dùng bounded memory/eviction policy phù hợp khi implementation được scaffold.
- Nếu Redis chuyển sang session durable, queue, event stream hoặc dữ liệu không thể rebuild, phải ghi ADR về persistence (AOF/RDB), backup, restore và failure semantics trước khi triển khai.

## 5. Docker Compose contract

Compose file phải thể hiện tối thiểu:

- services `postgres` và `redis` với image version được pin khi scaffold;
- named volume cho PostgreSQL;
- network nội bộ cho data services;
- healthcheck tương ứng (`pg_isready`, `redis-cli PING`);
- environment interpolation hoặc secret file, không hard-code credential;
- host port bind vào loopback nếu local access là cần thiết;
- restart/resource policy phù hợp local/integration, không ngầm coi là production HA.

API local config dùng connection URL/typed env tương ứng, ví dụ `DATABASE_URL` và `REDIS_URL`; tên cuối cùng phải được chốt trong API config owner. Trong Compose, API container (khi được thêm) dùng `postgres:5432` và `redis:6379`, không dùng `localhost` để gọi service khác.

## 6. Data flow và adapter seam

```text
Application use case
  ├── RepositoryPort ──► PostgreSQLAdapter ──► PostgreSQL
  └── CachePort ───────► RedisCacheAdapter ──► Redis
```

- `RepositoryPort` bảo vệ domain persistence invariant.
- `CachePort` là technical optimization; application phải có behavior khi cache miss/unavailable.
- Adapter nhận connection/config qua DI; không `new Redis()` hoặc tạo database client trong use case.
- Fake/in-memory adapter được dùng cho application test; integration test mới kiểm tra serialization/query/TTL thực tế.

## 7. Migration, backup và dữ liệu local

- Migration chạy qua API/data workflow, có thứ tự và proof; không để `docker compose up` tự ý mutate production schema.
- Local volume có thể xóa; không coi dữ liệu local là fixture canonical.
- Backup, restore, retention, replication, encryption at rest và disaster recovery chưa được quyết định; không ghi giả định production vào Compose file.
- Integration test dùng database/schema/project riêng và phải cleanup; không chạy destructive reset trên volume developer mặc định.

## 8. Proof và change routing

| Thay đổi | Proof tối thiểu |
| --- | --- |
| Compose/image/network/volume | `docker compose config`, healthcheck và startup/shutdown proof |
| PostgreSQL schema/migration | migration test, repository integration test, rollback/forward policy |
| Redis key/TTL/eviction | adapter test, TTL/expiry test, cache-miss/outage behavior |
| API persistence port | application tests với fake + integration adapter test |
| Production data topology | ADR, security/backup/recovery review và deployment proof |

Định tuyến thay đổi thuộc [`../../WORK-ROUTING.md`](../../WORK-ROUTING.md); lifecycle thuộc [`RUNTIME.md`](RUNTIME.md); API adapter thuộc [`API.md`](API.md).

## 9. Open questions

- Redis chỉ là cache hay có thêm rate limit/session/queue?
- Production dùng managed PostgreSQL/Redis hay tự vận hành container?
- Backup, migration runner, secret provider và observability nào là bắt buộc?

Các câu trả lời này không được suy đoán từ scaffold; ghi vào owner document/ADR khi có quyết định.

Đã chốt: ORM/query strategy = **Prisma**, xem [`ADR-0003`](../adr/0003-orm-prisma-postgresql.md).

## References

- [Docker Compose documentation](https://docs.docker.com/compose/)
- [PostgreSQL documentation](https://www.postgresql.org/docs/current/)
- [`pg_isready`](https://www.postgresql.org/docs/current/app-pg-isready.html)
- [Redis documentation](https://redis.io/docs/latest/)
- [System architecture](../../ARCHITECTURE.md)
