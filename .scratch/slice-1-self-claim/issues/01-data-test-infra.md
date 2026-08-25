# 01 — Hạ tầng dữ liệu và test: Prisma bootstrap + e2e với PostgreSQL thật

**What to build:** Nền tảng dữ liệu và kiểm thử cho slice 1: bootstrap Prisma trong `src/api` theo ADR-0003 (pin version chính xác), migration baseline chạy được với PostgreSQL từ `infra/docker/compose.yaml`, và khung test e2e boot Nest app với PostgreSQL thật (database test cô lập, có cleanup). Không có endpoint nghiệp vụ mới trong ticket này. Enabling ticket (không map FR); mở đường cho IAM-SRS-001. ADR-0003, ADR-0002, `docs/architecture/DATA.md`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Prisma thêm vào `src/api` với version pin chính xác; schema baseline + migration chạy thành công với PostgreSQL của compose.
- [ ] Test e2e/integration boot Nest app qua `@nestjs/testing` nối PostgreSQL thật (không mock database); database test cô lập và cleanup sau mỗi run.
- [ ] Các spec hiện có (health, status) vẫn pass; `typecheck` + `lint` pass.
- [ ] Command + output được ghi lại làm bằng chứng theo `docs/process/DEVELOPMENT.md`.
