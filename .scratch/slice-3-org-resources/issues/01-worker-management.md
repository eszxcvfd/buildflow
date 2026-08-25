# 01 — [ORG-SRS-001] Quản lý worker/nhân viên

**What to build:** Quản trị viên tạo, xem, cập nhật và tìm kiếm hồ sơ worker/nhân viên: thông tin liên hệ, trạng thái, ngành nghề và kỹ năng. Hồ sơ có định danh duy nhất; worker ngừng hoạt động không được phân công hoặc tự nhận việc mới.

**Blocked by:** slice-1/03, slice-1/04.

**Status:** ready-for-agent

- [ ] CRUD + tìm kiếm hồ sơ worker theo quyền quản trị viên.
- [ ] Mỗi hồ sơ có định danh duy nhất.
- [ ] Worker ngừng hoạt động bị eligibility (slice-1/10) từ chối — test tích hợp chứng minh.
- [ ] E2e + OpenAPI/typed client cập nhật.

## Truy vết

SRS ORG-SRS-001 (§7.2, Must); BR-04.
