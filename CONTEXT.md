# BuildFlow — Quản lý công việc thi công và kiểm soát chất lượng

Bối cảnh domain duy nhất của hệ thống: điều phối Work Order thi công từ thiết lập dự án/nguồn lực, qua phân công hoặc worker tự nhận, đến kiểm tra chất lượng và hoàn tất. Nguồn yêu cầu: [`SRS.md`](SRS.md) (SRS-CWM-QC-001).

## Language

### Điều phối công việc

**Work Order**:
Đơn vị công việc thi công có vòng đời trạng thái, người thực hiện, lịch và checklist, gắn với một dự án.
_Avoid_: task, ticket, "công việc" khi thiếu ngữ cảnh vòng đời

**Job Board**:
Danh sách Work Order ở trạng thái Mở/Khả dụng để worker đủ điều kiện chủ động nhận.
_Avoid_: marketplace

**Worker**:
Người trực tiếp thực hiện công việc tại hiện trường: nhân viên, cá nhân hoặc nhà thầu.
_Avoid_: thợ, "nhân viên" khi dễ lẫn với user account

**Assignment**:
Quan hệ gán trách nhiệm chính cho một Work Order. Một Work Order chỉ có một assignment chính tại một thời điểm; tạo xong có hiệu lực ngay, không qua bước xác nhận. Ghi nguồn tạo: self-claim hoặc direct assignment.
_Avoid_: allocate

**Self-claim**:
Worker tự nhận Work Order còn trống trên Job Board; được xác nhận ngay khi đủ điều kiện, không cần phê duyệt lần hai.
_Avoid_: apply, bid, đăng ký nhận việc

**Direct assignment**:
Điều phối viên gán Work Order cho nguồn lực cụ thể; có hiệu lực ngay, xung đột lịch được ghi đè kèm lý do.
_Avoid_: "giao việc" khi cần phân biệt với self-claim

**Eligibility**:
Tập điều kiện để nguồn lực nhận hoặc được phân công Work Order: đang hoạt động, đúng kỹ năng/ngành nghề, không xung đột lịch, chưa vượt concurrent limit.
_Avoid_: qualification, availability

**Concurrent limit**:
Số Work Order tối đa một Worker giữ đồng thời ở trạng thái Đã phân công hoặc Đang thực hiện; đếm theo số lượng, mặc định 3, cấu hình được.
_Avoid_: workload, capacity

**Schedule conflict**:
Trùng lịch giữa Work Order sắp nhận/phân công và lịch hiện có của nguồn lực. Self-claim bị chặn hoàn toàn; direct assignment được ghi đè kèm lý do.
_Avoid_: double-booking

**My Jobs**:
Danh sách Work Order worker đang giữ qua assignment.
_Avoid_: "việc của tôi"

### Vai trò

**Quản trị viên**:
Quản lý tài khoản, vai trò, worker/nhà thầu và dữ liệu nền dùng chung.
_Avoid_: superuser

**Điều phối viên**:
Tạo, mở, phân công, tái phân công và lập lịch Work Order.
_Avoid_: "admin" dùng lẫn cho vai trò này

**Quản lý dự án**:
Sở hữu dự án, phê duyệt và xử lý ngoại lệ tiến độ; tách riêng khỏi Điều phối viên trong v1.
_Avoid_: gộp chung với Điều phối viên

**Quality Inspector (QC)**:
Người kiểm tra chất lượng, kết luận đạt/không đạt và tạo yêu cầu khắc phục.
_Avoid_: reviewer

### Chất lượng và hỗ trợ

**Checklist**:
Tập tiêu chí cần hoàn thành tại một giai đoạn của Work Order.
_Avoid_: form

**Rework (Cần làm lại)**:
Hạng mục/trạng thái chưa đạt chất lượng, phải khắc phục trước khi hoàn tất.
_Avoid_: bug

**Material Request**:
Yêu cầu vật tư mức danh mục gắn với dự án hoặc Work Order.
_Avoid_: PO, purchase order

**Audit**:
Bản ghi thao tác không sửa được, dùng truy vết actor, thời điểm, hành động, đối tượng và kết quả.
_Avoid_: "log" khi cần phân biệt với application log
