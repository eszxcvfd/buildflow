# Workspace Routing

> Đây là source of truth cho việc định tuyến thay đổi giữa các workspace và tài liệu owner. Nội dung kiến trúc chi tiết nằm ở các tài liệu được liên kết; file này không tạo một kiến trúc thứ hai.

## 1. Trạng thái repository

Khung hiện có trong `src/` gồm `api/`, `web/` và `mobile/`; cả ba chưa có source/config. Mọi entry point bên dưới là target design cho giai đoạn scaffold, không phải bằng chứng runtime.

## 2. Bảng định tuyến workspace

| Khi thay đổi | Workspace/lane chính | Tài liệu phải đọc/cập nhật | Bằng chứng tối thiểu |
| --- | --- | --- | --- |
| Domain model, use case, repository port, Nest module | `src/api` / API | [`docs/architecture/API.md`](docs/architecture/API.md) | unit domain + application; integration adapter khi có I/O; typecheck/lint |
| HTTP endpoint, DTO, auth guard, validation, OpenAPI | `src/api` / Contract | [`docs/architecture/API.md`](docs/architecture/API.md) + [`docs/architecture/NETCODE.md`](docs/architecture/NETCODE.md) | contract check + API tests; audit web/mobile consumers |
| Next route, layout, server/client composition, data loading | `src/web` / Web | [`docs/architecture/WEB.md`](docs/architecture/WEB.md) | typecheck/lint/build; route smoke test phù hợp |
| Ark UI wrapper, design token, accessibility, web interaction | `src/web` / Web UI | [`docs/architecture/WEB.md`](docs/architecture/WEB.md) | component test + keyboard/focus/accessibility check |
| Expo route, screen, native permission, mobile storage | `src/mobile` / Mobile | [`docs/architecture/MOBILE.md`](docs/architecture/MOBILE.md) | typecheck/lint; device/simulator smoke test khi có native behavior |
| API contract được web và mobile dùng | cross-workspace / Contract | [`ARCHITECTURE.md`](ARCHITECTURE.md) + [`docs/architecture/NETCODE.md`](docs/architecture/NETCODE.md) + [`docs/architecture/API.md`](docs/architecture/API.md) + các client liên quan | cập nhật producer, generated artifacts và consumer trong cùng thay đổi |
| Startup, health, deploy, env, package boundary | cross-workspace / Runtime | [`docs/architecture/RUNTIME.md`](docs/architecture/RUNTIME.md) | startup/health/build proof của workspace bị ảnh hưởng |
| Chỉ sửa tài liệu kiến trúc/routing | Documentation | [`ARCHITECTURE.md`](ARCHITECTURE.md), file owner và [`docs/README.md`](docs/README.md) | link/tree consistency; không giả vờ có test runtime |

## 3. Quy tắc ranh giới

1. `src/api` sở hữu domain và API contract; web/mobile chỉ là consumer qua transport được công bố.
2. `src/web` không import file từ `src/api` hoặc `src/mobile`; `src/mobile` cũng không import UI/DOM từ `src/web`.
3. Không import deep path nội bộ giữa hai feature. Chỉ import public entry point của feature hoặc artifact contract được owner công bố.
4. `src/web/src/app` chỉ sở hữu routing/layout/loading/error composition. Business logic ở `src/web/src/features`.
5. Ark UI chỉ được bọc tại `src/web/src/components/ui`; feature dùng wrapper của repo, không rải dependency Ark UI khắp codebase.
6. Mobile không cần tái sử dụng markup web. Dùng React Native native primitives; chỉ dùng chung protocol/model đã generate nếu thật sự có lợi.
7. `src/web/src/app/api` không được trở thành backend thứ hai. Chỉ dùng cho BFF/webhook có quyết định owner rõ ràng.
8. Mỗi workspace giữ package/config/env/test của mình. Shared config chỉ được tạo khi có ít nhất hai consumer và có owner cụ thể.

## 4. Thứ tự đọc tối thiểu

- Mọi thay đổi: [`ARCHITECTURE.md`](ARCHITECTURE.md) và file này.
- Thay đổi docs: [`docs/README.md`](docs/README.md).
- Thay đổi API/protocol: `docs/architecture/API.md`, `NETCODE.md`, rồi `RUNTIME.md` nếu chạm lifecycle.
- Thay đổi web: `docs/architecture/WEB.md` và `NETCODE.md` nếu chạm data contract.
- Thay đổi mobile: `docs/architecture/MOBILE.md` và `NETCODE.md` nếu chạm API/auth/offline behavior.
- Thay đổi không trivial hoặc cross-owner: [`PLANS.md`](PLANS.md), theo điều kiện trong đó.
- Domain-specific decision: kiểm tra `CONTEXT.md`/`CONTEXT-MAP.md` và `docs/adr/` nếu tồn tại.

## 5. Quy tắc chọn lane và handoff

- Chọn lane theo **producer của thay đổi**, không theo người đang sửa file.
- Contract change luôn route từ API/Contract rồi fan-out sang tất cả consumer hiện tại; không sửa client trước để che contract chưa chốt.
- Nếu một thay đổi thuộc nhiều lane, lane Contract/Runtime làm coordinator và ghi rõ các consumer phải đồng bộ.
- Khi tài liệu owner im lặng hoặc stale, cập nhật owner trước; không thêm quy tắc cục bộ vào workspace.
- Không trigger closeout cho doc-only edit hoặc partial progress trừ khi một plan hiện hữu yêu cầu.

## 6. Proof và closeout

Lane proof chi tiết thuộc [`docs/process/DEVELOPMENT.md`](docs/process/DEVELOPMENT.md). Với skeleton hiện tại, chỉ có thể chứng minh:

- các thư mục workspace tồn tại;
- cây target và link tài liệu nhất quán;
- nguồn tham khảo trỏ tới tài liệu chính thức/template đã chọn.

Không ghi nhận `test`, `build`, `lint` hoặc runtime health là đã pass cho đến khi workspace có toolchain và lệnh thực tế.
