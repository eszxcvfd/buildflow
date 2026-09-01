## Agent skills

## Bắt buộc đọc trước khi làm việc

> **Mọi task và mọi thay đổi trong repository bắt buộc phải đọc `WORK-ROUTING.md` trước.** Đây là source of truth để xác định workspace/lane, tài liệu owner, ranh giới phụ thuộc và proof tối thiểu.

- Chọn lane theo producer/owner của thay đổi, không theo file đang được sửa.
- Nếu thay đổi chạm nhiều workspace hoặc contract, phải tuân theo quy tắc coordinator và handoff trong `WORK-ROUTING.md`.
- Sau khi đọc `WORK-ROUTING.md`, đọc tiếp các tài liệu owner được định tuyến trước khi chỉnh code, schema, hạ tầng hoặc tài liệu.
- Không tạo quy tắc định tuyến cục bộ mâu thuẫn với `WORK-ROUTING.md`.


### Issue tracker

Issues live in GitHub Issues and are managed with `gh`.

### Triage labels

Use the repository's canonical GitHub triage labels.

### Domain docs

This is a single-context repository using root `CONTEXT.md`. Create `docs/adr/` lazily only for an accepted decision that genuinely requires an ADR.

### Canonical BuildFlow foundation

- For every product, design, code, schema, test or delivery task, read `docs/foundation/README.md` immediately after `WORK-ROUTING.md`.
- `docs/foundation/` and root `CONTEXT.md` are the current product/design authority.
- Root `BRD.md`, `SRS.md`, `DBD.md` and `ARCHITECTURE.md` are entry points only.
- Files marked legacy or unreconciled must not be used as business or architecture truth.
- Never infer answers for entries in `docs/foundation/OPEN-DECISIONS.md`.
- Before implementing a module, complete the just-in-time module design and satisfy the documented Definition of Ready.
