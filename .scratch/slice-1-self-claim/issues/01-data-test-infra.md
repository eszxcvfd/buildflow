# 01 — Hạ tầng dữ liệu và test: Prisma bootstrap + e2e với PostgreSQL thật

**What to build:** Nền tảng dữ liệu và kiểm thử cho slice 1: bootstrap Prisma trong `src/api` theo ADR-0003 (pin version chính xác), migration baseline chạy được với PostgreSQL từ `infra/docker/compose.yaml`, và khung test e2e boot Nest app với PostgreSQL thật (database test cô lập, có cleanup). Không có endpoint nghiệp vụ mới trong ticket này. Enabling ticket (không map FR); mở đường cho IAM-SRS-001. ADR-0003, ADR-0002, `docs/architecture/DATA.md`.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Prisma thêm vào `src/api` với version pin chính xác; schema baseline + migration chạy thành công với PostgreSQL của compose.
- [x] Test e2e/integration boot Nest app qua `@nestjs/testing` nối PostgreSQL thật (không mock database); database test cô lập và cleanup sau mỗi run.
- [x] Các spec hiện có (health, status) vẫn pass; `typecheck` + `lint` pass.
- [x] Command + output được ghi lại làm bằng chứng theo `docs/process/DEVELOPMENT.md`.

## Comments

### 2026-08-25 — Implementation (Lead, thực hiện trực tiếp theo chỉ định của Human)

**Quyết định version (ADR-0003 — pin chính xác):** `prisma` + `@prisma/client` = `6.19.3` (exact, không range), thêm `@types/supertest@6.0.3` (dev). Khảo sát Prisma 7.9.1 (stable mới nhất tại thời điểm cài) trong thư mục probe cho thấy: v7 bỏ `url` khỏi `datasource` (bắt buộc `prisma.config.ts` + driver adapter `@prisma/adapter-pg`), và generated code (kể cả `moduleFormat = "cjs"`) import bằng extension `.ts` — TypeScript 5.4.5/CommonJS emit `require("./x.ts")` sai runtime. Adopting v7 đòi upgrade TypeScript ≥ 5.7 + `rewriteRelativeImportExtensions` + rewire adapter — vượt phạm vi enabling ticket. 6.19.3 là 6.x mới nhất, tương thích toolchain hiện tại; verify probe: `tsc` compile + CJS `require` OK. Conflict rule ghi tại `docs/architecture/DATA.md` §9.

**Files:** `src/api/prisma/{schema.prisma,migrations/20260825000000_init/migration.sql,migrations/migration_lock.toml}`, `src/api/src/prisma/{prisma.service.ts,prisma.module.ts}` (Global, wire vào `AppModule`), `src/api/test/support/test-database.ts`, `src/api/test/e2e/app.e2e-spec.ts`, `src/api/{jest.e2e.config.js,tsconfig.test.json}`, scripts trong `package.json` (build = `prisma generate && tsc`, postinstall = `prisma generate`, test:e2e, prisma:generate/migrate/deploy), `.env.example` (host-side 127.0.0.1), `Dockerfile` (COPY prisma vào builder; COPY `node_modules/.prisma` + `@prisma/engines` vào runner).

**Bằng chứng (lane `data` + `api`, theo `docs/process/DEVELOPMENT.md` §2):**

1. Compose config + health:
   - `docker compose config --quiet` → exit 0.
   - `docker compose up -d postgres redis` → cả hai `Up (healthy)`; `pg_isready -U buildflow -d buildflow` → accepting connections; `redis-cli PING` → PONG.

2. Migration baseline chạy với PostgreSQL của compose (dev DB):
   - `DATABASE_URL='postgres://buildflow:buildflow@127.0.0.1:5432/buildflow' ./node_modules/.bin/prisma migrate deploy`
   - Output: `1 migration found in prisma/migrations` / `Applying migration \`20260825000000_init\`` / `All migrations have been successfully applied.`
   - Verify: `psql ... SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations;` → `20260825000000_init | t`.

3. E2E boot Nest app với PostgreSQL thật (không mock DB):
   - `npm run test:e2e` (jest `test/e2e/**/*.e2e-spec.ts`, `--runInBand`) → 4 passed: `/health/live` 200; `/health/ready` 200 với `checks: {postgres: 'up', redis: 'up'}`; `/api/v1/status` v1; `PrismaService.$queryRaw` `SELECT 1 AS one` → `[{one: 1}]`.
   - Isolation + cleanup: trước run, `DROP DATABASE IF EXISTS buildflow_e2e WITH (FORCE)` → `CREATE DATABASE` → `prisma migrate deploy` vào DB test; sau run `DROP DATABASE`. Verify sau 2 run liên tiếp: `SELECT datname FROM pg_database WHERE datname LIKE 'buildflow%'` chỉ còn `buildflow`.

4. Spec hiện có + toolchain:
   - `npm test` → 2 suites, 4 tests passed (health, status).
   - `npm run typecheck` (`tsc --noEmit -p tsconfig.test.json`, phủ cả `test/`) → pass.
   - `npm run lint` (`eslint src test --ext .ts`) → pass.

5. Build + runtime trong Docker (API container với Prisma engine musl):
   - `npm run build` → `dist/main.js` + `dist/prisma/*` sinh ra OK.
   - `docker compose build api` → image built; `docker compose up -d api` → container `Up (healthy)`; `curl http://127.0.0.1:3000/health/ready` → `{"status":"ok","checks":{"postgres":"up","redis":"up"}}`; `curl /api/v1/status` → v1. Boot container chứng minh `PrismaService.$connect()` load engine + connect thành công.

**Ghi chú:** schema baseline cố ý rỗng (empty migration) — bảng nghiệp vụ thuộc các ticket sau (03+); ticket này chỉ sở hữu pipeline. `DATA.md` status/target-path đã cập nhật theo thực tế. Node cục bộ v24, image node:20.11.1-alpine — cả hai chạy được.
