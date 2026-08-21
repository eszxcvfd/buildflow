# Runtime Architecture

> **Status:** target runtime model; chưa có process/config thực tế trong repo.
> **Owner:** lifecycle, startup, health, environment và deploy boundary của các workspace.

## 1. Runtime units

| Unit | Runtime role | Sở hữu |
| --- | --- | --- |
| API process | nhận HTTP, chạy application/domain, gọi infrastructure adapter | `src/api` |
| Web runtime | render Next Server Components và phục vụ browser assets/client interactions | `src/web` |
| Mobile app | bundle React Native chạy trên iOS/Android, gọi API qua network | `src/mobile` |
| Persistence/external systems | database, queue, storage, third-party API khi được chọn | API infrastructure owner |

Ba workspace là ba ownership/deploy boundary logic; việc chúng có cùng container/CI job ở môi trường đầu tiên là quyết định vận hành, không làm chúng thành một source dependency graph.

## 2. Startup và lifecycle target

### API

```text
process start
  → load typed config
  → initialize logging/trace
  → initialize infrastructure adapters
  → register Nest modules
  → expose HTTP + health
  → graceful shutdown
```

- Fail fast khi config bắt buộc không hợp lệ.
- Module initialization không được chứa business migration tùy tiện; migration/schema lifecycle phải có owner hạ tầng rõ.
- Graceful shutdown phải dừng nhận request mới và đóng adapter/network resource.
- Liveness trả lời process có chạy; readiness chỉ true khi dependency bắt buộc cho request đã sẵn sàng.

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
- **Session state:** mechanism chưa chốt; owner sẽ là auth decision, client chỉ consume trạng thái public.
- **UI state:** feature của web/mobile; không gửi UI state thành domain field nếu không có ý nghĩa nghiệp vụ.
- **Generated contract:** API producer; client artifact phải được regenerate khi contract đổi.

## 4. Environment và deploy boundary

Mỗi workspace giữ biến môi trường cần cho runtime của mình:

- API: private server config, database/external credentials, public API config.
- Web: public URL/config ở client; private server-only config ở Next server runtime.
- Mobile: build-time public config; không bundle secret server.

Tên biến, secret provider, container, cloud region và CI/CD chưa được chốt. Không đưa credential vào repository hoặc dùng web env như mobile secret.

## 5. Health, observability và failure

Khi API được scaffold, tối thiểu cần:

- liveness/readiness endpoint;
- structured logs với request/correlation ID;
- error redaction và mapping theo `NETCODE.md`;
- timeout cho external adapter;
- metric/tracing decision nếu latency/scale yêu cầu.

Web/mobile phải map lỗi transport về user state và retry đúng idempotency; không nuốt lỗi hoặc hiện stack trace production.

## 6. Runtime change proof

- API bootstrap/config/health: startup, readiness, graceful-shutdown hoặc integration proof.
- Web server/client boundary: build và route/browser smoke proof.
- Mobile lifecycle/native capability: typecheck và device/simulator smoke proof.
- Cross-workspace contract: producer + generated artifact + consumer proof trong cùng change.

Repo hiện chưa có toolchain nên chưa có runtime proof nào được coi là pass. Lane và closeout thuộc [`../process/DEVELOPMENT.md`](../process/DEVELOPMENT.md).

## References

- [System architecture](../../ARCHITECTURE.md)
- [API architecture](API.md)
- [Web architecture](WEB.md)
- [Mobile architecture](MOBILE.md)
- [Network/API contract](NETCODE.md)
