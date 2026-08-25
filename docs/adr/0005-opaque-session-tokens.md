---
status: accepted
---

# Session bằng opaque bearer token lưu trong PostgreSQL

Slice IAM cần login/logout với thu hồi phiên tức thì (IAM-SRS-002: phiên hết hạn hoặc bị thu hồi phải bị từ chối). Chọn **opaque bearer token**: token random 256-bit, chỉ lưu dạng hash trong bảng sessions của PostgreSQL; logout/thu hồi là xóa dòng, kiểm tra phiên là một lookup theo token hash. Bác JWT stateless vì revoke sau logout đòi cơ chế blacklist ngoài token; bác JWT + Redis blacklist vì kéo Redis vào auth path — sai vai trò cache không authoritative đã chốt ở ADR-0002 và cùng hướng "PostgreSQL là system of record" với ADR-0004. Mật khẩu hash bằng bcrypt cost 12. Hệ quả: mỗi request mang một DB lookup xác thực — chấp nhận được ở quy mô đồ án; nếu sau này cần scale thì thêm cache read-only theo chính sách ADR-0002.
