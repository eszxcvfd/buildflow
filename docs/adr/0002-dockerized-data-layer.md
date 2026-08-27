---
status: accepted
---

# Dùng Docker Compose với PostgreSQL và Redis cho data layer

BuildFlow ghi nhận PostgreSQL là system of record cho dữ liệu giao dịch và Redis là cache/coordination store không authoritative; Docker Compose cung cấp hai service này cho local development và integration test. API sở hữu migration, repository/cache port và adapter; web/mobile không truy cập trực tiếp data service. PostgreSQL có persistence boundary, còn Redis mặc định ephemeral với TTL/eviction; bất kỳ việc dùng Redis cho session, queue hoặc dữ liệu durable phải mở một quyết định persistence riêng. Xem [`DATA.md`](../architecture/DATA.md), [`API.md`](../architecture/API.md) và [`RUNTIME.md`](../architecture/RUNTIME.md).
