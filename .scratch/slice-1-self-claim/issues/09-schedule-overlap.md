# 09 — [SCH-SRS-004] Đối chiếu lịch khi nhận/phân công

**What to build:** Bộ so khớp lịch: so sánh khoảng thời gian của Work Order với các assignment đang hoạt động của worker theo khoảng thời gian (không chỉ theo ngày). Schema Assignment (worker, Work Order, nguồn tạo, trạng thái, mốc thời gian). Kết quả là đầu vào cho kiểm tra điều kiện nhận việc (JOB-SRS-009) và sau này là phân công trực tiếp (JOB-SRS-012).

**Blocked by:** 06 (JOB-SRS-005) — cần schema + seed Work Order có khung thời gian.

**Status:** ready-for-agent

- [ ] So sánh theo khoảng thời gian; unit test biên: chạm mép, bao nhau, rời nhau, trùng giờ bắt đầu.
- [ ] Kết quả được expose qua application port để eligibility tiêu thụ.
- [ ] Assignment schema + migration; unit test (Seam B).

## Truy vết

SRS SCH-SRS-004 (§7.5, Must); CONTEXT.md (Schedule conflict).
