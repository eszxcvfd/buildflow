---
document: "DBD-CWM-QC-002 V2.1"
source_file: "DBD_V2_1_26_bang_nghiep_vu_Quan_ly_cong_viec_thi_cong_VINACON.docx"
source_id: "191TKO9-PSzOa9j3zQ-IZKZ9H_aQQvR7S"
source_modified_at: "2026-08-24T10:35:38.000Z"
source_url: "https://docs.google.com/document/d/191TKO9-PSzOa9j3zQ-IZKZ9H_aQQvR7S/edit?usp=drive_link&ouid=105640796210463149381&rtpof=true&sd=true"
extraction: "Google Drive readable-text extraction; content preserved, visual table formatting may be flattened"
---

> Bản nguồn chỉ đọc. Khi cần kiểm tra bố cục bảng hoặc chữ ký tài liệu, mở bản gốc trên Google Drive. Không sửa file này để thay đổi yêu cầu.

TÀI LIỆU THIẾT KẾ CƠ SỞ DỮ LIỆU
HỆ THỐNG QUẢN LÝ CÔNG VIỆC THI CÔNG
VÀ KIỂM SOÁT CHẤT LƯỢNG TẠI CÔNG TRƯỜNG
Phạm vi đồ án nhóm 04 sinh viên  |  Web & Mobile  |  PostgreSQL 15+
26 bảng nghiệp vụ  |  8 bảng hỗ trợ hệ thống  |  Phiên bản 2.1
0. Kiểm soát tài liệu
0.1. Lịch sử phiên bản
0.2. Thay đổi thiết kế chính V2.1 so với V1.0
0.3. Mục lục nội dung
1. Phạm vi và nguyên tắc thiết kế
2. Kiến trúc dữ liệu tổng thể
3. Danh mục dữ liệu: 26 bảng nghiệp vụ và 8 bảng hỗ trợ
4. Quan hệ và quy tắc toàn cục
5. Từ điển dữ liệu chi tiết
6. Transaction và quality gate trọng yếu
7. Chỉ mục và hiệu năng
8. Bảo mật, audit và vòng đời dữ liệu
9. Bảng mở rộng tùy chọn
Phụ lục A. Miền giá trị trạng thái
Phụ lục B. Ma trận bảng - nhóm SRS
Phụ lục C. Quyết định còn mở ảnh hưởng schema
1. Phạm vi và nguyên tắc thiết kế
1.1. Mục tiêu thiết kế
Schema tập trung vào chuỗi Plan → Dispatch → Make Ready → Execute → Inspect → Rectify → Close. Work Order là aggregate trung tâm; Assignment quyết định ai chịu trách nhiệm; Dependency/Readiness/Blocker giải thích khả năng bắt đầu/tiếp tục; Quality checkpoint và Rectification kiểm soát điều kiện Closed.
1.2. Quyết định thiết kế chính
Một PostgreSQL database dùng chung cho backend của Web/Mobile; không tách microservice database trong phạm vi đồ án.
Một doanh nghiệp; không thêm tenant_id vào mọi bảng.
Work Order execution state, Readiness, Blocker và Quality có lifecycle riêng; không nhồi tất cả vào work_orders.status.
Assignment lưu Worker hoặc Crew, đồng thời snapshot responsible_user_id để audit trách nhiệm tại thời điểm tạo assignment.
Crew Lead là dữ liệu lịch sử trong crew_members; không lưu trùng lead_user_id trong crews.
Self-accept được bảo vệ bằng partial unique index/transaction để chỉ một current assignment tồn tại.
Vật tư chỉ phục vụ Work Order: materials, work_order_materials, material_supplement_requests; không có approval/procurement/receipt lifecycle.
Checklist được version hóa và instance lưu snapshot item; Inspection gắn checkpoint để hỗ trợ Pre-activity, Hold Point, Final và Witness Point ở mức Should.
Attachment dùng owner_type/owner_id để tránh mở rộng hàng loạt nullable FK; backend chịu trách nhiệm kiểm tra owner và project scope.
Các rule phải đọc nhiều bảng được ghi rõ là Service/Transaction Rule thay vì gọi nhầm là SQL CHECK.
Phân loại phạm vi dữ liệu: 26 bảng nghiệp vụ mô hình hóa trực tiếp nguồn lực thi công, dự án, Work Order/Make Ready, vật tư phục vụ Work Order và Quality; 8 bảng hỗ trợ gồm users, roles, user_roles, project_members, work_order_state_history, attachments, notifications và audit_logs. Các bảng kỹ thuật phát sinh từ framework/code không nằm trong baseline này.
1.3. Quy ước tên và kiểu dữ liệu
2. Kiến trúc dữ liệu tổng thể
2.1. ERD tổng quan
Hình 1. ERD physical tổng thể: 26 bảng nghiệp vụ và 8 bảng hỗ trợ hệ thống.
2.2. Luồng dữ liệu Work Order, Make Ready và vật tư
Hình 2. Các bảng chính từ planning/assignment tới readiness, blocker, material và execution history.
2.3. Luồng dữ liệu kiểm soát chất lượng
Hình 3. Tách checkpoint definition/runtime, inspection rounds và rectification.
3. Danh mục dữ liệu: 26 bảng nghiệp vụ và 8 bảng hỗ trợ
3.1. 26 bảng nghiệp vụ
Các bảng này tồn tại vì nghiệp vụ của hệ thống cần mô hình hóa trực tiếp các khái niệm nguồn lực thi công, dự án, Work Order, điều kiện sẵn sàng, vướng mắc, vật tư phục vụ Work Order và kiểm soát chất lượng. Khi trình bày quy mô nghiệp vụ của đồ án, nhóm sử dụng con số 26 bảng này thay vì tổng số bảng physical schema.
3.2. 8 bảng hỗ trợ hệ thống
Các bảng dưới đây cần cho định danh, phân quyền, phạm vi truy cập, tệp, thông báo và truy vết. Chúng quan trọng khi triển khai hệ thống nhưng không được tính vào 26 bảng nghiệp vụ thi công/điều phối/chất lượng.
Không tính vào baseline: refresh_tokens, device_tokens, idempotency_requests, outbox/background jobs, migration history hoặc các bảng framework khác. Các bảng này chỉ xuất hiện khi lựa chọn công nghệ/code yêu cầu.
26 bảng nghiệp vụ dưới đây là các bảng trực tiếp mô hình hóa nghiệp vụ thi công/điều phối/chất lượng. 8 bảng còn lại phục vụ định danh, phân quyền theo dự án, tệp, thông báo và truy vết; chúng vẫn thuộc physical schema nhưng không dùng để đánh giá độ rộng nghiệp vụ của đồ án.
4. Quan hệ và quy tắc toàn cục
4.1. Quan hệ chính
4.2. Quy tắc dữ liệu xuyên suốt
Không hard delete bản ghi đã phát sinh giao dịch/bằng chứng; dùng status/is_active và giữ lịch sử.
Mọi timestamptz lưu/so sánh theo UTC; projects.timezone dùng cho lịch hiển thị và nghiệp vụ địa phương.
Thay đổi state quan trọng phải cập nhật bảng chính + history/audit/notification cần thiết trong cùng transaction.
Mobile retry dùng client_request_id hoặc idempotency key; self-accept phải an toàn khi concurrent.
Mọi truy vấn/command nghiệp vụ kiểm tra roles + project_members ở backend.
Readiness/Blocker/Inspection không ghi đè Work Order execution state.
Khi dữ liệu checklist/inspection đã hoàn tất, sửa nội dung phải qua flow mới/phiên bản mới, không cập nhật âm thầm.
5. Từ điển dữ liệu chi tiết
Phần này mô tả physical design của toàn bộ 34 bảng baseline: 26 bảng nghiệp vụ và 8 bảng hỗ trợ hệ thống. “Key/Default” gom PK/FK/UQ/CHECK và giá trị mặc định để bảng dễ đọc. Các cross-table rule được lặp ở phần “Ràng buộc” nhưng được thực thi ở service/transaction nếu SQL CHECK không thể đọc bảng khác.
5.1. users - Tài khoản và nguồn lực cá nhân
Nhóm: IAM/ORG
Lưu tài khoản đăng nhập và hồ sơ cá nhân. Worker thuộc nhà thầu có thể liên kết contractors; quyền hệ thống nằm ở user_roles, không mã hóa cứng trong users.
Truy vết SRS: IAM-SRS-001..004, IAM-SRS-008; ORG-SRS-001..002
5.2. roles - Vai trò hệ thống
Nhóm: IAM
Danh mục vai trò được phê duyệt để backend kiểm tra quyền.
Truy vết SRS: IAM-SRS-005
5.3. user_roles - Gán vai trò cho tài khoản
Nhóm: IAM
Quan hệ nhiều-nhiều users-roles, giữ lịch sử cấp/thu hồi.
Truy vết SRS: IAM-SRS-005, IAM-SRS-008
5.4. contractors - Nhà thầu/đối tác thi công
Nhóm: ORG
Lưu hồ sơ tổ chức nhà thầu ở mức nhẹ; Work Order không giao trực tiếp cho contractor mà giao Worker/Crew.
Truy vết SRS: ORG-SRS-002, ORG-SRS-004
5.5. trades - Ngành nghề/kỹ năng
Nhóm: ORG/PRJ
Danh mục trade/skill dùng cho hồ sơ nguồn lực, Work Type và eligibility.
Truy vết SRS: ORG-SRS-003, PRJ-SRS-004
5.6. resource_trades - Năng lực của Worker/Crew
Nhóm: ORG
Gán trade/skill cho một Worker hoặc Crew bằng một bảng chung nhưng vẫn giữ FK thật tới users/crews.
Truy vết SRS: ORG-SRS-003, ORG-SRS-005, ORG-SRS-009; JOB-SRS-008
5.7. crews - Đội thi công
Nhóm: ORG
Lưu Crew/Tổ đội. Crew Lead không lưu lặp ở bảng này; nguồn sự thật nằm trong crew_members để giữ lịch sử hiệu lực.
Truy vết SRS: ORG-SRS-006, ORG-SRS-008
5.8. crew_members - Thành viên và Crew Lead
Nhóm: ORG
Lưu lịch sử membership và vai trò LEAD/MEMBER theo khoảng hiệu lực.
Truy vết SRS: ORG-SRS-007..009; JOB-SRS-011, JOB-SRS-025
5.9. projects - Dự án thi công
Nhóm: PRJ
Lưu hồ sơ dự án, múi giờ, kế hoạch và vòng đời.
Truy vết SRS: PRJ-SRS-001..002
5.10. project_areas - Khu vực/hạng mục
Nhóm: PRJ
Phân nhóm Work Order dưới dự án ở mức một cấp theo baseline.
Truy vết SRS: PRJ-SRS-003, PRJ-SRS-007
5.11. project_members - Thành viên dự án
Nhóm: PRJ/IAM
Giới hạn dữ liệu nghiệp vụ theo dự án và vai trò dự án.
Truy vết SRS: IAM-SRS-006; PRJ-SRS-005..006
5.12. work_types - Loại công việc
Nhóm: PRJ/JOB
Danh mục loại Work Order, trade chính, thời lượng và ưu tiên mặc định. Checklist/checkpoint mặc định liên kết qua các bảng template.
Truy vết SRS: PRJ-SRS-004, PRJ-SRS-007; JOB-SRS-001
5.13. work_orders - Work Order - aggregate trung tâm
Nhóm: JOB/SCH
Lưu execution state, lịch, Job Board và các mốc thời gian chính. Readiness, blocker và quality không nhồi vào status này.
Truy vết SRS: JOB-SRS-001..006, JOB-SRS-015..025; SCH-SRS-001..007
5.14. work_order_dependencies - Quan hệ phụ thuộc Work Order
Nhóm: PRJ/JOB
Biểu diễn predecessor của Work Order để dependency gate đánh giá readiness.
Truy vết SRS: PRJ-SRS-010; JOB-SRS-003, JOB-SRS-017..018
5.15. assignments - Phân công/tự nhận Work Order
Nhóm: JOB/SCH
Lưu lịch sử một Work Order được giao Worker hoặc Crew; hỗ trợ self-accept, direct assignment, acceptance optional và reassign.
Truy vết SRS: JOB-SRS-007..014, JOB-SRS-025; SCH-SRS-004..005
5.16. work_order_state_history - Lịch sử execution state
Nhóm: JOB/RPT
Append-only mọi chuyển trạng thái Work Order để timeline/audit.
Truy vết SRS: JOB-SRS-003, JOB-SRS-012, JOB-SRS-025; RPT-SRS-008
5.17. work_order_updates - Nhật ký và cập nhật hiện trường
Nhóm: JOB
Lưu progress, daily log, note, pause/resume và Work Done submission; blocker/readiness/material có bảng riêng.
Truy vết SRS: JOB-SRS-021..022, JOB-SRS-025; SCH-SRS-007
5.18. work_order_readiness_checks - Lần đánh giá Pre-start Readiness
Nhóm: JOB
Lưu mỗi lần Worker/Crew Lead đánh giá điều kiện sẵn sàng trước Start; không ghi đè lần cũ.
Truy vết SRS: JOB-SRS-017..018; QUA-SRS-003, QUA-SRS-006
5.19. readiness_check_items - Kết quả từng điều kiện Readiness
Nhóm: JOB
Snapshot các nhóm điều kiện như dependency, access, manpower, material, information, checklist và inspection.
Truy vết SRS: JOB-SRS-017..018; QUA-SRS-003, QUA-SRS-006
5.20. work_order_blockers - Vướng mắc/Constraint
Nhóm: JOB/RPT
Đối tượng độc lập để theo dõi blocker trước hoặc trong thi công, reason, responsible party, trạng thái và duration.
Truy vết SRS: JOB-SRS-019..020; RPT-SRS-004..005, RPT-SRS-008
5.21. materials - Danh mục vật tư tham chiếu
Nhóm: JOB
Danh mục vật tư chỉ phục vụ Work Order; không có tồn kho, giá, supplier hay PO/VPO.
Truy vết SRS: JOB-SRS-023..024
5.22. work_order_materials - Vật tư dự kiến và readiness hiện tại
Nhóm: JOB
Khai báo planned material trên Work Order và lưu lần xác nhận sẵn sàng gần nhất để hiển thị nhanh; lịch sử chi tiết nằm ở readiness checks/audit.
Truy vết SRS: JOB-SRS-023..024
5.23. material_supplement_requests - Yêu cầu bổ sung vật tư
Nhóm: JOB
Mỗi request baseline gắn một vật tư cụ thể; không có approval. Khi shortage thực sự blocking có thể liên kết blocker riêng.
Truy vết SRS: JOB-SRS-024; RPT-SRS-001, RPT-SRS-008
5.24. checklist_templates - Mẫu checklist
Nhóm: QUA/PRJ
Phiên bản hóa checklist dùng pre-start hoặc inspection; thay đổi mẫu không làm đổi lịch sử instance.
Truy vết SRS: QUA-SRS-001..003; PRJ-SRS-004
5.25. checklist_template_items - Tiêu chí mẫu checklist
Nhóm: QUA
Lưu từng tiêu chí, kiểu trả lời, tính bắt buộc/blocking và yêu cầu ảnh.
Truy vết SRS: QUA-SRS-001
5.26. checklist_instances - Checklist áp dụng cho Work Order
Nhóm: QUA
Lưu một lần áp dụng template; có thể gắn inspection checkpoint để phân biệt từng mốc.
Truy vết SRS: QUA-SRS-002..003, QUA-SRS-006..009
5.27. checklist_instance_items - Kết quả tiêu chí checklist
Nhóm: QUA
Snapshot nội dung và câu trả lời thực tế để bảo toàn bằng chứng.
Truy vết SRS: QUA-SRS-002..003, QUA-SRS-006..012
5.28. inspection_checkpoint_templates - Quy tắc checkpoint mặc định theo Work Type
Nhóm: QUA/PRJ
Định nghĩa checkpoint mặc định để tạo Work Order có Pre-activity/Hold/Final và chuẩn bị Witness Point ở mức Should.
Truy vết SRS: PRJ-SRS-004; QUA-SRS-004, QUA-SRS-014
5.29. inspection_checkpoints - Checkpoint áp dụng cho Work Order
Nhóm: QUA/JOB
Snapshot checkpoint thực tế trên Work Order; Hold Point là quality gate độc lập với Work Order execution state.
Truy vết SRS: QUA-SRS-004..008, QUA-SRS-014
5.30. inspections - Lần kiểm tra/tái kiểm tra
Nhóm: QUA
Mỗi checkpoint có nhiều vòng inspection; round_number tăng dần và kết quả không ghi đè.
Truy vết SRS: QUA-SRS-005..009, QUA-SRS-012, QUA-SRS-015
5.31. corrective_actions - Hạng mục khắc phục / Rectification
Nhóm: QUA/JOB
Lưu lỗi/yêu cầu sửa, có thể giao Worker hoặc Crew, nộp bằng chứng và QC verify/reject.
Truy vết SRS: QUA-SRS-010..013, QUA-SRS-015
5.32. attachments - Tệp/ảnh bằng chứng
Nhóm: SHARED
Lưu metadata file; owner dùng owner_type/owner_id để tránh bảng ngày càng rộng khi thêm Readiness/Blocker/Material/Quality. Context project/work_order giữ quyền và truy vấn.
Truy vết SRS: PRJ-SRS-009; JOB-SRS-019, JOB-SRS-022, JOB-SRS-024; QUA-SRS-003, QUA-SRS-009..012
5.33. notifications - Thông báo trong ứng dụng
Nhóm: RPT
Thông báo Web/Mobile cho assignment, blocker, material supplement, inspection, rectification, overdue; đọc thông báo không đổi object nguồn.
Truy vết SRS: RPT-SRS-001..003
5.34. audit_logs - Audit Trail
Nhóm: IAM/RPT
Append-only thay đổi nhạy cảm về auth, quyền, assignment, lịch, readiness, blocker, material, state và quality decision.
Truy vết SRS: IAM-SRS-008; RPT-SRS-008
6. Transaction và quality gate trọng yếu
6.1. Worker tự nhận việc đồng thời
Self-accept không được thực hiện theo kiểu đọc trạng thái rồi cập nhật rời rạc. Backend phải kiểm tra eligibility và tạo assignment trong transaction; partial unique index là hàng rào cuối để chỉ một winner tồn tại.
CREATE UNIQUE INDEX ux_assignments_current
ON assignments(work_order_id)
WHERE status IN ('PENDING_ACCEPTANCE','ACTIVE');
Khóa/kiểm tra Work Order READY/OPEN, Job Board đang mở và cửa sổ hợp lệ.
Kiểm tra Worker active, project scope, skill và lịch.
INSERT assignment ACTIVE với source=SELF_ACCEPT và responsible_user_id=worker.
Cập nhật Work Order ASSIGNED, đóng Job Board, ghi history/audit/notification.
Nếu unique index vi phạm, rollback và trả kết quả “công việc vừa được nhận”.
6.2. Direct Assignment và Crew Lead
Direct assignment chọn Worker hoặc Crew; Crew phải active và có đúng một Lead active.
responsible_user_id snapshot Worker/Crew Lead tại lúc tạo assignment để audit.
Nếu policy Q-02 yêu cầu Accept/Reject, assignment bắt đầu PENDING_ACCEPTANCE; nếu không, ACTIVE ngay.
Q-06 (current Lead hay snapshot Lead khi Submit Work Done) còn mở; authorization service phải dùng quyết định cuối cùng mà không làm mất snapshot lịch sử.
6.3. Dependency + Readiness + Start gate
Trước Start, tạo readiness check mới và snapshot các category bắt buộc.
Hard dependency chưa đạt → item BLOCKING và overall NOT_READY.
READY_WITH_CONSTRAINT chỉ Start nếu không còn item is_blocking=true ở trạng thái chưa đạt.
Pre-activity checkpoint/checklist blocking được service đọc cùng readiness.
Start thành công cập nhật actual_start_at, status=IN_PROGRESS, state history và work_order_updates trong cùng transaction.
6.4. Blocker và duration
Tạo blocker không đổi status Work Order sang BLOCKED; UI có thể hiển thị badge dựa trên blocker OPEN/ACKNOWLEDGED/RESOLVING.
Resolve blocker ghi resolved_at + resolution_note; dashboard tính duration từ opened_at tới resolved_at (hoặc current time nếu đang mở).
Material shortage blocking phải tạo blocker MATERIAL riêng; supplement request chỉ biểu diễn nhu cầu bổ sung.
6.5. Vật tư phục vụ Work Order
Manager/Coordinator khai báo work_order_materials với planned_quantity.
Worker/Crew Lead cập nhật available_quantity/readiness_status khi kiểm tra; SHORTAGE không auto-block.
material_supplement_requests dùng REQUESTED → ACKNOWLEDGED → IN_PROGRESS → FULFILLED/CANCELLED; không có approval/supply/receipt lifecycle.
Nếu request blocking, liên kết blocker_id nhưng hai state machine vẫn độc lập.
6.6. Hold Point, Work Done và Quality Close
Hold Point is_blocking=true chưa RELEASED ngăn bước thi công liên quan; release phải đúng required_role và audit.
Submit Work Done chỉ bởi assigned Worker/Crew Lead theo BR-07, chuyển Work Order WORK_DONE và ghi work_done_at.
Final Inspection/Re-inspection tạo inspection round mới; không ghi đè vòng trước.
Quality Gate chỉ chuyển CLOSED khi checkpoint bắt buộc đã release/pass, final inspection nếu yêu cầu đã PASS/Conditional rule phù hợp, và mọi corrective action bắt buộc VERIFIED.
Đóng thành công ghi closed_at, state history, audit và notification trong một transaction.
7. Chỉ mục và hiệu năng
7.1. Nguyên tắc
PostgreSQL không tự tạo index cho FK; chỉ index FK/trường lọc thường xuyên.
Composite index đặt cột equality trước, range/time sau.
Mobile list ưu tiên keyset pagination theo planned_start_at/id hoặc created_at/id thay OFFSET lớn.
Dashboard đọc trực tiếp bảng nghiệp vụ với index theo project/status/type; chưa cần data warehouse/materialized dashboard trong baseline.
Đo EXPLAIN ANALYZE trên data demo trước khi thêm index mới.
7.2. Truy vấn cần tối ưu
8. Bảo mật, audit và vòng đời dữ liệu
8.1. Bảo mật dữ liệu
password_hash chỉ module xác thực đọc; không đưa vào response/log/audit snapshot.
Phân quyền backend dựa roles/user_roles + project_members; không tin role từ client.
Attachment storage_key không trả thành public URL dài hạn; dùng signed URL hoặc endpoint kiểm quyền.
owner_type/owner_id của attachment phải được service xác minh tồn tại và cùng project scope trước khi lưu.
audit_logs.before_data/after_data chỉ whitelist trường cần truy vết; không chứa token/file binary.
8.2. Soft delete và retention
8.3. Backup và migration
Backup database định kỳ và trước demo/nghiệm thu.
Object storage/file directory backup đồng bộ với attachments.
Thử restore ít nhất một lần trước bảo vệ.
Migration có thứ tự dependency rõ; seed role, trade, work type và dữ liệu demo tối thiểu.
Không tạo migration từ DBD V1.0 cũ vì state/model vật tư đã thay đổi.
9. Bảng mở rộng tùy chọn
Các bảng dưới đây không thuộc baseline 26 bảng nghiệp vụ + 8 bảng hỗ trợ. Chúng chỉ phát sinh khi công nghệ/code hoặc một Should/open decision thực sự cần; không cộng vào số bảng nghiệp vụ của đồ án.
Phụ lục A. Miền giá trị trạng thái
Phụ lục B. Ma trận bảng - nhóm yêu cầu SRS
Phụ lục C. Quyết định còn mở ảnh hưởng schema
Kết luận
DBD V2.1 phân loại rõ 26 bảng nghiệp vụ và 8 bảng hỗ trợ hệ thống trong cùng physical schema 34 bảng. Mô hình nghiệp vụ giữ Work Order - Assignment - Readiness - Blocker - Inspection - Rectification làm trục chính; Crew/Crew Lead là core; vật tư chỉ ở mức planned/readiness/supplement; procurement/inventory vẫn ngoài phạm vi. Các bảng framework/code như refresh token, device token, idempotency hay migration history chỉ bổ sung khi triển khai và không tính vào số bảng nghiệp vụ.
Thuộc tính
Nội dung
Mã tài liệu
DBD-CWM-QC-002
Phiên bản
2.1 - Phân loại rõ 26 bảng nghiệp vụ và 8 bảng hỗ trợ hệ thống
Trạng thái
Dự thảo để nhóm và giảng viên hướng dẫn rà soát
Phạm vi
Một doanh nghiệp; Web quản lý/điều phối/QC; Mobile hiện trường
Hệ quản trị đề xuất
PostgreSQL 15+
Tài liệu nguồn
BRD-CWM-QC-002 V2.0; SRS-CWM-QC-002 V2.1
Ngày cập nhật
24/08/2026
Lưu ý  Tài liệu mô tả physical schema đề xuất, khóa/ràng buộc/chỉ mục và transaction rules. Đây là baseline thiết kế trước migration; DDL cuối cùng có thể điều chỉnh tên/độ dài kiểu dữ liệu nhưng không được làm thay đổi ý nghĩa nghiệp vụ đã chốt.
Thuộc tính
Nội dung
Tên tài liệu
Thiết kế cơ sở dữ liệu - Hệ thống quản lý công việc thi công và kiểm soát chất lượng tại công trường
Đối tượng đọc
Nhóm phát triển, giảng viên hướng dẫn, BA/QA và người phụ trách dữ liệu
Mục tiêu
Thống nhất mô hình dữ liệu nghiệp vụ trước migration/API/test; tách rõ entity nghiệp vụ khỏi bảng IAM/shared/truy vết và bảo đảm truy vết với SRS V2.1
Trong phạm vi
26 bảng nghiệp vụ; 8 bảng hỗ trợ hệ thống; quan hệ; state domains; DB constraints; service/transaction rules; index; audit
Ngoài phạm vi
Multi-tenant, inventory/warehouse, procurement/PO/VPO, supplier pricing, billing/accounting, BIM/CAD, chat, GPS tracking, full HSE/RFI/Submittal
Phiên bản
Ngày
Nội dung
Trạng thái
1.0
05/08/2026
Baseline cũ nhóm 05: 28 bảng, MAT request/approval/supply/receipt.
Thay thế
2.0
24/08/2026
Re-baseline nhóm 04: bỏ MAT procurement; Crew thành core; thêm dependency, readiness, blocker, material-in-WO, checkpoint/Hold Point, Work Done ≠ Closed.
Draft
2.1
24/08/2026
Bổ sung phân loại logical/business: 26 bảng nghiệp vụ trực tiếp mô hình hóa nguồn lực, dự án, Work Order, Make Ready, vật tư và chất lượng; tách 8 bảng IAM/shared/truy vết khỏi số lượng bảng nghiệp vụ.
Draft
Hạng mục
V1.0
V2.1
Phạm vi
Nhóm 05 / MAT độc lập
Nhóm 04 / vật tư thuộc JOB
Crew
Chuẩn bị cho Should
Core; Crew Lead là trách nhiệm chính
Work Order
Không có dependency/readiness/blocker riêng
Tách Dependency, Readiness và Blocker thành object riêng
Vật tư
Request → Approval → Supply → Receipt
Planned Material → Readiness → Supplement Request
Quality
Inspection chủ yếu sau hoàn thành
Checkpoint trước/trong/sau thi công; Hold Point
Trạng thái
PENDING_INSPECTION/REWORK_REQUIRED/COMPLETED trong WO
WORK_DONE và CLOSED; quality state độc lập
Số bảng
28 core
26 bảng nghiệp vụ + 8 bảng hỗ trợ hệ thống (34 bảng physical baseline); không tính bảng framework/code phát sinh khi triển khai
Nội dung
Quy ước
Ví dụ
Tên bảng/cột
snake_case; bảng dùng danh từ số nhiều
work_orders, planned_start_at
ID nghiệp vụ
uuid
users.id
Khóa ngoại
<entity>_id
project_id, work_order_id
Thời điểm
timestamptz; backend lưu UTC
created_at
Ngày nghiệp vụ
date
planned_start_date
Số lượng
numeric(12,3)
planned_quantity
Status/type
varchar + CHECK
work_orders.status
Snapshot linh hoạt
jsonb chỉ khi audit
audit_logs.before_data
Nguyên tắc enforcement  PK/FK/UNIQUE/CHECK/partial index áp dụng ở database. Eligibility, dependency cycle, readiness gate, Hold Point release và quality close là service/transaction rule vì cần đọc nhiều bản ghi/bảng.
#
Nhóm nghiệp vụ
Bảng
Mô tả nghiệp vụ
1
ORG
contractors
Đơn vị nhà thầu/đối tác ở mức hồ sơ nghiệp vụ. Worker có thể thuộc một contractor; Work Order không giao trực tiếp cho contractor mà giao Worker hoặc Crew.
2
ORG/PRJ
trades
Danh mục ngành nghề/kỹ năng dùng để mô tả năng lực nguồn lực và yêu cầu của Work Type, làm đầu vào cho eligibility khi phân công/tự nhận.
3
ORG
resource_trades
Liên kết trade/skill với Worker hoặc Crew, lưu mức năng lực và hiệu lực để hệ thống xác định nguồn lực phù hợp với công việc.
4
ORG
crews
Đội/tổ thi công được dùng như một nguồn lực có thể nhận Work Order. Crew không lưu Crew Lead trực tiếp để tránh trùng nguồn sự thật.
5
ORG
crew_members
Lưu thành viên Crew và lịch sử vai trò LEAD/MEMBER theo thời gian; đây là nguồn xác định Crew Lead có quyền đại diện đội trong nghiệp vụ Work Order.
6
PRJ
projects
Hồ sơ dự án thi công, thời gian kế hoạch, múi giờ, quản lý phụ trách và trạng thái vòng đời; là phạm vi cha của Work Order và dữ liệu hiện trường.
7
PRJ
project_areas
Khu vực/hạng mục một cấp trong dự án để nhóm Work Order theo vị trí/phạm vi thi công mà không mở rộng thành cây WBS nhiều cấp.
8
PRJ/JOB
work_types
Danh mục loại công việc, trade chính, thời lượng/ưu tiên mặc định; dùng làm dữ liệu nền để tạo Work Order và gắn checklist/checkpoint mặc định.
9
JOB/SCH
work_orders
Aggregate trung tâm của hệ thống: mô tả việc cần làm, lịch, Job Board, execution state và các mốc thời gian. Readiness, Blocker và Quality được tách thành object riêng.
10
PRJ/JOB
work_order_dependencies
Biểu diễn quan hệ tiền nhiệm giữa Work Order; dùng để kiểm tra điều kiện dependency trước khi một công việc được xác nhận sẵn sàng/bắt đầu.
11
JOB/SCH
assignments
Lưu mỗi lần Work Order được giao cho Worker hoặc Crew, nguồn assignment (self-accept/direct/reassign), trạng thái tiếp nhận và lịch sử trách nhiệm.
12
JOB
work_order_updates
Nhật ký thực hiện tại hiện trường: start, progress, daily log, note, pause/resume và Work Done submission; không dùng bảng này thay cho Blocker/Readiness.
13
JOB
work_order_readiness_checks
Lưu từng lần Worker/Crew Lead đánh giá mức độ sẵn sàng trước khi Start; kết quả tổng thể là Ready, Ready With Constraint hoặc Not Ready.
14
JOB
readiness_check_items
Chi tiết từng điều kiện của một lần readiness check như dependency, access/site, manpower, material, information, checklist và inspection requirement.
15
JOB/RPT
work_order_blockers
Vướng mắc/constraint làm cản trở việc bắt đầu hoặc tiếp tục; lưu loại nguyên nhân, mức ảnh hưởng, bên chịu trách nhiệm, thời gian mở/xử lý/giải quyết để phục vụ KPI.
16
JOB
materials
Danh mục vật tư tham chiếu cho Work Order; chỉ lưu thông tin mô tả/đơn vị, không lưu tồn kho, giá, supplier hay PO/VPO.
17
JOB
work_order_materials
Vật tư dự kiến cần dùng cho một Work Order cùng planned quantity và thông tin readiness gần nhất; là cầu nối giữa planning và pre-start.
18
JOB
material_supplement_requests
Ghi nhận nhu cầu bổ sung vật tư khi phát hiện thiếu trước/trong thi công. Flow chỉ Request → Acknowledge/Process → Fulfilled/Cancelled, không có approval/procurement.
19
QUA/PRJ
checklist_templates
Mẫu checklist nghiệp vụ được version hóa, dùng cho pre-start hoặc quality inspection; thay đổi mẫu không làm thay đổi dữ liệu lịch sử.
20
QUA
checklist_template_items
Các tiêu chí của mẫu checklist: loại câu trả lời, bắt buộc hay không, có blocking hay không và yêu cầu bằng chứng ảnh.
21
QUA
checklist_instances
Một lần checklist thực tế được áp dụng cho Work Order/inspection; giữ phiên bản template và trạng thái thực hiện độc lập.
22
QUA
checklist_instance_items
Snapshot tiêu chí và câu trả lời/bằng chứng thực tế, bảo toàn nội dung đã kiểm tra ngay cả khi template thay đổi về sau.
23
QUA/PRJ
inspection_checkpoint_templates
Quy tắc checkpoint mặc định theo Work Type, ví dụ Pre-activity, Hold Point, Final; dùng để sinh checkpoint thực tế khi chuẩn bị Work Order.
24
QUA/JOB
inspection_checkpoints
Mốc kiểm tra chất lượng thực tế trên Work Order. Hold Point có tính blocking và phải được release trước khi bước bị kiểm soát được tiếp tục.
25
QUA
inspections
Mỗi lần QC/Inspector thực hiện kiểm tra hoặc tái kiểm tra tại một checkpoint; lưu vòng kiểm tra, kết luận, người kiểm tra và bằng chứng.
26
QUA/JOB
corrective_actions
Lỗi/hạng mục khắc phục phát sinh từ inspection; có thể giao Worker/Crew, theo dõi sửa chữa, nộp bằng chứng và QC verify/reject đến khi đóng.
#
Nhóm hỗ trợ
Bảng
Vai trò hỗ trợ
1
IAM/ORG
users
Tài khoản đăng nhập và hồ sơ người dùng/nguồn lực cá nhân; là actor reference chung cho các bảng nghiệp vụ.
2
IAM
roles
Danh mục vai trò phục vụ RBAC; đây là cấu trúc phân quyền hệ thống, không phải một nghiệp vụ thi công độc lập.
3
IAM
user_roles
Quan hệ gán/thu hồi vai trò cho user, phục vụ authorization và giữ lịch sử quyền.
4
PRJ/IAM
project_members
Giới hạn user nào được truy cập một dự án và project role của họ; chủ yếu phục vụ scope quyền dữ liệu.
5
JOB/RPT
work_order_state_history
Timeline append-only của execution state để audit, nghiệm thu và truy vết; không tạo thêm capability nghiệp vụ mới.
6
SHARED
attachments
Metadata tệp/ảnh bằng chứng dùng chung cho Work Order, readiness, blocker, checklist, inspection, rectification và material supplement.
7
RPT
notifications
Hộp thông báo Web/Mobile phát sinh từ sự kiện nghiệp vụ; dữ liệu nguồn vẫn nằm ở các bảng domain tương ứng.
8
IAM/RPT
audit_logs
Audit Trail append-only cho các thay đổi nhạy cảm về quyền, assignment, schedule, readiness, blocker, material và quality decision.
Quan hệ
Cardinality
Ý nghĩa
users ↔ roles
N-N qua user_roles
Nhiều vai trò; giữ lịch sử cấp/thu hồi.
contractors → users/crews
1-N
Affiliation nhà thầu ở mức nhẹ.
users/crews ↔ trades
N-N qua resource_trades
Skill dùng eligibility.
crews ↔ users
N-N lịch sử qua crew_members
Một active LEAD tối đa cho mỗi Crew.
projects ↔ users
N-N qua project_members
Giới hạn dữ liệu theo project.
projects/areas/work_types → work_orders
1-N
Work Order thuộc project/type và optional area.
work_orders → assignments
1-N history; 1 current
Self-accept/direct/reassign.
work_orders → dependencies
1-N
Predecessor gate.
work_orders → readiness_checks → items
1-N-N
Pre-start snapshot theo từng lần check.
work_orders → blockers
1-N
Constraint độc lập execution state.
work_orders → work_order_materials
1-N
Planned material/current readiness.
work_orders → material_supplement_requests
1-N
Supplement không approval.
work_types → checkpoint_templates
1-N
Checkpoint mặc định.
work_orders → inspection_checkpoints → inspections
1-N-N
Một checkpoint nhiều vòng inspection.
inspections → corrective_actions
1-N
Rectification từ lỗi QC.
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK; gen_random_uuid()
Định danh tài khoản.
2
email
varchar(255)
Không
UQ logic lower(email)
Email/tên đăng nhập, chuẩn hóa chữ thường.
3
password_hash
varchar(255)
Không
-
Mật khẩu đã băm; không xuất qua API.
4
full_name
varchar(150)
Không
-
Họ tên hiển thị.
5
phone
varchar(20)
Có
UQ khi có
Số điện thoại.
6
avatar_url
varchar(500)
Có
NULL
Ảnh đại diện.
7
employee_code
varchar(50)
Có
UQ khi có
Mã nhân sự/worker nội bộ.
8
user_type
varchar(20)
Không
CHECK; 'STAFF'
STAFF hoặc WORKER.
9
contractor_id
uuid
Có
FK contractors.id
Nhà thầu chủ quản nếu có.
10
status
varchar(20)
Không
CHECK; 'ACTIVE'
ACTIVE, INACTIVE hoặc LOCKED.
11
failed_login_count
smallint
Không
CHECK; 0
Số lần đăng nhập thất bại liên tiếp.
12
locked_until
timestamptz
Có
NULL
Thời điểm hết khóa tạm.
13
last_login_at
timestamptz
Có
NULL
Lần đăng nhập thành công gần nhất.
14
created_by
uuid
Có
FK users.id
Người tạo; NULL khi seed.
15
created_at
timestamptz
Không
now()
Thời điểm tạo.
16
updated_at
timestamptz
Không
now()
Thời điểm cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE trên lower(email). • user_type chỉ STAFF/WORKER; contractor_id không bắt buộc vì nhân sự nội bộ không thuộc nhà thầu. • Tài khoản đã phát sinh nghiệp vụ không hard delete; chuyển INACTIVE.
Chỉ mục đề xuất
ux_users_email_lower(lower(email)) • ix_users_status_type(status,user_type) • ix_users_contractor(contractor_id)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK; gen_random_uuid()
Định danh vai trò.
2
code
varchar(50)
Không
UQ
Mã role, ví dụ ADMIN, PROJECT_MANAGER, COORDINATOR, WORKER, QC.
3
name
varchar(100)
Không
-
Tên hiển thị.
4
description
varchar(500)
Có
NULL
Mô tả trách nhiệm.
5
is_system
boolean
Không
true
Role hệ thống không xóa.
6
is_active
boolean
Không
true
Còn cho phép gán mới.
7
created_at
timestamptz
Không
now()
Tạo.
8
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • Role đã được dùng chỉ ngừng hoạt động, không xóa cứng.
Chỉ mục đề xuất
ux_roles_code(code) • ix_roles_active(is_active)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh lần gán.
2
user_id
uuid
Không
FK users.id
Tài khoản.
3
role_id
uuid
Không
FK roles.id
Vai trò.
4
assigned_by
uuid
Có
FK users.id
Người gán.
5
assigned_at
timestamptz
Không
now()
Bắt đầu hiệu lực.
6
revoked_by
uuid
Có
FK users.id
Người thu hồi.
7
revoked_at
timestamptz
Có
NULL
Kết thúc hiệu lực.
8
is_active
boolean
Không
true
Quan hệ hiện hiệu lực.
Mục
Nội dung
Ràng buộc / service rule
Tối đa một bản ghi active cho cùng user-role. • is_active=false yêu cầu revoked_at ở service/transaction.
Chỉ mục đề xuất
ux_user_roles_active(user_id,role_id) WHERE is_active • ix_user_roles_role_active(role_id,is_active)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh nhà thầu.
2
code
varchar(50)
Không
UQ
Mã nhà thầu.
3
name
varchar(200)
Không
-
Tên tổ chức.
4
contact_name
varchar(150)
Có
NULL
Đầu mối liên hệ.
5
phone
varchar(20)
Có
NULL
Điện thoại.
6
email
varchar(255)
Có
NULL
Email.
7
status
varchar(20)
Không
CHECK; 'ACTIVE'
ACTIVE/INACTIVE.
8
note
varchar(1000)
Có
NULL
Ghi chú.
9
created_by
uuid
Không
FK users.id
Người tạo.
10
created_at
timestamptz
Không
now()
Tạo.
11
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • Contractor inactive không dùng cho liên kết mới; lịch sử giữ nguyên.
Chỉ mục đề xuất
ux_contractors_code(code) • ix_contractors_status_name(status,name)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh trade.
2
code
varchar(50)
Không
UQ
Mã ngắn.
3
name
varchar(120)
Không
-
Tên trade/skill.
4
description
varchar(500)
Có
NULL
Mô tả.
5
is_active
boolean
Không
true
Còn sử dụng.
6
created_at
timestamptz
Không
now()
Tạo.
7
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • Danh mục đã tham chiếu chỉ ngừng hoạt động.
Chỉ mục đề xuất
ux_trades_code(code) • ix_trades_active_name(is_active,name)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh năng lực.
2
resource_type
varchar(10)
Không
CHECK
USER hoặc CREW.
3
user_id
uuid
Có
FK users.id
Nguồn lực cá nhân.
4
crew_id
uuid
Có
FK crews.id
Nguồn lực đội.
5
trade_id
uuid
Không
FK trades.id
Trade/skill.
6
skill_level
smallint
Không
CHECK; 1
Mức 1..5.
7
effective_from
date
Không
CURRENT_DATE
Bắt đầu hiệu lực.
8
effective_to
date
Có
NULL
Kết thúc hiệu lực.
9
is_active
boolean
Không
true
Còn dùng eligibility.
10
created_at
timestamptz
Không
now()
Tạo.
11
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
Đúng một trong user_id/crew_id có giá trị, phù hợp resource_type. • skill_level BETWEEN 1 AND 5. • Tối đa một trade active cho cùng resource.
Chỉ mục đề xuất
ux_resource_trades_user_active(user_id,trade_id) WHERE is_active • ux_resource_trades_crew_active(crew_id,trade_id) WHERE is_active • ix_resource_trades_trade_active(trade_id,is_active)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh Crew.
2
code
varchar(50)
Không
UQ
Mã Crew.
3
name
varchar(120)
Không
-
Tên Crew.
4
contractor_id
uuid
Có
FK contractors.id
Nhà thầu chủ quản nếu có.
5
description
varchar(500)
Có
NULL
Mô tả.
6
status
varchar(20)
Không
CHECK; 'ACTIVE'
ACTIVE/INACTIVE.
7
created_by
uuid
Không
FK users.id
Người tạo.
8
created_at
timestamptz
Không
now()
Tạo.
9
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • Crew inactive không được assignment mới. • Crew dùng cho assignment phải có đúng một Lead active theo crew_members.
Chỉ mục đề xuất
ux_crews_code(code) • ix_crews_status_name(status,name) • ix_crews_contractor(contractor_id)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh membership.
2
crew_id
uuid
Không
FK crews.id
Crew.
3
user_id
uuid
Không
FK users.id
Worker thành viên.
4
member_role
varchar(20)
Không
CHECK; 'MEMBER'
LEAD hoặc MEMBER.
5
effective_from
date
Không
CURRENT_DATE
Bắt đầu.
6
effective_to
date
Có
NULL
Kết thúc.
7
is_active
boolean
Không
true
Còn hiệu lực.
8
added_by
uuid
Không
FK users.id
Người thêm.
9
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
Tối đa một membership active cho cùng crew-user. • Tối đa một LEAD active cho mỗi Crew bằng partial unique index. • Không xóa lịch sử membership đã liên quan assignment.
Chỉ mục đề xuất
ux_crew_member_active(crew_id,user_id) WHERE is_active • ux_crew_one_active_lead(crew_id) WHERE is_active AND member_role='LEAD' • ix_crew_members_user_active(user_id,is_active)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh dự án.
2
code
varchar(50)
Không
UQ
Mã dự án.
3
name
varchar(200)
Không
-
Tên dự án.
4
description
text
Có
NULL
Mô tả.
5
address
varchar(500)
Không
-
Địa chỉ công trình.
6
timezone
varchar(64)
Không
'Asia/Ho_Chi_Minh'
Múi giờ hiển thị/lịch nghiệp vụ.
7
planned_start_date
date
Không
-
Ngày dự kiến bắt đầu.
8
planned_end_date
date
Không
CHECK
Ngày dự kiến kết thúc.
9
actual_end_date
date
Có
NULL
Ngày kết thúc thực tế.
10
manager_id
uuid
Không
FK users.id
Quản lý dự án.
11
status
varchar(20)
Không
CHECK; 'DRAFT'
DRAFT, ACTIVE, PAUSED, COMPLETED, CLOSED.
12
created_by
uuid
Không
FK users.id
Người tạo.
13
created_at
timestamptz
Không
now()
Tạo.
14
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • planned_end_date >= planned_start_date. • Project CLOSED không tạo Work Order mới; reopen là service rule có audit.
Chỉ mục đề xuất
ux_projects_code(code) • ix_projects_status_dates(status,planned_start_date,planned_end_date) • ix_projects_manager(manager_id)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh area.
2
project_id
uuid
Không
FK projects.id
Dự án.
3
code
varchar(50)
Không
UQ trong project
Mã khu vực.
4
name
varchar(150)
Không
-
Tên khu vực/hạng mục.
5
description
varchar(500)
Có
NULL
Mô tả.
6
display_order
smallint
Không
CHECK; 0
Thứ tự hiển thị.
7
is_active
boolean
Không
true
Còn dùng cho WO mới.
8
created_at
timestamptz
Không
now()
Tạo.
9
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(project_id,code). • Baseline không hỗ trợ cây nhiều cấp.
Chỉ mục đề xuất
ux_project_areas_project_code(project_id,code) • ix_project_areas_active(project_id,is_active,display_order)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh membership.
2
project_id
uuid
Không
FK projects.id
Dự án.
3
user_id
uuid
Không
FK users.id
Người dùng.
4
project_role
varchar(30)
Không
CHECK
MANAGER, COORDINATOR, QC, WORKER hoặc VIEWER.
5
joined_at
timestamptz
Không
now()
Bắt đầu quyền.
6
left_at
timestamptz
Có
NULL
Kết thúc quyền.
7
is_active
boolean
Không
true
Membership hiện hiệu lực.
8
added_by
uuid
Không
FK users.id
Người thêm.
Mục
Nội dung
Ràng buộc / service rule
Tối đa một membership active cho project-user. • is_active=false yêu cầu left_at ở service.
Chỉ mục đề xuất
ux_project_members_active(project_id,user_id) WHERE is_active • ix_project_members_user_active(user_id,is_active)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh loại việc.
2
code
varchar(50)
Không
UQ
Mã.
3
name
varchar(150)
Không
-
Tên.
4
description
varchar(500)
Có
NULL
Mô tả.
5
required_trade_id
uuid
Có
FK trades.id
Trade chính mặc định.
6
default_duration_minutes
integer
Có
CHECK
Thời lượng dự kiến.
7
default_priority
varchar(10)
Không
CHECK; 'NORMAL'
LOW/NORMAL/HIGH/URGENT.
8
is_active
boolean
Không
true
Còn dùng WO mới.
9
created_at
timestamptz
Không
now()
Tạo.
10
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • default_duration_minutes > 0 khi có giá trị.
Chỉ mục đề xuất
ux_work_types_code(code) • ix_work_types_trade_active(required_trade_id,is_active)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh Work Order.
2
code
varchar(50)
Không
UQ
Mã hiển thị.
3
project_id
uuid
Không
FK projects.id
Dự án.
4
area_id
uuid
Có
FK project_areas.id
Khu vực/hạng mục.
5
work_type_id
uuid
Không
FK work_types.id
Loại việc.
6
required_trade_id
uuid
Có
FK trades.id
Override trade nếu khác Work Type.
7
title
varchar(200)
Không
-
Tên công việc.
8
description
text
Có
NULL
Phạm vi.
9
instructions
text
Có
NULL
Hướng dẫn hiện trường.
10
priority
varchar(10)
Không
CHECK; 'NORMAL'
LOW/NORMAL/HIGH/URGENT.
11
status
varchar(20)
Không
CHECK; 'DRAFT'
DRAFT, READY, OPEN, ASSIGNED, IN_PROGRESS, WORK_DONE, CLOSED, CANCELLED.
12
planned_start_at
timestamptz
Có
CHECK
Bắt đầu dự kiến.
13
planned_end_at
timestamptz
Có
CHECK
Kết thúc dự kiến.
14
due_at
timestamptz
Có
NULL
Hạn hoàn thành.
15
actual_start_at
timestamptz
Có
NULL
Bắt đầu thực tế.
16
work_done_at
timestamptz
Có
NULL
Thời điểm Submit Work Done.
17
closed_at
timestamptz
Có
NULL
Thời điểm quality gate đóng WO.
18
progress_percent
smallint
Không
CHECK; 0
0..100.
19
job_board_open
boolean
Không
false
Có đang mở self-accept.
20
job_board_open_from
timestamptz
Có
NULL
Bắt đầu cửa sổ.
21
job_board_open_until
timestamptz
Có
CHECK
Kết thúc cửa sổ.
22
planned_headcount
smallint
Có
CHECK
Số người dự kiến; không đồng nghĩa số assignment.
23
cancel_reason
varchar(500)
Có
NULL
Lý do hủy.
24
created_by
uuid
Không
FK users.id
Người tạo.
25
version
integer
Không
CHECK; 1
Optimistic concurrency.
26
created_at
timestamptz
Không
now()
Tạo.
27
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • progress_percent BETWEEN 0 AND 100. • job_board_open chỉ hợp lệ khi status=OPEN và không có current assignment; kiểm tra qua transaction/service. • WORK_DONE và CLOSED là hai trạng thái khác nhau; blocker/readiness/inspection có lifecycle riêng.
Chỉ mục đề xuất
ux_work_orders_code(code) • ix_work_orders_project_status(project_id,status) • ix_work_orders_job_board(job_board_open,status,job_board_open_from,job_board_open_until) • ix_work_orders_schedule(planned_start_at,planned_end_at) • ix_work_orders_type_status(work_type_id,status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh dependency.
2
work_order_id
uuid
Không
FK work_orders.id
WO phụ thuộc.
3
predecessor_work_order_id
uuid
Không
FK work_orders.id
WO tiền nhiệm.
4
dependency_type
varchar(20)
Không
CHECK; 'FINISH_TO_START'
Baseline FINISH_TO_START; có thể mở rộng.
5
is_blocking
boolean
Không
true
Hard dependency hay advisory theo Q-07.
6
created_by
uuid
Không
FK users.id
Người tạo.
7
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
work_order_id <> predecessor_work_order_id. • UNIQUE(work_order_id,predecessor_work_order_id). • Hai WO phải cùng project; phát hiện cycle là service rule trước lưu.
Chỉ mục đề xuất
ux_wo_dependencies_pair(work_order_id,predecessor_work_order_id) • ix_wo_dependencies_predecessor(predecessor_work_order_id)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh assignment.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
assignee_type
varchar(10)
Không
CHECK
USER hoặc CREW.
4
worker_id
uuid
Có
FK users.id
Assignee cá nhân.
5
crew_id
uuid
Có
FK crews.id
Assignee Crew.
6
responsible_user_id
uuid
Không
FK users.id
Snapshot Worker hoặc Crew Lead tại lúc tạo assignment để audit.
7
source
varchar(25)
Không
CHECK
SELF_ACCEPT, DIRECT_ASSIGNMENT, REASSIGNMENT.
8
status
varchar(25)
Không
CHECK; 'ACTIVE'
PENDING_ACCEPTANCE, ACTIVE, ENDED, WITHDRAWN, REJECTED.
9
requires_acceptance
boolean
Không
false
Bật theo policy Q-02.
10
assigned_by
uuid
Có
FK users.id
NULL khi self-accept.
11
assigned_at
timestamptz
Không
now()
Thời điểm gán.
12
responded_by
uuid
Có
FK users.id
Worker/Crew Lead phản hồi nếu cần.
13
responded_at
timestamptz
Có
NULL
Thời điểm Accept/Reject.
14
response_reason
varchar(500)
Có
NULL
Lý do Reject.
15
ended_at
timestamptz
Có
NULL
Kết thúc assignment.
16
end_reason
varchar(500)
Có
NULL
Lý do thu hồi/reassign/end.
17
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
Đúng một trong worker_id/crew_id có giá trị. • Tối đa một current assignment (PENDING_ACCEPTANCE hoặc ACTIVE) trên một Work Order. • Self-accept thành công ghi ACTIVE ngay và không chờ duyệt lần hai. • Quyền khi Crew Lead đổi giữa chừng theo Q-06; responsible_user_id bảo toàn snapshot để audit.
Chỉ mục đề xuất
ux_assignments_current(work_order_id) WHERE status IN ('PENDING_ACCEPTANCE','ACTIVE') • ix_assignments_worker_status(worker_id,status) • ix_assignments_crew_status(crew_id,status) • ix_assignments_responsible(responsible_user_id,status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh lịch sử.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
from_status
varchar(20)
Có
CHECK
Trạng thái trước.
4
to_status
varchar(20)
Không
CHECK
Trạng thái sau.
5
changed_by
uuid
Có
FK users.id
NULL nếu system.
6
assignment_id
uuid
Có
FK assignments.id
Assignment liên quan nếu có.
7
reason
varchar(500)
Có
NULL
Lý do.
8
changed_at
timestamptz
Không
now()
Thời điểm.
9
correlation_id
uuid
Có
NULL
Liên kết cùng transaction/request.
Mục
Nội dung
Ràng buộc / service rule
Append-only; không update/delete bằng nghiệp vụ thường. • from_status/to_status phải thuộc miền Work Order state. • CANCELLED và các transition ngoại lệ cần reason theo service rule.
Chỉ mục đề xuất
ix_wo_history_time(work_order_id,changed_at) • ix_wo_history_actor(changed_by,changed_at)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh update.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
update_type
varchar(30)
Không
CHECK
START, PROGRESS, DAILY_LOG, NOTE, PAUSE, RESUME, WORK_DONE_SUBMISSION.
4
progress_percent
smallint
Có
CHECK
Tiến độ tại thời điểm cập nhật.
5
content
text
Có
NULL
Nhật ký/ghi chú.
6
occurred_at
timestamptz
Không
now()
Thời điểm nghiệp vụ.
7
created_by
uuid
Không
FK users.id
Người cập nhật.
8
client_request_id
uuid
Có
UQ khi có
Chống gửi lặp từ Mobile.
9
created_at
timestamptz
Không
now()
Thời điểm lưu server.
Mục
Nội dung
Ràng buộc / service rule
progress_percent 0..100 khi có. • START chỉ khi readiness/quality gate cho phép và assignment hợp lệ - service rule. • WORK_DONE_SUBMISSION chỉ bởi assigned Worker/Crew Lead theo BR-07.
Chỉ mục đề xuất
ix_wo_updates_time(work_order_id,occurred_at) • ux_wo_updates_client_request(client_request_id) WHERE client_request_id IS NOT NULL
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh readiness check.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
attempt_no
smallint
Không
CHECK; 1
Lần đánh giá.
4
overall_status
varchar(30)
Không
CHECK
READY, READY_WITH_CONSTRAINT, NOT_READY.
5
checked_by
uuid
Không
FK users.id
Worker/Crew Lead thực hiện.
6
checked_at
timestamptz
Không
now()
Thời điểm.
7
note
varchar(1000)
Có
NULL
Ghi chú tổng.
8
overridden_by
uuid
Có
FK users.id
Người override nếu policy Q-08 cho phép.
9
override_reason
varchar(1000)
Có
NULL
Lý do override.
10
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(work_order_id,attempt_no). • NOT_READY chặn Start; READY_WITH_CONSTRAINT chỉ Start khi không còn item blocking. • Override nếu có phải có quyền và audit.
Chỉ mục đề xuất
ux_readiness_attempt(work_order_id,attempt_no) • ix_readiness_status(work_order_id,overall_status,checked_at)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh item.
2
readiness_check_id
uuid
Không
FK work_order_readiness_checks.id
Readiness header.
3
category
varchar(30)
Không
CHECK
DEPENDENCY, SITE_ACCESS, MANPOWER, MATERIAL, INFORMATION, CHECKLIST, INSPECTION, OTHER.
4
result
varchar(25)
Không
CHECK
READY, CONSTRAINT, BLOCKING, NOT_APPLICABLE.
5
is_blocking
boolean
Không
false
Có chặn Start.
6
dependency_id
uuid
Có
FK work_order_dependencies.id
Nguồn dependency nếu có.
7
work_order_material_id
uuid
Có
FK work_order_materials.id
Nguồn material nếu có.
8
checkpoint_id
uuid
Có
FK inspection_checkpoints.id
Nguồn quality checkpoint nếu có.
9
note
varchar(1000)
Có
NULL
Mô tả.
10
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
Mỗi item thuộc đúng một readiness check. • Nguồn liên kết tùy category; service validate tính nhất quán.
Chỉ mục đề xuất
ix_readiness_items_check(readiness_check_id,category) • ix_readiness_items_blocking(readiness_check_id,is_blocking,result)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh blocker.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
readiness_item_id
uuid
Có
FK readiness_check_items.id
Nguồn từ readiness nếu có.
4
blocker_type
varchar(30)
Không
CHECK
DEPENDENCY, SITE_ACCESS, MATERIAL, DRAWING_INFORMATION, MANPOWER, EQUIPMENT, WEATHER, SAFETY, CLIENT_CONSULTANT, OTHER.
5
impact_level
varchar(10)
Không
CHECK; 'MEDIUM'
LOW/MEDIUM/HIGH/CRITICAL.
6
is_blocking
boolean
Không
true
Có thực sự ngăn Start/continue.
7
description
text
Không
-
Mô tả.
8
reported_by
uuid
Không
FK users.id
Người báo.
9
responsible_party_type
varchar(15)
Không
CHECK; 'UNASSIGNED'
USER, CREW, EXTERNAL, UNASSIGNED.
10
responsible_user_id
uuid
Có
FK users.id
Người xử lý khi USER.
11
responsible_crew_id
uuid
Có
FK crews.id
Crew xử lý khi CREW.
12
responsible_note
varchar(250)
Có
NULL
Tên bên ngoài/ghi chú trách nhiệm.
13
status
varchar(20)
Không
CHECK; 'OPEN'
OPEN, ACKNOWLEDGED, RESOLVING, RESOLVED, CANCELLED.
14
opened_at
timestamptz
Không
now()
Bắt đầu ảnh hưởng.
15
acknowledged_at
timestamptz
Có
NULL
Đã tiếp nhận.
16
resolving_at
timestamptz
Có
NULL
Bắt đầu xử lý.
17
resolved_at
timestamptz
Có
NULL
Kết thúc ảnh hưởng.
18
resolution_note
text
Có
NULL
Kết quả xử lý.
19
created_at
timestamptz
Không
now()
Tạo.
20
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
RESOLVED yêu cầu resolved_at và resolution_note theo service rule. • Duration không lưu cứng: resolved_at-opened_at; blocker mở dùng current_timestamp-opened_at. • Blocker không thay execution state Work Order.
Chỉ mục đề xuất
ix_blockers_work_status(work_order_id,status) • ix_blockers_type_status(blocker_type,status) • ix_blockers_responsible_user(responsible_user_id,status) • ix_blockers_opened(opened_at)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh vật tư.
2
code
varchar(50)
Không
UQ
Mã.
3
name
varchar(200)
Không
-
Tên.
4
category
varchar(100)
Có
NULL
Nhóm.
5
unit
varchar(30)
Không
-
Đơn vị tính.
6
description
varchar(500)
Có
NULL
Mô tả.
7
is_active
boolean
Không
true
Còn dùng dữ liệu mới.
8
created_at
timestamptz
Không
now()
Tạo.
9
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code). • Không có stock_quantity, purchase_price, supplier_id.
Chỉ mục đề xuất
ux_materials_code(code) • ix_materials_active_name(is_active,category,name)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh WO material.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
material_id
uuid
Không
FK materials.id
Vật tư.
4
planned_quantity
numeric(12,3)
Không
CHECK
Số lượng dự kiến > 0.
5
available_quantity
numeric(12,3)
Có
CHECK
Số lượng hiện có gần nhất.
6
readiness_status
varchar(20)
Không
CHECK; 'NOT_CHECKED'
NOT_CHECKED, READY, SHORTAGE.
7
last_checked_by
uuid
Có
FK users.id
Người xác nhận gần nhất.
8
last_checked_at
timestamptz
Có
NULL
Thời điểm xác nhận.
9
note
varchar(500)
Có
NULL
Ghi chú.
10
created_by
uuid
Không
FK users.id
Người khai báo.
11
created_at
timestamptz
Không
now()
Tạo.
12
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(work_order_id,material_id) trong baseline. • planned_quantity > 0; available_quantity >=0 khi có. • SHORTAGE không tự động block Work Order.
Chỉ mục đề xuất
ux_wo_materials_pair(work_order_id,material_id) • ix_wo_materials_readiness(work_order_id,readiness_status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh request.
2
request_code
varchar(50)
Không
UQ
Mã hiển thị.
3
work_order_id
uuid
Không
FK work_orders.id
Work Order.
4
work_order_material_id
uuid
Có
FK work_order_materials.id
Planned material liên quan nếu có.
5
material_id
uuid
Không
FK materials.id
Vật tư cần bổ sung.
6
requested_quantity
numeric(12,3)
Không
CHECK
Số lượng > 0.
7
reason
varchar(1000)
Không
-
Lý do/ghi chú.
8
is_blocking
boolean
Không
false
Thiếu có chặn công việc hay không.
9
blocker_id
uuid
Có
FK work_order_blockers.id
Blocker tương ứng khi blocking.
10
status
varchar(20)
Không
CHECK; 'REQUESTED'
REQUESTED, ACKNOWLEDGED, IN_PROGRESS, FULFILLED, CANCELLED.
11
requested_by
uuid
Không
FK users.id
Worker/Crew Lead tạo.
12
requested_at
timestamptz
Không
now()
Thời điểm yêu cầu.
13
acknowledged_by
uuid
Có
FK users.id
Người tiếp nhận.
14
acknowledged_at
timestamptz
Có
NULL
Thời điểm tiếp nhận.
15
fulfilled_by
uuid
Có
FK users.id
Người xác nhận xử lý xong.
16
fulfilled_at
timestamptz
Có
NULL
Thời điểm fulfilled.
17
cancelled_by
uuid
Có
FK users.id
Người hủy.
18
cancelled_at
timestamptz
Có
NULL
Thời điểm hủy.
19
cancel_reason
varchar(500)
Có
NULL
Lý do hủy.
20
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(request_code). • Không có APPROVED/REJECTED/PREPARING/IN_TRANSIT/RECEIVED. • is_blocking=true nên có blocker_id; request và blocker vẫn là hai object độc lập.
Chỉ mục đề xuất
ux_material_supplement_code(request_code) • ix_material_supplement_work_status(work_order_id,status) • ix_material_supplement_material(material_id,status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh phiên bản.
2
code
varchar(50)
Không
UQ theo version
Mã logic.
3
name
varchar(150)
Không
-
Tên mẫu.
4
work_type_id
uuid
Có
FK work_types.id
Phạm vi mặc định.
5
purpose
varchar(20)
Không
CHECK
PRE_START, INSPECTION hoặc WORK_DONE.
6
version
integer
Không
CHECK; 1
Phiên bản.
7
status
varchar(15)
Không
CHECK; 'DRAFT'
DRAFT, ACTIVE, INACTIVE.
8
description
varchar(500)
Có
NULL
Mục đích.
9
created_by
uuid
Không
FK users.id
Người tạo.
10
published_at
timestamptz
Có
NULL
Phát hành.
11
created_at
timestamptz
Không
now()
Tạo.
12
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(code,version). • Mẫu ACTIVE đã dùng không sửa trực tiếp; tạo version mới.
Chỉ mục đề xuất
ux_checklist_template_version(code,version) • ix_checklist_template_scope(work_type_id,purpose,status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh item.
2
template_id
uuid
Không
FK checklist_templates.id
Template.
3
sequence_no
smallint
Không
CHECK
Thứ tự >0.
4
title
varchar(250)
Không
-
Nội dung tiêu chí.
5
description
varchar(500)
Có
NULL
Hướng dẫn.
6
answer_type
varchar(20)
Không
CHECK
YES_NO, TEXT, NUMBER, PASS_FAIL.
7
is_required
boolean
Không
true
Bắt buộc.
8
is_blocking
boolean
Không
false
Không đạt sẽ chặn gate liên quan.
9
requires_photo
boolean
Không
false
Bắt buộc ảnh.
10
min_value
numeric(12,3)
Có
NULL
Min cho NUMBER.
11
max_value
numeric(12,3)
Có
NULL
Max.
12
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(template_id,sequence_no). • sequence_no>0; max>=min khi có.
Chỉ mục đề xuất
ux_checklist_item_sequence(template_id,sequence_no)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh instance.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
template_id
uuid
Không
FK checklist_templates.id
Template version nguồn.
4
checkpoint_id
uuid
Có
FK inspection_checkpoints.id
Checkpoint nếu checklist phục vụ inspection.
5
purpose
varchar(20)
Không
CHECK
PRE_START, INSPECTION, WORK_DONE.
6
instance_no
smallint
Không
CHECK; 1
Lần áp dụng.
7
status
varchar(20)
Không
CHECK; 'PENDING'
PENDING, IN_PROGRESS, COMPLETED, FAILED.
8
assigned_user_id
uuid
Có
FK users.id
Người chịu trách nhiệm.
9
started_at
timestamptz
Có
NULL
Bắt đầu.
10
completed_at
timestamptz
Có
NULL
Hoàn thành.
11
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
instance_no>0. • PRE_START blocking item chưa đạt ngăn Start; rule được service đánh giá. • Mỗi inspection round có thể dùng instance riêng, không ghi đè lịch sử.
Chỉ mục đề xuất
ix_checklist_instances_work(work_order_id,purpose,status) • ix_checklist_instances_checkpoint(checkpoint_id)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh kết quả.
2
checklist_instance_id
uuid
Không
FK checklist_instances.id
Instance.
3
source_template_item_id
uuid
Có
FK checklist_template_items.id
Item nguồn.
4
sequence_no
smallint
Không
CHECK
Thứ tự.
5
title_snapshot
varchar(250)
Không
-
Nội dung snapshot.
6
answer_type_snapshot
varchar(20)
Không
CHECK
Loại trả lời snapshot.
7
is_required_snapshot
boolean
Không
-
Bắt buộc snapshot.
8
is_blocking_snapshot
boolean
Không
-
Blocking snapshot.
9
requires_photo_snapshot
boolean
Không
-
Photo snapshot.
10
answer_text
text
Có
NULL
Trả lời text.
11
answer_number
numeric(12,3)
Có
NULL
Trả lời số.
12
answer_boolean
boolean
Có
NULL
Yes/No.
13
result
varchar(15)
Có
CHECK
PASS, FAIL, N/A.
14
note
varchar(1000)
Có
NULL
Ghi chú.
15
answered_by
uuid
Có
FK users.id
Người trả lời.
16
answered_at
timestamptz
Có
NULL
Thời điểm.
17
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(checklist_instance_id,sequence_no). • Chỉ sử dụng trường answer phù hợp type; requires_photo được kiểm tra qua attachment service.
Chỉ mục đề xuất
ux_checklist_instance_item_seq(checklist_instance_id,sequence_no) • ix_checklist_instance_item_result(checklist_instance_id,result)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh rule.
2
work_type_id
uuid
Không
FK work_types.id
Work Type.
3
code
varchar(50)
Không
-
Mã trong Work Type.
4
name
varchar(150)
Không
-
Tên checkpoint.
5
checkpoint_type
varchar(20)
Không
CHECK
PRE_ACTIVITY, HOLD_POINT, FINAL, WITNESS_POINT.
6
sequence_no
smallint
Không
CHECK
Thứ tự áp dụng.
7
stage_label
varchar(150)
Có
NULL
Mốc/giai đoạn mô tả.
8
is_blocking
boolean
Không
false
Hold Point thường true.
9
checklist_template_id
uuid
Có
FK checklist_templates.id
Checklist mặc định.
10
required_role_id
uuid
Có
FK roles.id
Role được phép inspect/release; hỗ trợ Q-10.
11
is_active
boolean
Không
true
Còn áp dụng WO mới.
12
created_by
uuid
Không
FK users.id
Người tạo.
13
created_at
timestamptz
Không
now()
Tạo.
14
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(work_type_id,code). • sequence_no>0. • WITNESS_POINT là Should; schema chuẩn bị nhưng không bắt buộc UI baseline.
Chỉ mục đề xuất
ux_checkpoint_tpl_code(work_type_id,code) • ix_checkpoint_tpl_order(work_type_id,is_active,sequence_no)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh checkpoint.
2
work_order_id
uuid
Không
FK work_orders.id
Work Order.
3
source_template_id
uuid
Có
FK inspection_checkpoint_templates.id
Rule nguồn.
4
checkpoint_type
varchar(20)
Không
CHECK
PRE_ACTIVITY, HOLD_POINT, FINAL, WITNESS_POINT.
5
sequence_no
smallint
Không
CHECK
Thứ tự/mốc.
6
stage_label
varchar(150)
Có
NULL
Mô tả vị trí/giai đoạn.
7
is_blocking
boolean
Không
false
Có chặn bước bị kiểm soát.
8
checklist_template_id
uuid
Có
FK checklist_templates.id
Checklist snapshot tham chiếu.
9
required_role_id
uuid
Có
FK roles.id
Role được phép xử lý.
10
status
varchar(25)
Không
CHECK; 'PENDING'
PENDING, READY_FOR_INSPECTION, IN_PROGRESS, RELEASED, FAILED, CANCELLED.
11
requested_by
uuid
Có
FK users.id
Người yêu cầu inspection.
12
requested_at
timestamptz
Có
NULL
Thời điểm sẵn sàng inspect.
13
released_by
uuid
Có
FK users.id
Người release.
14
released_at
timestamptz
Có
NULL
Thời điểm release.
15
witness_notified_at
timestamptz
Có
NULL
Dùng khi Witness Point Should.
16
witness_attendance
varchar(20)
Có
CHECK
ATTENDED, NOT_ATTENDED, WAIVED.
17
note
varchar(1000)
Có
NULL
Ghi chú.
18
created_at
timestamptz
Không
now()
Tạo.
19
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(work_order_id,sequence_no) trong baseline. • Hold Point blocking chưa RELEASED ngăn bước tiếp theo - service rule. • RELEASED yêu cầu released_by/released_at.
Chỉ mục đề xuất
ix_checkpoints_work_status(work_order_id,status,sequence_no) • ix_checkpoints_type_status(checkpoint_type,status) • ix_checkpoints_required_role(required_role_id,status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh inspection.
2
checkpoint_id
uuid
Không
FK inspection_checkpoints.id
Checkpoint.
3
work_order_id
uuid
Không
FK work_orders.id
Denormalized để query/permission.
4
checklist_instance_id
uuid
Có
FK checklist_instances.id
Checklist inspection nếu dùng.
5
inspector_id
uuid
Không
FK users.id
QC/Inspector.
6
round_number
smallint
Không
CHECK; 1
Vòng kiểm tra.
7
status
varchar(25)
Không
CHECK; 'PENDING'
PENDING, IN_PROGRESS, PASS, FAIL, CONDITIONAL_PASS, CANCELLED.
8
summary
text
Có
NULL
Nhận xét/kết luận.
9
started_at
timestamptz
Có
NULL
Bắt đầu.
10
completed_at
timestamptz
Có
NULL
Kết thúc.
11
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(checkpoint_id,round_number). • work_order_id phải khớp checkpoint - service rule. • CONDITIONAL_PASS là Should; quality gate vẫn chờ rectification bắt buộc.
Chỉ mục đề xuất
ux_inspections_checkpoint_round(checkpoint_id,round_number) • ix_inspections_work_status(work_order_id,status) • ix_inspections_inspector_status(inspector_id,status)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh rectification.
2
inspection_id
uuid
Không
FK inspections.id
Inspection phát hiện.
3
checklist_instance_item_id
uuid
Có
FK checklist_instance_items.id
Tiêu chí fail liên quan.
4
work_order_id
uuid
Không
FK work_orders.id
Work Order.
5
assignee_type
varchar(10)
Không
CHECK
USER hoặc CREW.
6
assigned_user_id
uuid
Có
FK users.id
Người xử lý.
7
assigned_crew_id
uuid
Có
FK crews.id
Crew xử lý.
8
title
varchar(250)
Không
-
Tên lỗi/yêu cầu.
9
description
text
Không
-
Mô tả cần sửa.
10
severity
varchar(10)
Không
CHECK; 'MEDIUM'
LOW/MEDIUM/HIGH/CRITICAL.
11
is_mandatory
boolean
Không
true
Có chặn quality close.
12
due_at
timestamptz
Có
NULL
Hạn khắc phục.
13
status
varchar(20)
Không
CHECK; 'OPEN'
OPEN, IN_PROGRESS, SUBMITTED, VERIFIED, REJECTED.
14
submitted_at
timestamptz
Có
NULL
Nộp khắc phục.
15
verified_at
timestamptz
Có
NULL
QC xác minh.
16
verified_by
uuid
Có
FK users.id
QC xác minh.
17
resolution_note
text
Có
NULL
Cách khắc phục/kết quả.
18
created_at
timestamptz
Không
now()
Tạo.
19
updated_at
timestamptz
Không
now()
Cập nhật.
Mục
Nội dung
Ràng buộc / service rule
Đúng một trong assigned_user_id/assigned_crew_id có giá trị. • VERIFIED yêu cầu verified_at, verified_by. • Work Order chưa CLOSED khi còn item is_mandatory chưa VERIFIED.
Chỉ mục đề xuất
ix_corrective_work_status(work_order_id,status) • ix_corrective_user_status(assigned_user_id,status,due_at) • ix_corrective_crew_status(assigned_crew_id,status,due_at) • ix_corrective_inspection(inspection_id)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh file.
2
project_id
uuid
Không
FK projects.id
Context dự án.
3
work_order_id
uuid
Có
FK work_orders.id
Context Work Order khi có.
4
owner_type
varchar(40)
Không
CHECK
PROJECT, WORK_ORDER, UPDATE, READINESS_ITEM, BLOCKER, MATERIAL_SUPPLEMENT, CHECKLIST_ITEM, INSPECTION, CORRECTIVE_ACTION.
5
owner_id
uuid
Không
Service validated
ID object nguồn; vì polymorphic nên không FK trực tiếp.
6
attachment_type
varchar(30)
Không
CHECK
DOCUMENT, PROGRESS_EVIDENCE, CHECKLIST_EVIDENCE, INSPECTION_EVIDENCE, REWORK_EVIDENCE, MATERIAL_EVIDENCE, BLOCKER_EVIDENCE.
7
uploaded_by
uuid
Không
FK users.id
Người tải.
8
file_name
varchar(255)
Không
-
Tên file đã làm sạch.
9
storage_key
varchar(500)
Không
UQ
Khóa object storage.
10
mime_type
varchar(100)
Không
CHECK config
MIME cho phép.
11
size_bytes
bigint
Không
CHECK
Kích thước >0.
12
caption
varchar(500)
Có
NULL
Chú thích.
13
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
UNIQUE(storage_key). • owner_type/owner_id phải tồn tại, thuộc cùng project/work_order và người upload có quyền - service rule. • Không lưu binary trong PostgreSQL.
Chỉ mục đề xuất
ix_attachments_context(project_id,work_order_id) • ix_attachments_owner(owner_type,owner_id) • ix_attachments_uploaded(uploaded_by,created_at)
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh notification.
2
recipient_user_id
uuid
Không
FK users.id
Người nhận.
3
notification_type
varchar(50)
Không
CHECK config
Mã sự kiện.
4
title
varchar(200)
Không
-
Tiêu đề.
5
content
varchar(1000)
Không
-
Nội dung ngắn.
6
entity_type
varchar(40)
Có
NULL
Loại object deep-link.
7
entity_id
uuid
Có
NULL
ID object.
8
is_read
boolean
Không
false
Đã đọc.
9
read_at
timestamptz
Có
NULL
Thời điểm đọc.
10
dedup_key
varchar(160)
Có
UQ khi có
Chống trùng khi retry.
11
expires_at
timestamptz
Có
NULL
Hết giá trị hiển thị.
12
created_at
timestamptz
Không
now()
Tạo.
Mục
Nội dung
Ràng buộc / service rule
is_read=true yêu cầu read_at. • Deep-link luôn kiểm tra lại quyền backend.
Chỉ mục đề xuất
ix_notifications_unread(recipient_user_id,is_read,created_at DESC) • ux_notifications_dedup(dedup_key) WHERE dedup_key IS NOT NULL
#
Trường
Kiểu dữ liệu
NULL
Key / Default
Mô tả
1
id
uuid
Không
PK
Định danh audit.
2
actor_user_id
uuid
Có
FK users.id
NULL cho system.
3
action
varchar(80)
Không
-
Mã hành động.
4
entity_type
varchar(50)
Không
-
Loại object.
5
entity_id
uuid
Có
NULL
ID object.
6
before_data
jsonb
Có
NULL
Snapshot trước đã lọc.
7
after_data
jsonb
Có
NULL
Snapshot sau.
8
reason
varchar(1000)
Có
NULL
Lý do nghiệp vụ.
9
result
varchar(15)
Không
CHECK; 'SUCCESS'
SUCCESS/FAILED.
10
ip_address
inet
Có
NULL
IP nếu có.
11
user_agent
varchar(500)
Có
NULL
Thiết bị/trình duyệt.
12
correlation_id
uuid
Có
NULL
Liên kết request/transaction.
13
created_at
timestamptz
Không
now()
Thời điểm.
Mục
Nội dung
Ràng buộc / service rule
Append-only; user thường không sửa/xóa. • Không ghi password_hash/token/nội dung file; jsonb phải whitelist.
Chỉ mục đề xuất
ix_audit_entity(entity_type,entity_id,created_at) • ix_audit_actor(actor_user_id,created_at) • ix_audit_action(action,created_at) • ix_audit_correlation(correlation_id)
Truy vấn
Bảng/chỉ mục chính
Mục tiêu
Job Board
work_orders(project/status/job_board window), work_type/required_trade
Danh sách Worker làm mới nhanh
My Jobs/Today Jobs
assignments(worker/crew,status) + work_orders(planned_start_at,status)
Mobile timeline
Eligibility / conflict
assignments current + work_orders time range + resource_trades
Self-accept/direct assign
Readiness/Blocker
readiness check latest + blockers(work,status,type)
Pre-start và dashboard
QC Queue
inspection_checkpoints(status,required_role) + inspections(status)
Pre/Hold/Final/Reinspection
Rectification due
corrective_actions(assignee,status,due_at)
Worker/QC queue
Material supplement
material_supplement_requests(work_order,status)
Theo dõi shortage
Notifications
notifications(recipient,is_read,created_at)
Badge/inbox
Audit
audit_logs(entity_type,entity_id,created_at)
Điều tra/truy vết
Nhóm dữ liệu
Xử lý
Retention đề xuất cho đồ án
Danh mục/tài khoản
status/is_active; không hard delete khi đã tham chiếu
Giữ suốt vòng đời demo
Work Order/Assignment/Readiness/Blocker/Quality
Giữ lịch sử; hủy/đóng bằng state
Không xóa
Ảnh/tệp
Giữ metadata theo object; file xóa theo quy trình quản trị
Ít nhất tới nghiệm thu
Notification
Có thể dọn dữ liệu hết giá trị
6-12 tháng demo
Audit
Append-only; chỉ người có quyền xem
12 tháng hoặc toàn bộ demo
Token kỹ thuật
Thu hồi/xóa theo expiry
Theo expiry
Bảng
Khi cần
Mục đích
Quan hệ
refresh_tokens
Nếu tự quản lý access/refresh token
Token hash, expiry, revoke/rotation
users
device_tokens
Nếu dùng push notification
FCM/APNs token theo user/device
users
idempotency_requests
Nếu muốn cơ chế idempotency dùng chung
Request key + response/result
users
work_order_templates
Triển khai đầy đủ PRJ-SRS-008
Mẫu WO tái sử dụng
work_types/checklist/checkpoint template
blocker_status_history
Nếu cần timeline chi tiết mọi bước blocker
Append-only status changes
work_order_blockers
material_supplement_status_history
Nếu cần timeline request riêng ngoài audit
Append-only status changes
material_supplement_requests
schedule_change_history
Nếu cần report lịch thay đổi chuyên biệt
Snapshot planned schedule changes
work_orders
inspection_witness_participants
Nếu Witness Point được mở rộng
Bên được mời/chứng kiến/attendance
inspection_checkpoints
Trường/nhóm
Giá trị hợp lệ
users.status
ACTIVE, INACTIVE, LOCKED
projects.status
DRAFT, ACTIVE, PAUSED, COMPLETED, CLOSED
work_orders.status
DRAFT, READY, OPEN, ASSIGNED, IN_PROGRESS, WORK_DONE, CLOSED, CANCELLED
assignments.status
PENDING_ACCEPTANCE, ACTIVE, ENDED, WITHDRAWN, REJECTED
readiness.overall_status
READY, READY_WITH_CONSTRAINT, NOT_READY
readiness item.result
READY, CONSTRAINT, BLOCKING, NOT_APPLICABLE
blocker.status
OPEN, ACKNOWLEDGED, RESOLVING, RESOLVED, CANCELLED
work_order_materials.readiness_status
NOT_CHECKED, READY, SHORTAGE
material supplement.status
REQUESTED, ACKNOWLEDGED, IN_PROGRESS, FULFILLED, CANCELLED
checkpoint.type
PRE_ACTIVITY, HOLD_POINT, FINAL, WITNESS_POINT (Should)
checkpoint.status
PENDING, READY_FOR_INSPECTION, IN_PROGRESS, RELEASED, FAILED, CANCELLED
inspection.status
PENDING, IN_PROGRESS, PASS, FAIL, CONDITIONAL_PASS (Should), CANCELLED
corrective action.status
OPEN, IN_PROGRESS, SUBMITTED, VERIFIED, REJECTED
notification
UNREAD/READ thể hiện bằng is_read
Nhóm SRS
Các bảng chính
Kết quả dữ liệu
IAM
users, roles, user_roles, project_members, audit_logs
Xác thực, role/project scope, lịch sử tài khoản
ORG
contractors, users, trades, resource_trades, crews, crew_members
Worker/nhà thầu, skill, Crew/Crew Lead
PRJ
projects, project_areas, project_members, work_types, work_order_dependencies, checkpoint/checklist templates
Project, area, work type, dependency, defaults
JOB/SCH
work_orders, assignments, state_history, updates, readiness checks/items, blockers
Job Board, direct/self assign, make-ready, execution, schedule
Material in JOB
materials, work_order_materials, material_supplement_requests
Planned material, readiness, supplement; không procurement
QUA
checklist templates/instances/items, checkpoint templates/runtime, inspections, corrective_actions
Pre/Hold/Final, evidence, rectification/reinspection, quality gate
RPT
notifications, audit_logs + dữ liệu tổng hợp từ bảng nghiệp vụ
Notification, dashboard, blocker/quality KPI, drill-down, audit
Quyết định
Nội dung
Ảnh hưởng/chuẩn bị trong DBD
Q-02
Direct assignment có bắt buộc Accept/Reject?
assignments.requires_acceptance/status đã chuẩn bị cả hai lựa chọn.
Q-04
Conflict hard-block hay override?
Không đổi schema; service/audit quyết định.
Q-05
Crew member ngoài Lead cập nhật được gì?
Không đổi core schema; authorization trên work_order_updates/attachments/corrective actions.
Q-06
Crew Lead đổi giữa WO: current hay snapshot?
assignments.responsible_user_id giữ snapshot; service quyết định quyền hiện hành.
Q-07
Dependency advisory?
work_order_dependencies.is_blocking hỗ trợ cả hard/advisory.
Q-08
Readiness item nào blocking/override?
readiness_check_items.is_blocking + override fields.
Q-09
Ai resolve blocker?
responsible party được mô hình linh hoạt; authorization chưa hard-code.
Q-10
Ai release Hold Point?
required_role_id trên template/runtime checkpoint.
Q-11
Witness/Conditional Pass baseline?
Enum/schema hỗ trợ nhưng UI/API có thể để Should.
