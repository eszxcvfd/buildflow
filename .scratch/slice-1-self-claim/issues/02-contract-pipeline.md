# 02 — Contract pipeline: OpenAPI (@nestjs/swagger) + typed client (openapi-typescript)

**What to build:** Contract pipeline theo `docs/architecture/NETCODE.md`: `@nestjs/swagger` trong `src/api` sinh OpenAPI document cho endpoint hiện có (health/status) thành artifact được commit; `src/web` dùng `openapi-typescript` sinh TypeScript types; script generate một lệnh mỗi phía; generated file không bao giờ sửa tay.

**Blocked by:** 01 (Prisma + test toolchain ổn định trước khi thêm dependency mới).

**Status:** ready-for-agent

- [ ] OpenAPI document sinh từ API workspace và được commit vào repo.
- [ ] Web có TypeScript types sinh từ document đó; client fetch mỏng tiêu thụ các type này.
- [ ] Script generate được tài liệu hóa (một lệnh mỗi workspace); generated file không sửa tay.
- [ ] Typecheck cả hai workspace pass.
