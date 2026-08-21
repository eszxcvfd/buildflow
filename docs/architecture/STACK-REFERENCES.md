# Stack References

> Ghi chú nguồn cho baseline kiến trúc. Phần **Nguồn nói gì** chỉ ghi lại điểm đã đọc từ tài liệu/repository; phần **Áp dụng vào repo** là quyết định đề xuất của buildflow, không phải claim rằng code đã triển khai. Phiên bản package chưa được khóa vì các workspace hiện chưa có manifest.

## 1. NestJS và template DDD/DevOps

### Nguồn nói gì

- [NestJS documentation](https://docs.nestjs.com/) mô tả NestJS hướng tới application architecture có thể test, scale, loosely couple và maintain.
- [NestJS modules](https://docs.nestjs.com/modules) tổ chức module bằng `imports`, `controllers`, `providers`, `exports`; dependency injection là cơ chế nối các provider.
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers) cung cấp token/factory/value/class để thay implementation khi wiring dependency.
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing) hỗ trợ tạo testing module và override dependency để test mà không cần khởi động toàn bộ hạ tầng thật.
- [andrea-acampora/nestjs-ddd-devops](https://github.com/andrea-acampora/nestjs-ddd-devops) là template tham khảo cho modular monolith, DDD, Clean Architecture, test/DevOps; cây `src/modules/<module>` của template tách `domain`, `application`, `api` và `infrastructure`, đồng thời dùng Nest module/token để wiring.

### Áp dụng vào repo

- `src/api` là modular monolith, không khởi đầu bằng microservices.
- Mỗi bounded context có module composition root; domain/application không phụ thuộc Nest/ORM/HTTP.
- Repository và external integration là adapter của port; test dùng fake/in-memory adapter khi seam có biến thiên thật.
- Chỉ lấy cấu trúc/nguyên tắc từ template; không lấy domain `auth/user`, Mikro-ORM, PostgreSQL, Docker hay GitHub Actions làm yêu cầu của repo.

## 2. Next.js và feature-based web template

### Nguồn nói gì

- [Next.js documentation](https://nextjs.org/docs) dùng App Router với `app/`, layout/page conventions và hỗ trợ đặt application code dưới `src/`.
- [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) xác nhận route groups `(group)` không làm thay đổi URL, private folders `_folder` không được coi là route, và file có thể colocate trong `app/`.
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) quy định pages/layouts mặc định là Server Components; Client Components dành cho state, event handler, lifecycle, browser API và custom hooks. `"use client"` tạo boundary cho client module graph.
- [Next.js `src` folder convention](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder) giữ `public/` và config ở root của app, trong khi `src/app` chứa application code.
- [rufatalv/next-feature-based](https://github.com/rufatalv/next-feature-based) minh họa `src/app`, `src/components`, `src/features`, `src/lib` và `src/types`; các feature có components/hooks/services/types và public barrel.

### Áp dụng vào repo

- `src/web/src/app` chỉ làm route/layout/loading/error composition; feature implementation ở `src/web/src/features`.
- Feature có public `index.ts`; không deep-import implementation của feature khác.
- Ark UI interactive wrapper nằm ở `src/web/src/components/ui`; route/page giữ server-first và chỉ đưa leaf interaction sang client.
- Template dùng Tailwind/NextAuth trong ví dụ, nhưng repo chưa chọn Tailwind hoặc auth provider; chỉ áp dụng phần feature-based/App Router phù hợp yêu cầu.

## 3. Ark UI

### Nguồn nói gì

- [Ark UI](https://ark-ui.com/) là thư viện headless primitives cho các framework UI, tập trung vào component behavior/accessibility và cho phép repo tự quyết định styling.
- Tài liệu Ark UI cho phép composition/type-safe wrapper; integration cần tôn trọng client-only behavior khi đưa component vào framework có Server Components. Ví dụ [Avatar integration](https://ark-ui.com/docs/components/avatar) minh họa cách nối Ark UI context với `next/image`.

### Áp dụng vào repo

- Ark UI là behavior/accessibility layer, không phải design system hoàn chỉnh.
- Repo bọc primitive thành component có interface ổn định, design token, focus/keyboard/loading/error/reduced-motion states.
- Không dùng `@ark-ui/react` trong mobile và không rải import trực tiếp của Ark UI trong mọi feature.
- Styling system (CSS Modules/CSS variables hoặc lựa chọn tương đương) chỉ được khóa khi scaffold web; tài liệu hiện không giả định package cụ thể.

## 4. React Native, TypeScript và mobile recommendation

### Nguồn nói gì

- [React Native Getting Started](https://reactnative.dev/docs/getting-started) hiện khuyến nghị dùng một framework khi xây app mới; dùng React Native không framework vẫn có thể nếu có constraint đặc biệt.
- [React Native Using TypeScript](https://reactnative.dev/docs/typescript) nói project React Native mới target TypeScript mặc định; TypeScript dùng để type-check trong khi Babel xử lý transform.
- [Expo create a project](https://docs.expo.dev/get-started/create-a-project/) mô tả Expo là React Native framework và khuyến nghị bắt đầu bằng `create-expo-app`.
- [Expo Router introduction](https://docs.expo.dev/router/introduction/) mô tả Expo Router là file-based router cho React Native/web, route file trong `app/` trở thành route và hỗ trợ deep link/shareable navigation.

### Áp dụng vào repo

- `src/mobile` dùng React Native + TypeScript + Expo làm baseline; Expo Router là routing proposal.
- Vì mobile ít dùng, chỉ xây thin shell và critical read/auth flow sau khi API contract/web vertical slice ổn định.
- Native capability, offline sync, push, camera và bare workflow chỉ thêm khi product requirement tạo ra nhu cầu; mỗi lựa chọn khó đảo ngược cần ADR.
- Chia sẻ generated API contract/model nếu hữu ích; không chia sẻ DOM, CSS hoặc Ark UI component.

## 5. Các kết luận bị giới hạn

- Nguồn tham khảo không quyết định domain language, database, auth, deployment, package manager hay CI của buildflow.
- Repo chưa có implementation để chứng minh module dependency, route runtime, bundle behavior hoặc test result.
- Mọi claim "target/proposed" trong các tài liệu architecture phải được đổi thành "verified" chỉ sau khi scaffold/code và proof tương ứng tồn tại.

## Liên kết owner

- [System architecture](../../ARCHITECTURE.md)
- [Workspace routing](../../WORK-ROUTING.md)
- [API architecture](API.md)
- [Web architecture](WEB.md)
- [Mobile architecture](MOBILE.md)
- [Network/API contract](NETCODE.md)
