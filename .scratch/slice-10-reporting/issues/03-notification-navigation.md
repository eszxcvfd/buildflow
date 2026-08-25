# 03 — [RPT-SRS-003] Mở đúng ngữ cảnh từ thông báo

**What to build:** Khi người dùng chọn thông báo, hệ thống mở đúng Work Order, kiểm tra, vật tư hoặc màn hình liên quan. Quyền và trạng thái đối tượng được kiểm tra lại; nếu không còn quyền, hiển thị thông báo phù hợp thay vì lộ dữ liệu.

**Blocked by:** slice-10/02.

**Status:** ready-for-agent

- [ ] Chọn thông báo → mở đúng đối tượng nguồn theo loại.
- [ ] Kiểm tra lại quyền + trạng thái khi mở (BR-13).
- [ ] Mất quyền → thông báo phù hợp, không lộ dữ liệu.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS RPT-SRS-003 (§7.8, Must).
