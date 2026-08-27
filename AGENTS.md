## Agent skills

## Bắt buộc đọc trước khi làm việc

> **Mọi task và mọi thay đổi trong repository bắt buộc phải đọc `WORK-ROUTING.md` trước.** Đây là source of truth để xác định workspace/lane, tài liệu owner, ranh giới phụ thuộc và proof tối thiểu.

- Chọn lane theo producer/owner của thay đổi, không theo file đang được sửa.
- Nếu thay đổi chạm nhiều workspace hoặc contract, phải tuân theo quy tắc coordinator và handoff trong `WORK-ROUTING.md`.
- Sau khi đọc `WORK-ROUTING.md`, đọc tiếp các tài liệu owner được định tuyến trước khi chỉnh code, schema, hạ tầng hoặc tài liệu.
- Không tạo quy tắc định tuyến cục bộ mâu thuẫn với `WORK-ROUTING.md`.


### Issue tracker

Issues live in GitHub Issues and are managed with `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
