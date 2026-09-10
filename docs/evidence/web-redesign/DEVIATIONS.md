# DEVIATIONS — web redesign vs mẫu silhouette (F011)

Mọi lệch dưới đây là chủ ý: giữ behavior cũ hoặc dữ liệu thật thay vì
fabrication. Tham chiếu mapping data: `docs/plans-web-redesign.md` §4.

| # | Mẫu | Thực tế | Lý do |
|---|---|---|---|
| D1 | Sidebar có badge đếm "5" + groups đầy đủ (Vật tư & Thiết bị, Nhà thầu phụ, Kiểm soát an toàn) | Không badge đếm; giữ nguyên 4 nhóm `NAV_GROUPS` thật (Điều hành / Đối tác thi công / Nguồn lực / Quản trị) + role-gating cũ | Tránh dead link và fetch projects mỗi route; item mẫu không tồn tại trong app |
| D2 | Metric labels: "Tổng giải ngân 24.5 Tỷ (76%)", "Cảnh báo trễ 15%", "Đang thi công 80% tải" | "Tổng giải ngân — / Chưa có dữ liệu ngân sách"; "Cảnh báo trễ — / Chưa có dữ liệu tiến độ"; "Đang thi công {n} đang hoạt động" | Read-side không có budget/progress field (`lib/api/projects.ts` 7-field summary); luật anti-fabrication AC6 |
| D3 | Subtitle hàng: category ("Xây dựng dân dụng") | "Cập nhật {relative updatedAt}" | Category không có trong API; dùng field thật |
| D4 | Cột Tiến độ: thanh 72%/45% + % text | Track rỗng 0% + "— Chưa có dữ liệu tiến độ" | Không có progress API; residual F004: semantics track 0% vẫn là placeholder hình ảnh |
| D5 | Cột Ngân sách: "48.2", "24.5 / 32B" | "—" mono right-align | Không có budget field read-side |
| D6 | Cột Chỉ huy trưởng: avatar + tên ("KTS.Hoàng Anh") | "—" (không N+1 trong bảng) | `managerName` write-only; bounded areas-fetch đã đủ nặng (≤20 GET); tên thật chỉ lazy trong Inspector |
| D7 | Cột Hạng mục: "hoàn thành/tổng" | "đang hoạt động/tổng" qua `listProjectAreas` bounded, fail → "—", total===0 → "—" | Mock nghĩa "hoàn thành" không có nguồn; `isActive/total` là field thật duy nhất |
| D8 | ViewToggle trong header lớn | `ViewToggle` compact hiện có, đặt trong filter strip | Giữ component + behavior kanban cũ (AC9) |
| D9 | Quick actions: "Lịch thi công", "Bản vẽ kỹ thuật" | "Chi tiết dự án" → `/projects/:id`; "Công việc" → `/work-orders?projectId=`; "Sửa hồ sơ" + "Đổi trạng thái" (gated) | Không render nút chết; mọi action đi tới route/dialog thật |
| D10 | Inspector có "Nhật ký hiện trường" đầy entries | Section shell + `EmptyState` "Chưa có nhật ký hiện trường" | Không có endpoint nhật ký |
| D11 | Inspector địa chỉ đầy đủ | Row "Địa chỉ: —" + title "Chưa có dữ liệu địa chỉ" (F001) | `address` chỉ nằm trong write profile, read-side không có |
| D12 | Inspector Chỉ huy trưởng luôn có tên | Lazy từ members (MANAGER active đầu tiên); pending → "Đang tải…", fail → "—" + title lý do, userName null → "—" + title userId (F003) | Ghi nhận lệch seed: `managerId` PRA/PRB/PRD = hoang.anh nhưng membership MANAGER = quoc.tran (`docs/demo-data.md` §2 vs §4) |
| D13 | Metric "Tổng dự án" = toàn bộ | `projects.length` từ `listProjects({limit:100})` — cap 100 | `listProjects` clamp 1–100; chấp nhận ở scale demo |
| D14 | Full-bleed áp dụng cả detail/new | `data-fullbleed` exact `pathname === '/projects'`; `/projects/:id` + `/projects/new` giữ layout cũ (F007) | Tránh clipped layout ở trang detail/form (fixed-height workspace chỉ an toàn cho list) |
| D15 | Search pill là ô search dự án | Pill là navigator toàn cục (⌘K palette); search dự án client-side ở FilterBar (`#projects-search` giữ cho driver) | Giữ behavior palette + E2E hooks rẻ tiền |

## Residual (không fix trong đợt này — ghi cho commit/báo cáo)

- **F004 0%-track semantics:** thanh tiến độ 0% vẫn là hình ảnh placeholder; API chưa có progress → chưa có semantics thật.
- **F009 fixed-height chain:** `.bf-content calc(100vh-48px) + overflow:hidden` chỉ bật exact `/projects`; kanban-scroll đã check giữ nguyên — chain chi tiết (nested scroll, drawer ≤900px re-assert) là residual.
- **F010 residual comments:** các comment lịch sử (DashCode padding, `:has()` rationale) giữ lại làm context; chỉ sửa stale facts (248px, `/projects*`).
- **F014 Select zero-interaction unit:** `projects-status` Select là wrapper Ark — interaction thật được chứng minh qua driver rerun (21 options), không thêm unit giả lập Ark state machine.
- **Mobile hàng 109px:** viewport 390px giữ layout stacked cũ (ngoài scope density 44–48px desktop).
