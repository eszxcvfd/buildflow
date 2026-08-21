---
status: accepted
---

# Tách API modular monolith khỏi web và mobile client

Repo chọn một NestJS modular monolith làm owner của domain và HTTP contract, cùng hai workspace client độc lập: Next.js/Ark UI cho web và React Native/Expo cho mobile. Quyết định này giữ deployment/domain đơn giản ở giai đoạn đầu nhưng vẫn tạo seam rõ giữa `src/api`, `src/web` và `src/mobile`; client chỉ giao tiếp qua REST/JSON/OpenAPI và không import implementation nội bộ của nhau. Microservices, shared DOM/native UI và mobile bare workflow bị loại khỏi baseline vì chưa có nhu cầu chứng minh và sẽ làm tăng coupling/chi phí vận hành; xem [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`API.md`](../architecture/API.md), [`WEB.md`](../architecture/WEB.md) và [`MOBILE.md`](../architecture/MOBILE.md).
