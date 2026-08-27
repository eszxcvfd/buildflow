# Runtime Architecture

> **Status:** target runtime model; chưa có process/config thực tế trong repo.
> **Owner:** lifecycle, startup, health, environment và deploy boundary của các workspace.

## 1. Runtime units

| Unit | Runtime role | Sở hữu |
| --- | --- | --- |
| API process | nhận HTTP, chạy application/domain, gọi infrastructure adapter | `src/api` |
| Web runtime | render Next Server Components và phục vụ browser assets/client interactions | `src/web` |
| Mobile app | bundle React Native chạy trên iOS/Android, gọi API qua network | `src/mobile` |
| PostgreSQL service | transactional persistence và system of record | `infra/docker` + API data owner |
| Redis service | cache/short-lived coordination, không authoritative | `infra/docker` + API data owner |
| Other persistence/external systems | queue, storage, third-party API khi được chọn | API infrastructure owner |

Ba workspace là ba ownership/deploy boundary logic; việc chúng có cùng container/CI job ở môi trường đầu tiên là quyết định vận hành, không làm chúng thành một source dependency graph.

## 2. Startup và lifecycle target

### API

```text
process start
  → load typed config
  → initialize logging/trace
  → initialize infrastructure adapters
  → verify PostgreSQL/Redis readiness required by the API
  → register Nest modules
  → expose HTTP + health
  → graceful shutdown
```

- Fail fast khi config bắt buộc không hợp lệ.
- Module initialization không được chứa business migration tùy tiện; migration/schema lifecycle phải có owner hạ tầng rõ.
- Graceful shutdown phải dừng nhận request mới và đóng adapter/network resource.
- Liveness trả lời process có chạy; readiness chỉ true khi dependency bắt buộc cho request đã sẵn sàng.

### Data layer

```text
Docker Compose up
  → postgres/redis process start
  → healthcheck: pg_isready + redis-cli PING
  → API data adapters connect by service name
  → API readiness reflects required data dependencies
  → graceful shutdown preserves PostgreSQL data volume and drops ephemeral Redis state
```

- PostgreSQL schema/migration lifecycle belongs to API/data owner; Compose does not mutate production schema.
- Redis is cache/coordination by default; cache miss/outage behavior must degrade safely and never replace domain state.

### Web

```text
Next build/start
  → load server-safe config
  → render root/layout route
  → Server Component fetch API khi cần
  → hydrate Client Component leaf
  → browser interaction → API adapter
```

- Secret/private env chỉ ở server graph.
- Client bundle chỉ nhận public-safe config và serializable props.
- BFF/webhook route (nếu có) phải có owner và timeout/error policy riêng.

### Mobile

```text
native app launch
  → load config
  → restore session
  → mount providers
  → resolve Expo route
  → screen state + API calls
  → background/foreground handling
```

- App phải biểu diễn loading, offline, expired session và retry; không giả định network luôn có.
- Native permission/capability được gọi qua adapter, có fallback khi bị từ chối.

## 3. State ownership

- **Domain state:** API; chỉ mutation qua application use case.
- **Request/cache state:** mỗi client; cache policy không thay đổi domain truth.
- **Persistent data:** PostgreSQL; Redis keys are rebuildable/TTL-bounded unless a separate durability decision exists.
- **Session state:** mechanism chưa chốt; owner sẽ là auth decision, client chỉ consume trạng thái public.
- **UI state:** feature của web/mobile; không gửi UI state thành domain field nếu không có ý nghĩa nghiệp vụ.
- **Generated contract:** API producer; client artifact phải được regenerate khi contract đổi.

## 4. Environment và deploy boundary

Mỗi workspace giữ biến môi trường cần cho runtime của mình:

- API: private server config, `DATABASE_URL`, `REDIS_URL`, database/external credentials, public API config.
- Data services: Compose service names/ports, volume and cache policy; credentials come from env/secret mechanism, never committed.
- Web: public URL/config ở client; private server-only config ở Next server runtime.
- Mobile: build-time public config; không bundle secret server.

Docker Compose path, image versions, secret provider, cloud region, backup policy và CI/CD chưa được chốt. Không đưa credential vào repository, không dùng web env như mobile secret, và không expose PostgreSQL/Redis publicly by default.

## 5. Health, observability và failure

Khi API được scaffold, tối thiểu cần:

- liveness/readiness endpoint;
- structured logs với request/correlation ID;
- error redaction và mapping theo `NETCODE.md`;
- timeout cho external adapter;
- PostgreSQL readiness (`pg_isready`) và Redis connectivity (`redis-cli PING`);
- Redis TTL/eviction, cache-miss và outage metrics/policy khi cache được dùng.
- metric/tracing decision nếu latency/scale yêu cầu.

Web/mobile phải map lỗi transport về user state và retry đúng idempotency; không nuốt lỗi hoặc hiện stack trace production.

## 6. Runtime change proof

- API bootstrap/config/health: startup, readiness, graceful-shutdown hoặc integration proof.
- Web server/client boundary: build và route/browser smoke proof.
- Mobile lifecycle/native capability: typecheck và device/simulator smoke proof.
- Cross-workspace contract: producer + generated artifact + consumer proof trong cùng change.
- Data layer: `docker compose config`, service health, migration/repository integration và Redis TTL/outage proof.

Repo hiện chưa có toolchain nên chưa có runtime proof nào được coi là pass. Lane và closeout thuộc [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md).

## References

- [System architecture](../../ARCHITECTURE.md)
- [API architecture](API.md)
- [Web architecture](WEB.md)
- [Mobile architecture](MOBILE.md)
- [Network/API contract](NETCODE.md)
- [Data layer architecture](DATA.md)
- [Dockerized data-layer ADR](../adr/0002-dockerized-data-layer.md)
