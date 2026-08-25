# 02 — [IAM-SRS-004] Quản lý tài khoản

**What to build:** Quản trị viên tạo, cập nhật, khóa, mở khóa và ngừng hoạt động tài khoản trong phạm vi doanh nghiệp. Email/tên đăng nhập duy nhất; không xóa cứng tài khoản có lịch sử; thay đổi trạng thái lưu người thực hiện và thời điểm.

**Blocked by:** slice-2/01 (cấu trúc user module ổn định).

**Status:** ready-for-agent

- [ ] CRUD tài khoản + khóa/mở khóa/ngừng hoạt động theo quyền quản trị viên.
- [ ] Email/tên đăng nhập duy nhất — trùng bị từ chối kèm lỗi rõ.
- [ ] Không xóa cứng tài khoản có lịch sử nghiệp vụ (chỉ ngừng hoạt động).
- [ ] Mọi thay đổi trạng thái lưu actor + thời điểm; e2e + contract cập nhật.

## Truy vết

SRS IAM-SRS-004 (§7.1, Must); BR-11 (không xóa lịch sử).
