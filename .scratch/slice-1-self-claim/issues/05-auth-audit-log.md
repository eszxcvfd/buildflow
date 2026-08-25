# 05 — [IAM-SRS-008] Nhật ký xác thực và tài khoản

**What to build:** Hệ thống ghi nhật ký xác thực: đăng nhập thành công/thất bại và đăng xuất. Mỗi dòng audit có người dùng, thời điểm, loại hành động và kết quả. Không ghi mật khẩu, mã đặt lại hoặc bí mật xác thực.

**Blocked by:** 04 (IAM-SRS-002).

**Status:** ready-for-agent

- [ ] Login thành công/thất bại và logout tạo dòng audit tương ứng (user, thời điểm, action, kết quả).
- [ ] Không có bí mật (mật khẩu, token, mã reset) xuất hiện trong audit.
- [ ] Test chứng minh các dòng audit sinh ra đúng sự kiện.
- [ ] UI tra cứu audit thuộc slice RPT — ngoài phạm vi ticket này.

## Truy vết

SRS IAM-SRS-008 (§7.1, Must).
