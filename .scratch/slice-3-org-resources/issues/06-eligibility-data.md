# 06 — [ORG-SRS-008] Cung cấp dữ liệu điều kiện nhận việc

**What to build:** Hệ thống cung cấp trạng thái hoạt động, ngành nghề, kỹ năng và quan hệ đội của nguồn lực cho các bước phân công và tự nhận (đối chiếu với eligibility slice-1/10). Khi dữ liệu năng lực thay đổi, kiểm tra mới dùng dữ liệu hiện hành; assignment đã phát sinh giữ thông tin lịch sử cần thiết.

**Blocked by:** slice-3/03, slice-3/04.

**Status:** ready-for-agent

- [ ] Eligibility đọc trạng thái/kỹ năng hiện hành — test sau khi đổi năng lực.
- [ ] Assignment đã tạo giữ snapshot thông tin cần thiết (không đổi theo dữ liệu nguồn).
- [ ] E2e + unit test (Seam B) cập nhật.

## Truy vết

SRS ORG-SRS-008 (§7.2, Must); BR-10.
