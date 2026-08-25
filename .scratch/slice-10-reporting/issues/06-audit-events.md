# 06 — [RPT-SRS-007] Ghi lịch sử thao tác quan trọng

**What to build:** Hệ thống ghi các thay đổi về tài khoản/quyền, phân công, trạng thái, lịch, quyết định QC và phê duyệt vật tư. Bản ghi gồm actor, thời điểm, hành động, đối tượng, kết quả và lý do khi bắt buộc; không chứa mật khẩu hoặc bí mật.

**Blocked by:** slice-8, slice-9; mở rộng audit auth đã có (slice-1/05).

**Status:** ready-for-agent

- [ ] Ghi audit đủ loại sự kiện: tài khoản/quyền, phân công, trạng thái, lịch, QC, vật tư.
- [ ] Mỗi bản ghi: actor, thời điểm, hành động, đối tượng, kết quả, lý do khi bắt buộc.
- [ ] Không chứa mật khẩu/bí mật (đối chiếu IAM-008).
- [ ] Test chứng minh đủ loại sự kiện; retention theo Q-12 khi chốt.

## Truy vết

SRS RPT-SRS-007 (§7.8, Must); BR-10; Q-12 ngỏ.
