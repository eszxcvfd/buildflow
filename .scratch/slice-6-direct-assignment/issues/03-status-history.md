# 03 — [JOB-SRS-022] Lịch sử trạng thái công việc

**What to build:** Hệ thống lưu và hiển thị timeline các lần tạo, công bố, nhận/phân công, đổi lịch, bắt đầu, cập nhật, gửi kiểm tra, làm lại và hoàn thành. Mỗi mục có trạng thái trước/sau, actor, thời điểm và lý do khi bắt buộc; người dùng thông thường không sửa lịch sử.

**Blocked by:** slice-6/02 (cần đủ loại sự kiện phát sinh).

**Status:** ready-for-agent

- [ ] Timeline ghi đủ loại sự kiện với trước/sau, actor, thời điểm, lý do khi bắt buộc.
- [ ] Endpoint/hiển thị timeline theo quyền; read-only — không sửa được.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS JOB-SRS-022 (§7.4, Must); BR-10, BR-11.
