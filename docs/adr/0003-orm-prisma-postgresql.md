---
status: accepted
---

# Chọn Prisma làm ORM và migration runner cho PostgreSQL

Repo cần ORM và migration runner cho data baseline PostgreSQL (ADR-0002, mở trong `docs/architecture/DATA.md` §9). Ba lựa chọn: Prisma, raw `pg` + migration tự quản, TypeORM. Chọn **Prisma** (pin version chính xác tại thời điểm cài) vì schema-first, typed client và `prisma migrate` giảm đáng kể boilerplate cho ~15+ bảng phục vụ 67 Must FRs. Bác raw `pg` (đã có trong dependencies) vì phải tự viết toàn bộ mapping và migration runner; bác TypeORM vì decorator entity dễ xâm phạm domain purity. Domain không import Prisma type — mapper là seam theo `docs/architecture/API.md` §7; generate step được thêm vào build của API. Package/version/scope/conflict rule ghi tại ADR này và tham chiếu từ `docs/architecture/DATA.md`.
