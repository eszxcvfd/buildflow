---
document: "SRS-CWM-QC-002 V2.1"
source_file: "SRS_V2_1_Dong_bo_BRD_V2_0_Quan_ly_cong_viec_thi_cong_VINACON.docx"
source_id: "10kYy2x_TitnjaxZeEdVm4rcVdRk5gcf9"
source_modified_at: "2026-08-24T14:12:23.958Z"
source_url: "https://docs.google.com/document/d/10kYy2x_TitnjaxZeEdVm4rcVdRk5gcf9/edit?usp=drive_link&ouid=105640796210463149381&rtpof=true&sd=true"
extraction: "Google Drive readable-text extraction; content preserved, visual table formatting may be flattened"
---

> Bản nguồn chỉ đọc. Khi cần kiểm tra bố cục bảng hoặc chữ ký tài liệu, mở bản gốc trên Google Drive. Không sửa file này để thay đổi yêu cầu.

ĐẶC TẢ YÊU CẦU PHẦN MỀM
SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
HỆ THỐNG QUẢN LÝ CÔNG VIỆC THI CÔNG
VÀ KIỂM SOÁT CHẤT LƯỢNG TẠI CÔNG TRƯỜNG
CHO CÔNG TY VINACON
Trên nền tảng Web và Mobile
Tài liệu mô tả hệ thống phải làm gì, các điều kiện và kết quả quan sát được trước khi thiết kế chi tiết.
0. Kiểm soát tài liệu
0.1. Lịch sử phiên bản
0.2. Quy ước ưu tiên
0.3. Mục lục nội dung
1. Giới thiệu
2. Mô tả tổng thể
3. Quy trình nghiệp vụ tổng thể
4. Quy tắc nghiệp vụ trọng yếu
5. Vòng đời trạng thái
6. Tổng quan yêu cầu chức năng
7. Yêu cầu chức năng chi tiết
8. Trường hợp sử dụng chi tiết
9. Yêu cầu dữ liệu
10. Yêu cầu giao diện và tích hợp
11. Yêu cầu phi chức năng
12. Xác minh, kiểm thử và nghiệm thu
13. Truy vết yêu cầu
14. Quyết định cần xác nhận và quản lý thay đổi
Phụ lục A. Thuật ngữ
Phụ lục B. Tóm tắt số lượng yêu cầu
1. Giới thiệu
1.1. Mục đích
Tài liệu chuyển phạm vi nghiệp vụ đã được thống nhất trong đề cương cập nhật thành các yêu cầu phần mềm có thể thiết kế, phát triển, kiểm thử và nghiệm thu. Mỗi yêu cầu xác định tác nhân, kênh sử dụng, hành vi, điều kiện thành công và ngoại lệ. SRS không quy định chi tiết công nghệ hoặc cách cài đặt.
1.2. Phạm vi sản phẩm
Quản lý tài khoản, vai trò và phạm vi truy cập theo dự án.
Quản lý Worker, nhà thầu, Crew, Crew Lead, trade/skill và trạng thái nguồn lực.
Quản lý dự án, khu vực/hạng mục, loại công việc, thành viên, dependency và tệp tham chiếu cơ bản.
Tạo Work Order; phân công trực tiếp cho Worker/Crew hoặc mở Job Board để Worker đủ điều kiện tự nhận.
Lập lịch; My Jobs/Today Jobs; pre-start readiness; blocker/constraint; tiến độ, nhật ký và bằng chứng hiện trường.
Khai báo vật tư dự kiến, kiểm tra material readiness và yêu cầu bổ sung gắn trực tiếp với Work Order.
Checklist và các inspection checkpoint; Hold Point; final inspection; rectification và re-inspection trước khi đóng Work Order.
Thông báo trong ứng dụng, dashboard/drill-down và audit trail.
1.3. Ngoài phạm vi
Multi-tenant hoặc quản trị nhiều doanh nghiệp.
Kho/tồn kho, nhập-xuất, barcode, giá, nhà cung cấp, PO/VPO, purchasing, invoice, payment, payroll và kế toán.
RFI/Submittal đầy đủ, quản lý tài liệu phức tạp, BIM/CAD và versioning bản vẽ chuyên sâu.
Formal NCR/CAPA/root-cause management ở mức hệ thống chất lượng doanh nghiệp; có thể là hướng mở rộng sau baseline.
Full HSE/incident management, GPS tracking liên tục, geofence, route optimization hoặc offline sync đầy đủ.
Chat thời gian thực, email/SMS automation, customer/client portal và chữ ký số.
Tự động tối ưu nguồn lực/lịch bằng thuật toán nâng cao.
1.4. Thuật ngữ chính
2. Mô tả tổng thể
2.1. Bài toán và giá trị sản phẩm
Hệ thống cung cấp một luồng thống nhất từ khi dự án/nguồn lực được thiết lập, Work Order được tạo và điều phối, đến khi người thực hiện kiểm tra mức sẵn sàng, xử lý vướng mắc, thi công, được QC kiểm tra, khắc phục và đóng. Trọng tâm là phối hợp Web văn phòng với Mobile hiện trường, giảm dữ liệu phân tán, tăng khả năng truy vết và làm rõ nguyên nhân chậm/chất lượng.
2.2. Nhóm người dùng
2.3. Ma trận quyền cấp cao
2.4. Giả định và ràng buộc
Phiên bản đầu phục vụ một doanh nghiệp; mọi người dùng nằm trong cùng phạm vi VINACON.
Worker/Crew Lead có thiết bị Mobile và kết nối mạng đủ để cập nhật; offline synchronization đầy đủ ngoài phạm vi.
Khách hàng cung cấp/duyệt work type, trade/skill, checklist/checkpoint mẫu và reason taxonomy trước UAT.
Các mục Should không chặn nghiệm thu baseline; các mục TBD phải được quyết định trước kiểm thử liên quan.
3. Quy trình nghiệp vụ tổng thể
3.1. Thiết lập dự án và nguồn lực
Admin quản lý tài khoản, Worker, Crew, Crew Lead, trade/skill và trạng thái nguồn lực.
Quản lý dự án tạo Project, Area/Category, member và quyền truy cập.
Điều phối/QC cấu hình Work Type, checklist, inspection checkpoint và dữ liệu nền.
3.2. Planning, dependency và điều phối
Điều phối tạo Work Order, lịch, skill, dependency, checklist/checkpoint và vật tư dự kiến.
Hệ thống kiểm tra điều kiện phát hành.
Điều phối chọn Direct Assignment cho Worker/Crew hoặc mở Job Board.
Self-accept dùng one-winner concurrency; direct Crew assignment yêu cầu Crew Lead active.
3.3. Pre-start readiness
Assigned Worker/Crew Lead mở My Jobs và xem dependency, checklist/checkpoint, vật tư, hướng dẫn.
Người thực hiện ghi nhận readiness: READY, READY_WITH_CONSTRAINT hoặc NOT_READY.
NOT_READY sinh/đòi hỏi blocker khi có điều kiện blocking; READY_WITH_CONSTRAINT vẫn có thể Start khi không bị chặn.
3.4. Thi công và xử lý ngoại lệ
Worker/Crew thực hiện, cập nhật tiến độ, nhật ký và bằng chứng.
Blocker có thể phát sinh trước hoặc trong thi công và được điều phối xử lý riêng.
Thiếu vật tư có thể tạo supplement request; khả năng tiếp tục công việc được quyết định độc lập.
Khi phần thi công xong, đúng assigned Worker hoặc Crew Lead gửi Work Done.
3.5. Inspection và quality close
QC thực hiện pre-activity/hold/final inspection theo checkpoint.
Fail tạo rectification; người thực hiện sửa và nộp bằng chứng; QC re-inspect.
Quality gate chỉ cho Work Order Closed khi các điều kiện bắt buộc đạt.
4. Quy tắc nghiệp vụ trọng yếu
5. Vòng đời trạng thái
5.1. Work Order và trạng thái độc lập
5.2. Readiness và Blocker
5.3. Quality
6. Tổng quan yêu cầu chức năng
7. Yêu cầu chức năng chi tiết
Mỗi yêu cầu có mã duy nhất, actor, kênh và tiêu chí nghiệm thu. Dòng “Truy vết” liên kết tới yêu cầu kinh doanh trong BRD-CWM-QC-002 V2.0, Business Rule và Use Case tương ứng. Mục 13.3 cung cấp ma trận BRD → SRS → Use Case → Acceptance để kiểm soát đồng bộ baseline.
7.1. IAM - Tài khoản và phân quyền
7.2. ORG - Tổ chức và nguồn lực
7.3. PRJ - Dự án và dữ liệu nền
7.4. JOB - Work Order, điều phối và thực hiện
7.5. SCH - Lịch và tiến độ
7.6. QUA - Checklist và kiểm soát chất lượng
7.7. RPT - Thông báo, báo cáo và truy vết
8. Trường hợp sử dụng chi tiết
8.1. UC-01 - Đăng nhập và truy cập theo vai trò
8.2. UC-02 - Thiết lập dự án và nguồn lực
8.3. UC-03 - Tạo, lập lịch và phân công trực tiếp
8.4. UC-04 - Worker tự nhận việc trên Job Board
8.5. UC-05 - Pre-start và thực hiện Work Order
8.6. UC-06 - Ghi nhận và xử lý Blocker
8.7. UC-07 - Inspection, khắc phục và tái kiểm
8.8. UC-08 - Material Readiness và yêu cầu bổ sung
8.9. UC-09 - Dashboard, thông báo và audit
9. Yêu cầu dữ liệu
9.1. Nhóm dữ liệu nghiệp vụ
9.2. Quy tắc dữ liệu bắt buộc
Mỗi thực thể nghiệp vụ chính có định danh duy nhất, trạng thái hiện hành và created/updated metadata khi áp dụng.
Assignment giữ Work Order, assignee type/id, source, active interval và Crew Lead/Worker responsibility cần thiết để audit.
Dependency không được tạo self-loop; hệ thống phải phát hiện vòng lặp trực tiếp và nên chặn vòng lặp tổng quát trước lưu.
Readiness và Blocker không ghi đè execution state; các object liên kết Work Order và có timeline riêng.
Blocker giữ reason, responsible party, opened/resolved time, duration và resolution note.
Checklist/Inspection giữ version nội dung áp dụng; sửa template không thay kết quả lịch sử.
Attachment giữ type, size, uploader, time, source object và access rule.
Dữ liệu đã phát sinh giao dịch dùng inactive/soft-delete theo policy; hard delete chỉ cho draft chưa được tham chiếu.
9.3. Chất lượng dữ liệu
10. Yêu cầu giao diện và tích hợp
10.1. Web quản lý
Desktop-first cho Admin, Project Manager, Coordinator và QC.
Danh sách lớn có search/filter/sort/pagination; Work Order detail hiển thị assignment, readiness, blocker, material, quality và timeline theo quyền.
Calendar và dashboard có drill-down tới dữ liệu nguồn.
Biểu mẫu có validation, loading/success/error và confirmation cho thao tác thu hồi/reassign/close ngoại lệ.
10.2. Mobile hiện trường
Ưu tiên Job Board, My Jobs/Today Jobs, Work Order Detail, Readiness, Blocker, Checklist, Material, Progress/Evidence và QC khi role cho phép.
Assigned Worker/Crew Lead thấy next action rõ; Crew member không thấy Submit Work Done nếu không có quyền.
Camera/tệp chỉ yêu cầu permission khi dùng; từ chối quyền không làm ứng dụng crash.
Mất mạng/gửi thất bại phải hiển thị trạng thái và cho retry an toàn; offline đầy đủ ngoài phạm vi.
10.3. Upload ảnh/tệp
10.4. Giao tiếp giữa Web và Mobile
Web và Mobile phải sử dụng cùng business rule, state model và dữ liệu nguồn qua Backend API. Chi tiết endpoint/payload/protocol được xác định trong tài liệu thiết kế/API sau khi SRS được phê duyệt.
10.5. Thông báo
Baseline Must chỉ yêu cầu thông báo trong ứng dụng. Push notification, email hoặc SMS không phải tiêu chí nghiệm thu. Mỗi thông báo phải có source object và kiểm tra quyền khi mở.
11. Yêu cầu phi chức năng
11.1. Điều kiện benchmark
Khi đo performance phải ghi rõ server spec, database size, concurrent users, network và seed data.
NFR-PERF là mục tiêu nghiệm thu cho môi trường được ghi lại, không phải cam kết hiệu năng cho mọi hạ tầng.
NFR-CMP-002 là TBD và phải được chốt trước khi đóng thiết kế Mobile.
12. Xác minh, kiểm thử và nghiệm thu
12.1. Nguyên tắc nghiệm thu
Mọi yêu cầu Must có ít nhất một test case hoặc bước demo chứng minh kết quả quan sát được.
Should không chặn phát hành nếu chưa triển khai nhưng phải được đánh dấu rõ trong báo cáo phạm vi.
Lỗi làm sai quyền, assignment, dependency/readiness gate, blocker duration, Hold Point hoặc quality close là lỗi nghiêm trọng.
Test phải bao gồm main flow, alternative flow, retry, concurrency, permission và invalid data.
Dữ liệu demo phải chứng minh Web và Mobile dùng chung state/assignee/timeline.
12.2. Kịch bản nghiệm thu tối thiểu
12.3. Nhóm kiểm thử bắt buộc
12.4. Điều kiện hoàn thành phát hành
Toàn bộ Must Passed hoặc có waiver được đại diện nghiệp vụ phê duyệt.
Không còn lỗi Critical/High về quyền, assignment, state/gate, mất dữ liệu hoặc quality control.
Có dữ liệu mẫu, tài khoản demo, hướng dẫn chạy, API/design docs cần thiết và E2E demo script.
Should chưa làm được đánh dấu rõ và không được trình bày như chức năng đã hoàn thành.
13. Truy vết yêu cầu
13.1. Ma trận Module - Use Case - Business Rule
13.2. Truy vết nghiệp vụ nhạy cảm
13.3. Truy vết BRD
BRD-CWM-QC-002 V2.0 là nguồn nghiệp vụ chính của SRS V2.1. Một yêu cầu kinh doanh có thể được chi tiết thành nhiều yêu cầu phần mềm; vì vậy 54 BR và 82 FR không cần có số lượng bằng nhau. Ma trận dưới đây xác nhận toàn bộ yêu cầu BRD đã được liên kết tới FR, Use Case và tiêu chí nghiệm thu kinh doanh tương ứng.
C1 - Tài khoản và phân quyền
C2 - Tổ chức và nguồn lực
C3 - Dự án và dữ liệu nền
C4 - Work Order, điều phối và thực hiện
C5 - Lịch và tiến độ
C6 - Checklist và kiểm soát chất lượng
C7 - Thông báo, báo cáo và truy vết
14. Quyết định cần xác nhận và quản lý thay đổi
14.1. Quyết định cần xác nhận
14.2. Quy trình thay đổi yêu cầu
Người đề xuất mô tả nhu cầu, giá trị, mức khẩn cấp và yêu cầu hiện tại bị ảnh hưởng.
Business Analyst đánh giá tác động đến scope, workflow, data, permission, test và timeline.
Đại diện nghiệp vụ quyết định Accept / Defer / Reject.
Thay đổi Must phải đi kèm đánh giá capacity; nếu cần, một hạng mục tương đương phải được giảm/hoãn.
SRS, test case, thiết kế và tài liệu liên quan được đồng bộ trước khi phát triển tiếp.
Phụ lục A. Thuật ngữ
Phụ lục B. Tóm tắt số lượng yêu cầu
Yêu cầu phi chức năng: 24 (bao gồm 1 mục TBD về nền tảng Mobile). Use Case chi tiết: 9. Business Rule trọng yếu: 21. Kịch bản nghiệm thu tối thiểu: 18.
Định hướng nghiệp vụ cốt lõi
Work Order là đơn vị trung tâm. Hệ thống hỗ trợ điều phối kết hợp (phân công trực tiếp hoặc Worker tự nhận trên Job Board), Crew/Crew Lead, dependency và pre-start readiness, quản lý blocker/constraint, vật tư trực tiếp phục vụ Work Order, tác nghiệp hiện trường và quality gate từ inspection đến rectification/reinspection.
Thuộc tính
Nội dung
Mã tài liệu
SRS-CWM-QC-002
Phiên bản
2.1 - Đồng bộ chính thức với BRD-CWM-QC-002 V2.0
Trạng thái
Dự thảo đồng bộ BRD V2.0 - chờ xác nhận
Ngày cập nhật
24/08/2026
Phạm vi phát hành
Phiên bản đồ án tốt nghiệp - Web + Mobile
Tài liệu nghiệp vụ nền
BRD-CWM-QC-002 V2.0; Đề cương đồ án cập nhật
Thuộc tính
Nội dung
Tên tài liệu
Đặc tả yêu cầu phần mềm - Hệ thống Quản lý Công việc Thi công và Kiểm soát Chất lượng tại Công trường cho VINACON
Mục đích
Thống nhất hành vi phần mềm, dữ liệu, vai trò, kênh Web/Mobile, yêu cầu chất lượng và tiêu chí nghiệm thu trước thiết kế/triển khai.
Đối tượng đọc
Đại diện doanh nghiệp, quản lý vận hành, QC, Business Analyst, UX/UI, nhóm phát triển, kiểm thử và hội đồng đánh giá.
Phạm vi tài liệu
Yêu cầu phần mềm và kết quả quan sát được; không quy định schema vật lý, endpoint chi tiết, framework hoặc cấu trúc mã.
Baseline
82 yêu cầu chức năng: 70 Must và 12 Should; được truy vết tới 54 yêu cầu kinh doanh trong BRD-CWM-QC-002 V2.0.
Phiên bản
Ngày
Mô tả thay đổi
Trạng thái
1.0
01/08/2026
Baseline cũ: 82 FR, có module MAT độc lập và chưa mô hình đầy đủ Crew Lead/readiness/blocker/checkpoint.
Đã thay thế
2.0
23/08/2026
Re-baseline: bỏ procurement/material module độc lập; thêm Crew Lead, dependency, readiness, blocker, material-in-JOB, Hold Point và cột Kênh Web/Mobile.
Đã thay thế bởi V2.1
2.1
24/08/2026
Đồng bộ với BRD-CWM-QC-002 V2.0; bổ sung truy vết BRD → SRS → Use Case → Acceptance; giữ nguyên baseline chức năng 82 FR (70 Must, 12 Should).
Dự thảo xác nhận
Nhãn
Ý nghĩa
Must
Bắt buộc để workflow cốt lõi hoạt động hoặc để nghiệm thu phiên bản đầu.
Should
Có giá trị rõ nhưng không chặn nghiệm thu nếu chưa triển khai.
TBD
Chưa đủ quyết định nghiệp vụ; phải chốt trước thiết kế hoặc kiểm thử liên quan.
Thuật ngữ
Định nghĩa
Work Order
Đơn vị công việc thi công được quản lý xuyên suốt từ planning/dispatch đến execution, quality gate và Closed.
Worker
Cá nhân trực tiếp thực hiện công việc tại hiện trường.
Crew
Tổ/đội gồm nhiều Worker; được dùng như một nguồn lực cho direct assignment.
Crew Lead
Worker đại diện Crew và chịu trách nhiệm các thao tác xác nhận ở cấp Work Order theo rule.
Assignment
Quan hệ active xác định Work Order đang được giao cho Worker hoặc Crew.
Job Board
Danh sách Work Order còn trống được mở để Worker đủ điều kiện tự nhận.
Eligibility
Tập điều kiện về trạng thái, quyền, skill, lịch và giới hạn dùng cho self-accept/direct assignment.
Dependency
Quan hệ Work Order tiền nhiệm phải đạt điều kiện trước khi Work Order phụ thuộc có thể sẵn sàng.
Readiness
Kết quả pre-start: READY, READY_WITH_CONSTRAINT hoặc NOT_READY.
Blocker/Constraint
Vướng mắc có thể ngăn hoặc ảnh hưởng việc bắt đầu/tiếp tục Work Order; có reason, owner và duration.
Work Done
Phần thi công đã được Worker/Crew Lead xác nhận xong; chưa đồng nghĩa Work Order Closed.
Hold Point
Checkpoint bắt buộc được QC release trước khi bước thi công bị kiểm soát được tiếp tục.
Rectification
Hạng mục khắc phục phát sinh từ inspection không đạt/conditional pass.
Material Supplement Request
Yêu cầu bổ sung vật tư gắn với Work Order; không phải purchase requisition/procurement approval.
Nguyên tắc thiết kế nghiệp vụ
Không nhồi mọi tình huống vào một Work Order status. Execution state, readiness, blocker và quality có state model riêng để biểu diễn chính xác tình huống như “IN_PROGRESS + WEATHER blocker” hoặc “WORK_DONE + rectification open”.
Nhóm
Nhu cầu chính
Kênh
Quản trị viên
Tài khoản, role, dữ liệu nền, Worker/Crew/skill.
Web
Quản lý dự án
Project, ngoại lệ, tiến độ, blocker, dashboard và quality oversight.
Web
Điều phối viên
Tạo Work Order, dependency, lịch, Job Board, direct assignment, reassign, blocker coordination.
Web
Worker
Job Board, My Jobs, readiness, execution, progress, evidence, material shortage.
Mobile
Crew Lead
Đại diện Crew: readiness, blocker, execution và Submit Work Done.
Mobile
Crew Member
Thực hiện/cập nhật dữ liệu được cấp quyền; không Submit Work Done ở cấp Work Order.
Mobile
Quality Inspector (QC)
Inspection queue, checkpoint, Hold release, defect/rectification, reinspection.
Web/Mobile
Hệ thống
Eligibility, concurrency, state gate, notification, KPI và audit.
Tự động
Miền
Admin
Quản lý DA
Điều phối
Worker/Crew
QC
Tài khoản/Role
Quản lý
Xem hạn chế
Xem hạn chế
Hồ sơ cá nhân
Xem hạn chế
Project/Data nền
Quản lý
Quản lý
Quản lý theo phân công
Xem liên quan
Xem liên quan
Work Order/Job Board
Cấu hình
Giám sát
Tạo/mở/assign/reassign
Self-accept/thực hiện
Xem/kiểm tra
Crew/Resource
Quản lý
Xem
Tra cứu/điều phối
Xem Crew của mình
Xem liên quan
Readiness/Blocker
Xem
Giám sát/xử lý
Theo dõi/xử lý
Ghi nhận/cập nhật
Xem liên quan
Quality
Cấu hình
Giám sát
Theo dõi
Checklist/khắc phục
Kiểm tra/kết luận
Dashboard/Audit
Theo quyền
Dự án
Vận hành
Cá nhân hạn chế
Chất lượng
Mã
Chủ đề
Quy tắc bắt buộc
BR-01
Điều phối kết hợp
Work Order có thể được phân công trực tiếp hoặc mở để Worker tự nhận; hai cơ chế dùng cùng nguyên tắc về trạng thái, năng lực và lịch.
BR-02
Self-accept có hiệu lực ngay
Worker đủ điều kiện nhận Work Order còn trống được xác nhận ngay, không chờ quản lý phê duyệt lần hai.
BR-03
Một assignment chính
Một Work Order chỉ có một assignment ACTIVE tại một thời điểm; assignee là Worker hoặc Crew.
BR-04
Eligibility dùng chung
Nguồn lực phải active, đáp ứng skill, quyền dự án và lịch theo chính sách trước khi nhận/phân công.
BR-05
Một winner khi đồng thời
Nhiều yêu cầu self-accept cùng Work Order chỉ tạo một assignment ACTIVE; retry không tạo bản ghi trùng.
BR-06
Crew Lead có hiệu lực
Crew dùng cho assignment phải có một Crew Lead active; thay đổi lead giữ lịch sử hiệu lực.
BR-07
Quyền xác nhận phần thi công
Assignment cá nhân: assigned Worker được Submit Work Done. Assignment Crew: Crew Lead được Submit Work Done; member khác không có quyền này.
BR-08
Dependency gate
Dependency bắt buộc chưa đạt làm Work Order chưa sẵn sàng bắt đầu, trừ ngoại lệ được phê duyệt và audit nếu chính sách cho phép.
BR-09
Readiness gate
NOT_READY không được Start; READY được Start; READY_WITH_CONSTRAINT chỉ Start khi constraint không blocking.
BR-10
Blocker là đối tượng độc lập
Blocked/On-hold được biểu diễn bằng blocker/constraint độc lập thay vì thay thế toàn bộ execution state của Work Order.
BR-11
Truy vết thời gian bị ảnh hưởng
Blocker phải lưu nguyên nhân, opened/resolved time, responsible party và duration để phục vụ phân tích chậm/KPI.
BR-12
Vật tư phục vụ Work Order
Vật tư chỉ ở mức planned material, readiness và supplement request; thiếu vật tư không tự động block và không phát sinh procurement/inventory.
BR-13
Checklist blocking
Checklist item được đánh dấu blocking phải đạt trước khi Start/transition liên quan được phép.
BR-14
Hold Point
Tại Hold Point, bước thi công bị kiểm soát không được tiếp tục trước khi QC có quyền kiểm tra và release.
BR-15
Work Done khác Closed
Submit Work Done chỉ xác nhận phần thi công đã xong; Work Order chỉ Closed sau quality gate.
BR-16
Quality gate
Work Order không Closed khi còn checkpoint bắt buộc, final inspection hoặc rectification bắt buộc chưa đạt/verified.
BR-17
Thu hồi/tái phân công có lịch sử
Reassign/withdraw/cancel assignment phải có lý do và bảo toàn assignee, thời điểm và actor trước đó.
BR-18
Không xóa lịch sử nghiệp vụ
Dữ liệu đã phát sinh giao dịch không được hard delete làm mất audit/bằng chứng; dùng trạng thái/ngừng hoạt động theo chính sách.
BR-19
Quyền theo vai trò và dự án
Người dùng chỉ xem/thao tác dữ liệu thuộc quyền và phạm vi dự án; Backend phải kiểm tra quyền cho mọi thao tác.
BR-20
Thông báo không đổi nghiệp vụ
Đọc/xóa thông báo không thay đổi trạng thái Work Order, blocker, inspection hoặc đối tượng nguồn.
BR-21
Thời gian nhất quán
Lịch, transition, audit và KPI phải dùng thời gian lưu/so sánh nhất quán và hiển thị rõ múi giờ áp dụng.
Nguyên tắc chuyển trạng thái
Mỗi chuyển trạng thái quan trọng phải kiểm tra role, state hiện tại và gate liên quan; lưu actor/thời điểm/before-after/lý do khi bắt buộc. Retry không được lặp tác động nghiệp vụ.
Trạng thái
Ý nghĩa
Chuyển tiếp chính
DRAFT
Chưa đủ hoặc chưa sẵn sàng phát hành.
READY hoặc CANCELLED
READY
Đủ dữ liệu để direct assign hoặc mở Job Board.
OPEN hoặc ASSIGNED hoặc CANCELLED
OPEN
Đang khả dụng trên Job Board và chưa có assignment.
ASSIGNED hoặc READY/CANCELLED
ASSIGNED
Có assignment active cho Worker/Crew.
IN_PROGRESS sau readiness; hoặc reassign/withdraw theo rule
IN_PROGRESS
Phần thi công đang được thực hiện.
WORK_DONE; vẫn có thể có blocker độc lập
WORK_DONE
Người thực hiện đã gửi phần thi công hoàn tất.
CLOSED sau quality gate; quality/rectification xử lý độc lập
CLOSED
Đã đạt điều kiện đóng.
Không chuyển trực tiếp; reopen nếu có ngoại lệ được phê duyệt
CANCELLED
Không tiếp tục thực hiện.
Không chuyển trừ quy trình ngoại lệ có audit
Đối tượng
Vòng đời tham chiếu
Quy tắc chính
Readiness
NOT_READY chặn Start; READY_WITH_CONSTRAINT chỉ Start khi constraint không blocking.
Blocker
Blocker độc lập với execution state; lưu reason, owner và duration.
Material Supplement
Không có approval/procurement; shortage không tự block Work Order.
Đối tượng
Vòng đời tham chiếu
Quy tắc chính
Inspection
Hold Point chỉ release khi điều kiện đạt; mỗi lần inspection giữ lịch sử.
Rectification
Không ghi đè vòng trước; Work Order chưa Closed khi item bắt buộc chưa verified.
Assignment
Tại một thời điểm chỉ một ACTIVE assignment cho Work Order.
Project
Project Closed không tạo Work Order mới; reopen cần quyền.
Notification
Không thay đổi state của đối tượng nguồn.
Mã
Năng lực
Tổng FR
Ưu tiên
Use Case
IAM
Tài khoản và phân quyền
8
Must 7; Should 1
UC-01
ORG
Tổ chức và nguồn lực
9
Must 9; Should 0
UC-02/03/04
PRJ
Dự án và dữ liệu nền
10
Must 8; Should 2
UC-02/03/05
JOB
Work Order và điều phối/thực hiện
25
Must 22; Should 3
UC-03/04/05/06/08
SCH
Lịch và tiến độ
7
Must 4; Should 3
UC-03/04/05/09
QUA
Checklist và kiểm soát chất lượng
15
Must 13; Should 2
UC-05/07
RPT
Thông báo, báo cáo và audit
8
Must 7; Should 1
UC-09
Baseline chức năng
Tài liệu định nghĩa 82 yêu cầu chức năng: 70 Must và 12 Should, chi tiết hóa 54 yêu cầu kinh doanh của BRD-CWM-QC-002 V2.0. Must là phạm vi cam kết; Should chỉ triển khai sau khi luồng Plan → Dispatch → Make Ready → Execute → Inspect → Rectify → Close hoạt động ổn định.
Thuộc tính
Nội dung
Tổng yêu cầu
8
Phân bố ưu tiên
Must: 7; Should: 1
Mục tiêu
Bảo đảm người dùng được xác thực, truy cập đúng role/project scope và các thay đổi nhạy cảm có thể truy vết.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
IAM-SRS-001
Must
Tất cả người dùng
Web/Mobile
Đăng nhập
Hệ thống phải cho phép người dùng đăng nhập bằng thông tin xác thực hợp lệ và khởi tạo phiên theo vai trò được cấp.
Truy vết BRD: IAM-01 | Quy tắc: BR-19 | Use Case: UC-01
Tài khoản khóa/ngừng hoạt động bị từ chối; lỗi không tiết lộ tài khoản có tồn tại; sau đăng nhập chỉ thấy chức năng và dữ liệu thuộc quyền.
IAM-SRS-002
Must
Tất cả người dùng
Web/Mobile
Đăng xuất và hết phiên
Người dùng phải có thể đăng xuất; hệ thống phải kết thúc hoặc yêu cầu xác thực lại khi phiên hết hạn hoặc bị thu hồi.
Truy vết BRD: IAM-01 | Use Case: UC-01
Đăng xuất làm mất hiệu lực phiên hiện tại; dữ liệu đã lưu hợp lệ không mất; yêu cầu bằng phiên hết hạn bị từ chối.
IAM-SRS-003
Must
Người dùng
Web/Mobile
Quản lý hồ sơ cá nhân
Người dùng phải xem và cập nhật các trường hồ sơ được phép như họ tên, điện thoại, ảnh đại diện và thông tin liên hệ.
Truy vết BRD: IAM-03 | Use Case: UC-01
Trường ảnh hưởng định danh/quyền không được tự thay đổi; dữ liệu hợp lệ hiển thị nhất quán giữa các kênh.
IAM-SRS-004
Must
Quản trị viên
Web
Quản lý tài khoản
Quản trị viên phải tạo, cập nhật, khóa, mở khóa và ngừng hoạt động tài khoản trong phạm vi doanh nghiệp.
Truy vết BRD: IAM-04 | Quy tắc: BR-18, BR-19 | Use Case: UC-01
Email/tên đăng nhập duy nhất; tài khoản có lịch sử không xóa cứng; thay đổi trạng thái lưu actor và thời điểm.
IAM-SRS-005
Must
Quản trị viên
Web
Gán vai trò và quyền
Quản trị viên phải gán vai trò đã được phê duyệt; hệ thống phải kiểm tra quyền xem và thao tác ở phía Backend.
Truy vết BRD: IAM-05 | Quy tắc: BR-19 | Use Case: UC-01
Ẩn nút trên UI không thay thế kiểm tra quyền; thay đổi quyền có hiệu lực theo chính sách phiên và được audit.
IAM-SRS-006
Must
Hệ thống
System
Giới hạn dữ liệu theo dự án
Hệ thống phải giới hạn dữ liệu nghiệp vụ theo vai trò và danh sách dự án mà người dùng tham gia.
Truy vết BRD: IAM-05 | Quy tắc: BR-19 | Use Case: UC-01
Sửa ID/URL không cho phép truy cập dự án ngoài phạm vi; ngoại lệ quản trị phải được xác định và audit.
IAM-SRS-007
Should
Tất cả người dùng
Web/Mobile
Đổi và đặt lại mật khẩu
Người dùng nên có thể đổi mật khẩu khi đang đăng nhập và yêu cầu đặt lại mật khẩu khi quên.
Truy vết BRD: IAM-02 | Use Case: UC-01
Mã/liên kết đặt lại có thời hạn và dùng một lần; mật khẩu mới tuân chính sách; không tiết lộ email có tồn tại.
IAM-SRS-008
Must
Hệ thống/Quản trị viên
System/Web
Nhật ký xác thực và tài khoản
Hệ thống phải ghi đăng nhập thành công/thất bại, đăng xuất, khóa/mở khóa, ngừng hoạt động và thay đổi vai trò.
Truy vết BRD: IAM-04, RPT-04 | Quy tắc: BR-18 | Use Case: UC-01, UC-09
Nhật ký có actor, thời điểm, hành động và kết quả; không ghi mật khẩu, mã đặt lại hoặc token bí mật.
Thuộc tính
Nội dung
Tổng yêu cầu
9
Phân bố ưu tiên
Must: 9; Should: 0
Mục tiêu
Quản lý Worker, Crew, Crew Lead, contractor, trade/skill và dữ liệu dùng trong eligibility.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
ORG-SRS-001
Must
Quản trị viên
Web
Quản lý Worker
Quản trị viên phải tạo, xem, cập nhật và tìm kiếm hồ sơ Worker gồm liên hệ, trạng thái, ngành nghề và kỹ năng.
Truy vết BRD: ORG-01 | Quy tắc: BR-04 | Use Case: UC-02
Worker ngừng hoạt động không được nhận/phân công việc mới; lịch sử assignment cũ vẫn giữ.
ORG-SRS-002
Must
Quản trị viên
Web
Quản lý nhà thầu
Hệ thống phải lưu hồ sơ nhà thầu/đối tác thi công và liên kết Worker/Crew thuộc nhà thầu khi áp dụng.
Truy vết BRD: ORG-01 | Use Case: UC-02
Nhà thầu ngừng hoạt động không dùng cho quan hệ mới; Work Order vẫn được giao cho Worker hoặc Crew, không giao trực tiếp cho hồ sơ tổ chức.
ORG-SRS-003
Must
Quản trị viên
Web
Quản lý ngành nghề và kỹ năng
Quản trị viên phải quản lý danh mục Trade/Skill và gán năng lực phù hợp cho Worker/Crew.
Truy vết BRD: ORG-02 | Quy tắc: BR-04 | Use Case: UC-02
Danh mục đã dùng chỉ ngừng hoạt động; skill hết hiệu lực không dùng cho kiểm tra assignment mới.
ORG-SRS-004
Must
Quản trị viên
Web
Quản lý trạng thái nguồn lực
Quản trị viên phải kích hoạt, tạm ngừng hoặc ngừng hoạt động Worker, Crew và nhà thầu.
Truy vết BRD: ORG-04 | Quy tắc: BR-04, BR-18 | Use Case: UC-02
Trước khi ngừng hoạt động phải cảnh báo assignment/lịch đang mở; không làm mất lịch sử.
ORG-SRS-005
Must
Quản lý/Điều phối viên
Web
Tra cứu nguồn lực
Người có quyền phải tìm kiếm/lọc nguồn lực theo trạng thái, trade/skill, crew và dự án để phục vụ điều phối.
Truy vết BRD: ORG-05 | Quy tắc: BR-04, BR-19 | Use Case: UC-02, UC-03
Kết quả chỉ chứa nguồn lực trong phạm vi được phép và phản ánh dữ liệu hiện hành.
ORG-SRS-006
Must
Điều phối viên/Quản trị viên
Web
Quản lý Crew
Người có quyền phải tạo Crew/Tổ đội, đặt tên, liên kết nhà thầu khi cần và quản lý trạng thái Crew.
Truy vết BRD: ORG-03 | Quy tắc: BR-03 | Use Case: UC-02
Crew ngừng hoạt động không nhận assignment mới; lịch sử công việc cũ không đổi.
ORG-SRS-007
Must
Điều phối viên/Quản trị viên
Web
Quản lý thành viên Crew
Người có quyền phải thêm/loại thành viên Crew và ghi thời gian hiệu lực của quan hệ thành viên.
Truy vết BRD: ORG-03 | Quy tắc: BR-06, BR-18 | Use Case: UC-02
Lịch sử thành viên tại thời điểm thực hiện được bảo toàn; hệ thống cảnh báo dữ liệu trùng/không hợp lệ.
ORG-SRS-008
Must
Điều phối viên/Quản trị viên
Web
Chỉ định Crew Lead
Mỗi Crew đang hoạt động dùng cho assignment phải có đúng một Crew Lead hiệu lực tại một thời điểm.
Truy vết BRD: ORG-03 | Quy tắc: BR-06, BR-07 | Use Case: UC-02, UC-03
Crew Lead phải là thành viên Crew và đang hoạt động; thay đổi Lead giữ lịch sử và không tự sửa actor của thao tác đã phát sinh.
ORG-SRS-009
Must
Hệ thống
System
Cung cấp dữ liệu eligibility
Hệ thống phải cung cấp trạng thái hoạt động, skill, crew membership, Crew Lead và dữ liệu liên quan cho bước phân công/tự nhận.
Truy vết BRD: ORG-05 | Quy tắc: BR-04, BR-06 | Use Case: UC-03, UC-04
Các kiểm tra mới dùng dữ liệu hiện hành; assignment đã phát sinh vẫn giữ snapshot/lịch sử cần thiết.
Thuộc tính
Nội dung
Tổng yêu cầu
10
Phân bố ưu tiên
Must: 8; Should: 2
Mục tiêu
Thiết lập Project/Area/Work Type/member, dependency và dữ liệu nền trước khi điều phối Work Order.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
PRJ-SRS-001
Must
Quản lý dự án
Web
Tạo và cập nhật dự án
Quản lý dự án phải tạo/cập nhật dự án với mã, tên, địa điểm, thời gian dự kiến, người phụ trách và mô tả.
Truy vết BRD: PRJ-01 | Use Case: UC-02
Mã dự án duy nhất; trường bắt buộc được kiểm tra; thay đổi quan trọng được audit.
PRJ-SRS-002
Must
Quản lý dự án
Web
Quản lý trạng thái dự án
Người có quyền phải chuyển dự án giữa Nháp, Đang hoạt động, Tạm dừng, Hoàn thành và Đóng theo điều kiện.
Truy vết BRD: PRJ-01 | Quy tắc: BR-19 | Use Case: UC-02
Dự án Đóng không tạo Work Order mới; mở lại cần quyền và lý do.
PRJ-SRS-003
Must
Quản lý dự án
Web
Quản lý khu vực/hạng mục
Dự án phải hỗ trợ khu vực/hạng mục để liên kết Work Order và tổng hợp tiến độ.
Truy vết BRD: PRJ-02 | Use Case: UC-02
Baseline hỗ trợ cấu trúc phân nhóm đủ cho phạm vi đồ án; hạng mục đã dùng không bị xóa làm mất lịch sử.
PRJ-SRS-004
Must
Quản trị viên/Điều phối viên
Web
Quản lý loại công việc
Hệ thống phải quản lý loại công việc, nhóm công việc, skill yêu cầu, checklist/checkpoint mặc định và dữ liệu bắt buộc.
Truy vết BRD: PRJ-03 | Quy tắc: BR-04, BR-13, BR-14 | Use Case: UC-02
Loại công việc ngừng hoạt động không dùng cho WO mới; dữ liệu cũ hiển thị đúng.
PRJ-SRS-005
Must
Quản lý dự án
Web
Quản lý thành viên dự án
Quản lý dự án phải thêm/loại quản lý, điều phối viên, QC và người dùng liên quan vào dự án.
Truy vết BRD: PRJ-04 | Quy tắc: BR-19 | Use Case: UC-02
Người bị loại không truy cập dữ liệu mới nhưng hành động lịch sử vẫn giữ.
PRJ-SRS-006
Must
Hệ thống
System
Kiểm soát truy cập dự án
Hệ thống phải dùng vai trò và quan hệ thành viên dự án để giới hạn danh sách, chi tiết và thao tác.
Truy vết BRD: PRJ-04, IAM-05 | Quy tắc: BR-19 | Use Case: UC-01, UC-02
Không thể vượt quyền bằng sửa tham số; ngoại lệ quản trị được audit.
PRJ-SRS-007
Must
Quản trị viên
Web
Quản lý vòng đời dữ liệu nền
Danh mục đã phát sinh giao dịch phải hỗ trợ trạng thái hoạt động/ngừng hoạt động thay cho xóa cứng.
Truy vết BRD: PRJ-01 | Quy tắc: BR-18 | Use Case: UC-02
Danh sách chọn giao dịch mới chỉ hiển thị bản ghi đang hoạt động; lịch sử cũ không mất.
PRJ-SRS-008
Should
Điều phối viên
Web
Quản lý mẫu Work Order
Điều phối viên nên tạo mẫu gồm mô tả, thời lượng, skill, checklist/checkpoint và vật tư dự kiến để dùng khi tạo Work Order.
Truy vết BRD: PRJ-06 | Use Case: UC-02, UC-03
Sửa mẫu không thay đổi Work Order đã tạo; có thể chỉnh dữ liệu sau khi áp dụng mẫu.
PRJ-SRS-009
Should
Quản lý dự án
Web
Quản lý tệp tham chiếu cơ bản
Người có quyền nên tải lên/xem/ngừng sử dụng tệp gắn với dự án hoặc Work Order.
Truy vết BRD: PRJ-06 | Use Case: UC-02, UC-05
Kiểm tra loại/kích thước; không bao gồm cây thư mục, public sharing hoặc versioning tài liệu phức tạp.
PRJ-SRS-010
Must
Điều phối viên
Web
Quản lý dependency giữa Work Order
Điều phối viên phải có thể xác định một hoặc nhiều Work Order tiền nhiệm khi công việc phụ thuộc kết quả của công việc khác.
Truy vết BRD: PRJ-05 | Quy tắc: BR-08 | Use Case: UC-03, UC-05
Không tạo vòng lặp dependency trực tiếp; dependency bắt buộc được dùng trong readiness; thay đổi giữ audit.
Thuộc tính
Nội dung
Tổng yêu cầu
25
Phân bố ưu tiên
Must: 22; Should: 3
Mục tiêu
Quản lý vòng đời công việc từ draft/publish/assignment đến readiness, blocker, material readiness, execution và Work Done.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
JOB-SRS-001
Must
Điều phối viên
Web
Tạo Work Order nháp
Điều phối viên phải tạo Work Order gắn với dự án, khu vực/hạng mục, loại công việc, mô tả, ưu tiên, thời hạn và skill yêu cầu.
Truy vết BRD: JOB-01 | Use Case: UC-03
Thiếu dữ liệu bắt buộc chỉ cho lưu Nháp; WO nháp chưa được phân công hoặc hiển thị Job Board.
JOB-SRS-002
Must
Hệ thống
System
Kiểm tra điều kiện phát hành
Trước khi phân công hoặc mở Job Board, hệ thống phải kiểm tra dự án, dữ liệu bắt buộc, loại công việc, lịch cơ bản và các điều kiện phát hành đã cấu hình.
Truy vết BRD: JOB-02 | Quy tắc: BR-01 | Use Case: UC-03, UC-04
Mọi điều kiện chưa đạt được liệt kê cụ thể; không tạo assignment một phần khi thất bại.
JOB-SRS-003
Must
Điều phối viên
Web
Cập nhật Work Order
Điều phối viên phải cập nhật mô tả, ưu tiên, thời hạn, hướng dẫn, dependency và dữ liệu được phép khi trạng thái cho phép.
Truy vết BRD: JOB-01 | Quy tắc: BR-17, BR-18 | Use Case: UC-03
Thay đổi ảnh hưởng assignee/lịch gửi thông báo; dữ liệu sau Closed chỉ sửa qua ngoại lệ có audit.
JOB-SRS-004
Must
Điều phối viên
Web
Mở/đóng Job Board
Điều phối viên phải mở WO đủ điều kiện lên Job Board và đóng khỏi danh sách khi cần.
Truy vết BRD: JOB-03 | Quy tắc: BR-01 | Use Case: UC-04
Chỉ WO READY/OPEN, chưa có assignment và chưa hủy được hiển thị; đóng Job Board không hủy assignment đã tồn tại.
JOB-SRS-005
Must
Worker
Mobile
Xem và lọc Job Board
Worker phải xem và lọc các Work Order còn trống theo ngày, dự án, khu vực, loại công việc và skill.
Truy vết BRD: JOB-04 | Quy tắc: BR-04, BR-19 | Use Case: UC-04
Danh sách loại trừ WO đã có người nhận, hết thời gian khả dụng, sai trạng thái hoặc ngoài quyền dự án.
JOB-SRS-006
Must
Worker
Mobile
Xem chi tiết công việc còn trống
Trước khi nhận, Worker phải xem thời gian, địa điểm, mô tả, skill, checklist/checkpoint, vật tư dự kiến và hướng dẫn cần thiết.
Truy vết BRD: JOB-04 | Use Case: UC-04
Thông tin là phiên bản hiện hành; không lộ dữ liệu ngoài quyền hoặc thông tin cá nhân không cần thiết.
JOB-SRS-007
Must
Worker
Mobile
Tự nhận Work Order
Worker phải có thể chọn Nhận việc và được xác nhận ngay khi WO còn trống và mọi điều kiện eligibility đều đạt.
Truy vết BRD: JOB-04 | Quy tắc: BR-01, BR-02 | Use Case: UC-04
Không có bước quản lý phê duyệt lại; assignment ghi nguồn SELF_ACCEPT và WO xuất hiện trong My Jobs/lịch.
JOB-SRS-008
Must
Hệ thống
System
Kiểm tra eligibility
Hệ thống phải kiểm tra Worker đang hoạt động, đúng skill, thuộc phạm vi dự án, không xung đột lịch và không vi phạm giới hạn cấu hình.
Truy vết BRD: JOB-05 | Quy tắc: BR-04 | Use Case: UC-03, UC-04
Mỗi điều kiện không đạt trả lý do cụ thể; không để lại assignment/bản ghi chờ không hợp lệ.
JOB-SRS-009
Must
Hệ thống
System
Bảo đảm một winner khi tự nhận
Khi nhiều Worker nhận cùng Work Order, hệ thống phải bảo đảm chỉ một assignment ACTIVE được tạo.
Truy vết BRD: JOB-05 | Quy tắc: BR-05 | Use Case: UC-04
Một yêu cầu thành công; yêu cầu còn lại nhận kết quả WO đã được nhận; gửi lặp không tạo assignment trùng.
JOB-SRS-010
Must
Điều phối viên
Web
Phân công trực tiếp
Điều phối viên phải phân công Work Order cho một Worker hoặc Crew phù hợp.
Truy vết BRD: JOB-06 | Quy tắc: BR-01, BR-03, BR-04, BR-06 | Use Case: UC-03
Phân công dùng cùng nguyên tắc trạng thái/skill/lịch; assignment ghi nguồn DIRECT; Crew phải active và có Crew Lead active.
JOB-SRS-011
Must
Hệ thống
System
Xác định trách nhiệm Assignment
Hệ thống phải xác định người có quyền xác nhận ở cấp Work Order theo loại assignment.
Truy vết BRD: JOB-07 | Quy tắc: BR-06, BR-07 | Use Case: UC-03, UC-05
Assignment cá nhân: assigned Worker chịu trách nhiệm. Assignment Crew: Crew Lead hiệu lực chịu trách nhiệm; member khác chỉ cập nhật phần được cấp quyền.
JOB-SRS-012
Must
Điều phối viên
Web
Tái phân công và thu hồi
Điều phối viên phải thay hoặc thu hồi assignment khi trạng thái cho phép.
Truy vết BRD: JOB-08 | Quy tắc: BR-17, BR-18 | Use Case: UC-03
Bắt buộc lý do; giữ assignee trước, Crew Lead liên quan, thời điểm và actor; cập nhật lịch/thông báo tương ứng.
JOB-SRS-013
Should
Worker
Mobile
Tiếp nhận/từ chối phân công trực tiếp
Nếu chính sách dự án yêu cầu xác nhận, Worker/Crew Lead nên có thể tiếp nhận hoặc từ chối assignment trực tiếp kèm lý do.
Truy vết BRD: JOB-09 | Use Case: UC-03
Từ chối đưa WO về cần điều phối; không áp dụng cho self-accept đã có hiệu lực ngay.
JOB-SRS-014
Should
Worker/Crew Lead/Điều phối viên
Mobile/Web
Hủy hoặc bỏ việc có kiểm soát
Người có quyền nên có thể yêu cầu hủy/bỏ assignment theo điều kiện và cung cấp lý do.
Truy vết BRD: JOB-10 | Quy tắc: BR-17 | Use Case: UC-03, UC-05
Không hủy âm thầm sau khi công việc bị khóa; có thể đưa WO về trạng thái phù hợp để tái điều phối; giữ audit.
JOB-SRS-015
Must
Worker/Crew Lead
Mobile
Xem My Jobs/Today Jobs
Người thực hiện phải xem các WO mình chịu trách nhiệm, phân nhóm Hôm nay, Sắp tới, Đang thực hiện và Work Done.
Truy vết BRD: JOB-11 | Use Case: UC-05
Danh sách phản ánh đổi lịch, thu hồi, reassign và assignment hiện hành; Crew Lead thấy WO của Crew.
JOB-SRS-016
Must
Worker/Crew Lead
Mobile
Xem chi tiết và hành động khả dụng
Người thực hiện phải xem WO, lịch, dependency, checklist/checkpoint, vật tư, readiness, blocker, tiến độ và hành động hợp lệ.
Truy vết BRD: JOB-11 | Quy tắc: BR-07, BR-08, BR-09 | Use Case: UC-05
Hành động không hợp lệ không được thực hiện; trạng thái thay đổi trong lúc xem phải được kiểm tra lại.
JOB-SRS-017
Must
Worker/Crew Lead
Mobile
Thực hiện Pre-start Readiness
Trước khi Start, người chịu trách nhiệm phải xem/ghi nhận điều kiện sẵn sàng gồm dependency, mặt bằng/access, nguồn lực, vật tư, thông tin thi công, checklist và checkpoint bắt buộc.
Truy vết BRD: JOB-12 | Quy tắc: BR-08, BR-09 | Use Case: UC-05
Hệ thống tự kiểm tra điều kiện có dữ liệu; mục do hiện trường xác nhận lưu actor, thời điểm và bằng chứng khi cần.
JOB-SRS-018
Must
Hệ thống/Worker/Crew Lead
System/Mobile
Ghi nhận kết quả Readiness và Start gate
Hệ thống phải ghi nhận READY, READY_WITH_CONSTRAINT hoặc NOT_READY và quyết định khả năng Start theo các điều kiện blocking.
Truy vết BRD: JOB-12 | Quy tắc: BR-09, BR-10 | Use Case: UC-05
NOT_READY không cho Start; READY cho Start; READY_WITH_CONSTRAINT cho Start khi không có blocker chặn và phải giữ constraint liên quan.
JOB-SRS-019
Must
Worker/Crew Lead
Mobile
Ghi nhận Blocker/Constraint
Người thực hiện phải có thể tạo blocker trước hoặc trong khi thi công, chọn loại nguyên nhân, mô tả, mức ảnh hưởng và đính kèm bằng chứng.
Truy vết BRD: JOB-13 | Quy tắc: BR-10, BR-11 | Use Case: UC-06
Blocker gắn đúng WO, actor, thời điểm; loại nguyên nhân tối thiểu gồm dependency, access, material, information, manpower, equipment, weather, safety và other.
JOB-SRS-020
Must
Điều phối viên/Quản lý/Người báo
Web/Mobile
Theo dõi và giải quyết Blocker
Người có quyền phải xem blocker đang mở, tiếp nhận, cập nhật xử lý và xác nhận resolved.
Truy vết BRD: JOB-13 | Quy tắc: BR-10, BR-11 | Use Case: UC-06
Giữ trạng thái, người phụ trách, opened/resolved time, resolution note và blocked duration; resolve không tự sửa execution state ngoài rule.
JOB-SRS-021
Should
Worker/Crew Lead
Mobile
Tạm dừng và tiếp tục có lý do
Người chịu trách nhiệm nên có thể tạm dừng/tiếp tục phần thi công khi trạng thái cho phép.
Truy vết BRD: JOB-15 | Use Case: UC-05, UC-06
Pause bắt buộc chọn lý do hoặc liên kết blocker; mỗi mốc lưu thời điểm/actor; không thay thế blocker nếu có cản trở thực sự.
JOB-SRS-022
Must
Worker/Crew Lead/Crew Member được quyền
Mobile
Cập nhật tiến độ, nhật ký và bằng chứng
Người được phép phải cập nhật tiến độ, ghi chú hiện trường và ảnh/tệp bằng chứng cho Work Order.
Truy vết BRD: JOB-14 | Quy tắc: BR-07 | Use Case: UC-05
Tiến độ trong phạm vi hợp lệ; mỗi lần cập nhật có actor/thời điểm; Crew member không được Submit Work Done nếu không phải Crew Lead.
JOB-SRS-023
Must
Điều phối viên/Quản lý
Web
Khai báo vật tư dự kiến
Người có quyền phải khai báo vật tư và số lượng dự kiến phục vụ trực tiếp Work Order.
Truy vết BRD: JOB-16 | Quy tắc: BR-12 | Use Case: UC-03, UC-08
Vật tư là thông tin planning, không phải tồn kho; Worker/Crew Lead xem được trước khi thực hiện; thay đổi quan trọng được audit.
JOB-SRS-024
Must
Worker/Crew Lead/Quản lý
Mobile/Web
Kiểm tra vật tư và yêu cầu bổ sung
Worker/Crew Lead phải ghi nhận mức sẵn sàng vật tư; khi thiếu có thể tạo yêu cầu bổ sung với vật tư, số lượng, ghi chú/bằng chứng; quản lý cập nhật tình trạng xử lý.
Truy vết BRD: JOB-16, JOB-17 | Quy tắc: BR-12 | Use Case: UC-08
Thiếu vật tư không tự động block WO; phải ghi riêng mức ảnh hưởng. Request dùng REQUESTED → ACKNOWLEDGED → IN_PROGRESS → FULFILLED/CANCELLED; không có approval/procurement.
JOB-SRS-025
Must
Assigned Worker/Crew Lead
Mobile
Gửi Work Done
Sau khi hoàn tất phần thi công và dữ liệu bắt buộc, assigned Worker hoặc Crew Lead phải có thể gửi Work Order sang WORK_DONE để chờ quality gate/final inspection.
Truy vết BRD: JOB-18 | Quy tắc: BR-07, BR-15, BR-16 | Use Case: UC-05, UC-07
Chỉ đúng người chịu trách nhiệm được gửi; hệ thống chỉ rõ dữ liệu còn thiếu; Work Done không đồng nghĩa Closed; gửi lặp không tạo tác động trùng.
Thuộc tính
Nội dung
Tổng yêu cầu
7
Phân bố ưu tiên
Must: 4; Should: 3
Mục tiêu
Lập lịch, hiển thị lịch, conflict check, plan-vs-actual và reschedule/return visit ở mức phù hợp đồ án.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
SCH-SRS-001
Must
Điều phối viên
Web
Lập và cập nhật lịch Work Order
Điều phối viên phải thiết lập ngày/giờ bắt đầu, thời lượng dự kiến và hạn hoàn thành.
Truy vết BRD: SCH-01 | Use Case: UC-03
Start < end; thay đổi sau assignment giữ lịch cũ, actor và gửi thông báo.
SCH-SRS-002
Must
Các vai trò liên quan
Web
Xem lịch ngày/tuần/tháng
Web phải hiển thị lịch theo ngày/tuần/tháng theo phạm vi quyền và mở được chi tiết Work Order.
Truy vết BRD: SCH-02 | Use Case: UC-03, UC-09
Lịch phản ánh trạng thái hiện hành; WO hủy/closed được phân biệt; múi giờ nhất quán.
SCH-SRS-003
Must
Worker/Crew Lead
Mobile
Xem lịch Hôm nay và Sắp tới
Mobile phải hiển thị công việc theo thời gian, trạng thái và hành động tiếp theo của Worker/Crew Lead.
Truy vết BRD: SCH-02 | Use Case: UC-05
Đổi lịch/thu hồi/reassign cập nhật sau refresh; không còn assignment thì không hiển thị như đang thực hiện.
SCH-SRS-004
Must
Hệ thống
System
Đối chiếu xung đột lịch
Trước self-accept/direct assign, hệ thống phải so sánh khoảng thời gian WO với assignment đang active của nguồn lực.
Truy vết BRD: SCH-03 | Quy tắc: BR-04 | Use Case: UC-03, UC-04
So sánh theo khoảng thời gian, không chỉ theo ngày; kết quả được dùng trong eligibility.
SCH-SRS-005
Should
Điều phối viên
Web
Cảnh báo quá tải và ghi đè có kiểm soát
Hệ thống nên cảnh báo hoặc chặn khi nguồn lực bị trùng lịch/quá tải theo chính sách cấu hình.
Truy vết BRD: SCH-04 | Use Case: UC-03
Ghi đè nếu được phép phải có quyền/lý do; baseline không tự tối ưu lịch.
SCH-SRS-006
Should
Quản lý dự án
Web
So sánh kế hoạch và thực tế
Hệ thống nên hiển thị planned vs actual start/end để nhận biết bắt đầu muộn, kéo dài hoặc hoàn thành trễ.
Truy vết BRD: SCH-05 | Use Case: UC-09
Sai lệch truy về WO và lịch sử; không tự sửa kế hoạch từ dữ liệu thực tế.
SCH-SRS-007
Should
Điều phối viên
Web
Reschedule / Return Visit
Khi WO chưa hoàn thành và cần tiếp tục ở thời điểm khác, điều phối viên nên cập nhật lịch tiếp theo và lý do mà không mất tiến độ đã ghi.
Truy vết BRD: SCH-05 | Use Case: UC-05, UC-06
Lưu lịch trước/sau, lý do và thông báo; không tạo Work Order mới chỉ để biểu diễn lần quay lại.
Thuộc tính
Nội dung
Tổng yêu cầu
15
Phân bố ưu tiên
Must: 13; Should: 2
Mục tiêu
Quản lý checklist, inspection checkpoint, Hold Point, final inspection, rectification, reinspection và quality gate.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
QUA-SRS-001
Must
Quản trị viên/QC
Web
Tạo mẫu checklist
Người có quyền phải tạo mẫu checklist gồm nhóm tiêu chí, loại câu trả lời, hướng dẫn và cờ bắt buộc/blocking.
Truy vết BRD: QUA-01 | Quy tắc: BR-13 | Use Case: UC-02, UC-07
Mẫu có Nháp/Hoạt động/Ngừng hoạt động; mẫu đã dùng không bị sửa làm thay đổi lịch sử.
QUA-SRS-002
Must
QC/Điều phối viên
Web
Gán checklist và lưu phiên bản áp dụng
Hệ thống phải gán checklist theo work type/dự án/giai đoạn và lưu phiên bản áp dụng cho Work Order.
Truy vết BRD: QUA-02 | Quy tắc: BR-13 | Use Case: UC-03, UC-07
WO biết checklist pre-start và final khi áp dụng; thay đổi mẫu chỉ tác động theo version rule.
QUA-SRS-003
Must
Worker/Crew Lead
Mobile
Thực hiện checklist trước bắt đầu
Người chịu trách nhiệm phải hoàn thành checklist chuẩn bị/an toàn được yêu cầu trước khi Start.
Truy vết BRD: QUA-03 | Quy tắc: BR-13 | Use Case: UC-05
Mục blocking chưa đạt không cho Start; lưu câu trả lời, actor, thời điểm và ảnh khi cấu hình.
QUA-SRS-004
Must
QC/Điều phối viên
Web
Khai báo Inspection Checkpoint
Người có quyền phải khai báo checkpoint theo Work Order/work type với loại PRE_ACTIVITY, HOLD_POINT hoặc FINAL và vị trí/giai đoạn áp dụng.
Truy vết BRD: QUA-04 | Quy tắc: BR-14 | Use Case: UC-03, UC-07
Checkpoint xác định người/role kiểm tra, blocking rule, tiêu chí và trạng thái; thay đổi sau khi đã phát sinh phải audit.
QUA-SRS-005
Must
QC
Web/Mobile
Xem Inspection Queue
QC phải xem hàng đợi inspection trong phạm vi quyền gồm pre-activity, hold point, final inspection và re-inspection.
Truy vết BRD: QUA-04 | Use Case: UC-07
Danh sách có dự án, khu vực, WO, loại checkpoint, người thực hiện, thời điểm yêu cầu và trạng thái.
QUA-SRS-006
Must
QC
Web/Mobile
Thực hiện Pre-activity Inspection
Khi Work Order yêu cầu pre-activity inspection, QC phải ghi kết quả trước khi công việc được Start theo rule.
Truy vết BRD: QUA-04 | Quy tắc: BR-09, BR-14 | Use Case: UC-05, UC-07
Nếu checkpoint blocking chưa pass/release thì readiness không thể thành READY; mọi kết quả lưu actor/thời điểm/bằng chứng.
QUA-SRS-007
Must
QC
Web/Mobile
Xử lý Hold Point
Khi Work Order đạt Hold Point, hệ thống phải ngăn bước thi công bị kiểm soát cho đến khi QC có quyền kiểm tra và release.
Truy vết BRD: QUA-05 | Quy tắc: BR-14 | Use Case: UC-07
Release chỉ khi tiêu chí bắt buộc đạt; fail giữ checkpoint chưa release và có thể tạo rectification; mọi lần release/fail được audit.
QUA-SRS-008
Must
QC
Web/Mobile
Thực hiện Final Inspection
Sau khi Work Order ở WORK_DONE và yêu cầu final inspection, QC phải đánh giá các tiêu chí trước khi quality gate cho phép Closed.
Truy vết BRD: QUA-06 | Quy tắc: BR-15, BR-16 | Use Case: UC-07
Không final-pass khi còn tiêu chí blocking hoặc rectification chưa verified.
QUA-SRS-009
Must
QC
Web/Mobile
Ghi kết quả và bằng chứng Inspection
QC phải ghi kết quả Pass/Fail, nhận xét và ảnh/tệp cho từng lần inspection/checkpoint.
Truy vết BRD: QUA-06 | Use Case: UC-07
Mọi mục bắt buộc có kết quả trước submit; bằng chứng gắn WO, checkpoint/lần kiểm tra, actor và thời điểm; vòng trước không bị ghi đè.
QUA-SRS-010
Must
QC
Web/Mobile
Tạo Rectification Item
Khi inspection không đạt, QC phải tạo hạng mục khắc phục với mô tả lỗi, mức độ, người/Crew chịu trách nhiệm, hạn và bằng chứng khi cần.
Truy vết BRD: QUA-07 | Quy tắc: BR-16 | Use Case: UC-07
Ít nhất một rectification khi kết luận Fail; item có lifecycle riêng; Work Order chưa được Closed.
QUA-SRS-011
Must
Worker/Crew Lead/Crew Member được quyền
Mobile
Nộp kết quả khắc phục
Người được giao phải xem lỗi, cập nhật nội dung đã sửa và nộp bằng chứng khắc phục.
Truy vết BRD: QUA-07 | Use Case: UC-07
Chỉ người/Crew liên quan cập nhật; nộp chuyển item sang chờ reinspection; Crew Lead chịu trách nhiệm submit ở cấp item nếu cấu hình yêu cầu.
QUA-SRS-012
Must
QC
Web/Mobile
Tái kiểm tra
QC phải kiểm tra lại từng rectification đã nộp và xác nhận Verified hoặc Rejected.
Truy vết BRD: QUA-08 | Use Case: UC-07
Mỗi vòng có thời điểm, QC, kết quả và bằng chứng riêng; Rejected quay lại cần khắc phục, không ghi đè vòng trước.
QUA-SRS-013
Must
Hệ thống
System
Quality Gate để đóng Work Order
Hệ thống chỉ cho Work Order chuyển CLOSED khi checklist/checkpoint bắt buộc, final inspection khi yêu cầu và mọi rectification liên quan đều đạt/verified.
Truy vết BRD: QUA-08 | Quy tắc: BR-15, BR-16 | Use Case: UC-07
Work Done không tự đóng; thao tác đóng gửi lặp không tạo hai lần transition; ngoại lệ phải có quyền, lý do và audit.
QUA-SRS-014
Should
QC/Điều phối viên
Web/Mobile
Witness Point
Hệ thống nên hỗ trợ checkpoint Witness Point để ghi việc đã thông báo bên cần chứng kiến, attendance và kết quả theo rule dự án mà không mặc định chặn công việc.
Truy vết BRD: QUA-09 | Use Case: UC-07
Nếu bên chứng kiến không tham dự, khả năng tiếp tục theo chính sách được cấu hình/ghi nhận; baseline không xây portal riêng cho external party.
QUA-SRS-015
Should
QC
Web/Mobile
Conditional Pass
QC nên có thể kết luận Conditional Pass khi phần thi công cơ bản chấp nhận nhưng còn rectification nhỏ cần đóng.
Truy vết BRD: QUA-10 | Quy tắc: BR-16 | Use Case: UC-07
Conditional Pass phải có ít nhất một rectification item; Work Order vẫn chưa CLOSED cho đến khi item được verified.
Thuộc tính
Nội dung
Tổng yêu cầu
8
Phân bố ưu tiên
Must: 7; Should: 1
Mục tiêu
Cung cấp in-app notification, dashboard/drill-down, KPI blocker/quality và audit trail.
Mã / Ưu tiên
Tác nhân
Kênh
Yêu cầu phần mềm
Điều kiện nghiệm thu, quy tắc và ngoại lệ
RPT-SRS-001
Must
Hệ thống
System
Tạo thông báo nghiệp vụ
Hệ thống phải tạo in-app notification cho các sự kiện chính: assignment/self-accept, đổi lịch/thu hồi, blocker, material supplement, inspection/hold point, rectification, reinspection và overdue.
Truy vết BRD: RPT-01 | Quy tắc: BR-20 | Use Case: UC-09
Thông báo đúng người, không tạo trùng khi retry và chứa đối tượng nguồn.
RPT-SRS-002
Must
Người dùng
Web/Mobile
Hộp thông báo
Người dùng phải xem thông báo, số chưa đọc và đánh dấu đã đọc/đã đọc tất cả.
Truy vết BRD: RPT-01 | Quy tắc: BR-20 | Use Case: UC-09
Trạng thái đọc đồng bộ; thao tác inbox không thay đổi đối tượng nghiệp vụ nguồn.
RPT-SRS-003
Must
Người dùng
Web/Mobile
Mở đúng ngữ cảnh từ thông báo
Khi chọn thông báo, hệ thống phải mở đúng Work Order, blocker, inspection, rectification hoặc material supplement liên quan.
Truy vết BRD: RPT-01 | Quy tắc: BR-19, BR-20 | Use Case: UC-09
Kiểm tra lại quyền/trạng thái; không còn quyền thì không lộ dữ liệu.
RPT-SRS-004
Must
Quản lý/Điều phối viên
Web
Dashboard điều hành
Web phải hiển thị chỉ số về unassigned, in-progress, overdue, blocked, work-done-waiting-QC, rectification-open và workload cơ bản.
Truy vết BRD: RPT-02 | Use Case: UC-09
Mỗi chỉ số có định nghĩa, thời điểm cập nhật và tôn trọng phạm vi dự án/quyền.
RPT-SRS-005
Must
Quản lý/QC
Web
KPI nguyên nhân chậm và chất lượng
Hệ thống phải tổng hợp blocker theo reason/duration và chỉ số chất lượng cơ bản như pass/fail, rectification đang mở hoặc quá hạn.
Truy vết BRD: RPT-03 | Quy tắc: BR-11 | Use Case: UC-09
Chỉ số drill-down được tới dữ liệu nguồn; blocker không tự quy trách nhiệm cho Worker nếu responsible party khác.
RPT-SRS-006
Must
Người dùng Dashboard
Web
Drill-down chỉ số
Người dùng phải mở danh sách bản ghi tạo nên chỉ số dashboard với cùng bộ lọc và quyền.
Truy vết BRD: RPT-03 | Use Case: UC-09
Tổng chi tiết đối chiếu được với KPI; bản ghi ngoài quyền không xuất hiện.
RPT-SRS-007
Should
Người có quyền
Web
Xuất dữ liệu cơ bản
Người dùng nên xuất danh sách/report được phê duyệt sang CSV/XLSX hoặc định dạng thống nhất sau khi chốt.
Truy vết BRD: RPT-05 | Use Case: UC-09
Dữ liệu xuất dùng cùng bộ lọc/quyền và giới hạn số dòng; không có report designer tùy biến.
RPT-SRS-008
Must
Hệ thống/Quản trị viên/Quản lý
System/Web
Ghi và tra cứu Audit Trail
Hệ thống phải ghi và cho người có quyền tra cứu thay đổi về tài khoản/quyền, assignment, lịch, readiness, blocker, material, trạng thái và quality decision.
Truy vết BRD: RPT-04 | Quy tắc: BR-18 | Use Case: UC-09
Bản ghi gồm actor, thời điểm, hành động, đối tượng, before/after khi cần và lý do; chỉ đọc, lọc được, không chứa bí mật xác thực.
Mã
Use Case
Tác nhân
Kênh
Mục tiêu
UC-01
Đăng nhập và truy cập theo vai trò
Tất cả người dùng; Quản trị viên
Web/Mobile
Xác thực người dùng và giới hạn chức năng/dữ liệu theo vai trò và dự án.
UC-02
Thiết lập dự án và nguồn lực
Quản trị viên; Quản lý dự án; Điều phối viên
Web
Chuẩn bị Project, Area, Work Type, Worker, Crew, Crew Lead, skill và quyền dự án.
UC-03
Tạo, lập lịch và phân công trực tiếp
Điều phối viên; Worker/Crew Lead; Hệ thống
Web + Mobile
Tạo Work Order hợp lệ, lập lịch và giao cho Worker hoặc Crew phù hợp.
UC-04
Worker tự nhận việc trên Job Board
Worker; Hệ thống
Mobile
Worker đủ điều kiện nhận ngay Work Order còn trống với one-winner concurrency.
UC-05
Pre-start và thực hiện Work Order
Assigned Worker/Crew Lead; Crew Member được quyền; Hệ thống
Mobile
Kiểm tra readiness, Start, cập nhật tiến độ/bằng chứng và Submit Work Done.
UC-06
Ghi nhận và xử lý Blocker
Worker/Crew Lead; Điều phối viên; Quản lý
Mobile + Web
Theo dõi constraint làm ảnh hưởng khả năng bắt đầu/tiếp tục công việc và thời gian bị ảnh hưởng.
UC-07
Inspection, khắc phục và tái kiểm
QC; Worker/Crew; Hệ thống
Web + Mobile
Thực hiện checkpoint/inspection, rectification, reinspection và quality gate.
UC-08
Material Readiness và yêu cầu bổ sung
Worker/Crew Lead; Điều phối viên/Quản lý
Mobile + Web
Ghi vật tư dự kiến, kiểm tra sẵn sàng và theo dõi supplement request mà không làm procurement.
UC-09
Dashboard, thông báo và audit
Quản lý; Điều phối viên; QC; Quản trị viên; Người dùng
Web + Mobile
Theo dõi vận hành, mở đúng ngữ cảnh và truy vết dữ liệu nguồn.
Thuộc tính
Nội dung
Tác nhân
Tất cả người dùng; Quản trị viên
Kênh
Web/Mobile
Mục tiêu
Xác thực người dùng và giới hạn chức năng/dữ liệu theo vai trò và dự án.
Tiền điều kiện
Tài khoản tồn tại và active; người dùng có role hợp lệ.
Luồng chính
1) Nhập thông tin xác thực. 2) Hệ thống kiểm tra tài khoản. 3) Xác định role/project scope. 4) Tạo phiên và hiển thị chức năng phù hợp.
Ngoại lệ
Sai thông tin; tài khoản khóa; phiên hết hạn; truy cập ngoài quyền.
Hậu điều kiện
Phiên hợp lệ được tạo và sự kiện đăng nhập được audit.
Thuộc tính
Nội dung
Tác nhân
Quản trị viên; Quản lý dự án; Điều phối viên
Kênh
Web
Mục tiêu
Chuẩn bị Project, Area, Work Type, Worker, Crew, Crew Lead, skill và quyền dự án.
Tiền điều kiện
Người thao tác có quyền quản trị/project tương ứng.
Luồng chính
1) Tạo Worker/contractor/skill. 2) Tạo Crew, member và Crew Lead. 3) Tạo Project/Area/Work Type. 4) Thêm member dự án. 5) Cấu hình checklist/checkpoint/dữ liệu nền.
Ngoại lệ
Dữ liệu đã dùng chỉ được ngừng hoạt động; Crew thiếu Lead không dùng cho assignment.
Hậu điều kiện
Nguồn lực và dữ liệu dự án ở trạng thái hợp lệ để tạo/điều phối Work Order.
Thuộc tính
Nội dung
Tác nhân
Điều phối viên; Worker/Crew Lead; Hệ thống
Kênh
Web + Mobile
Mục tiêu
Tạo Work Order hợp lệ, lập lịch và giao cho Worker hoặc Crew phù hợp.
Tiền điều kiện
Project active; Work Type và dữ liệu nền hợp lệ.
Luồng chính
1) Coordinator tạo WO nháp. 2) Nhập lịch, dependency, vật tư dự kiến. 3) Hệ thống kiểm tra phát hành. 4) Chọn Worker/Crew. 5) Hệ thống kiểm tra eligibility/lịch. 6) Tạo assignment và thông báo.
Ngoại lệ
Nguồn lực không hợp lệ; Crew không có Lead; conflict; reassign/withdraw phải có lý do.
Hậu điều kiện
WO có assignment ACTIVE và xuất hiện trong My Jobs/lịch.
Thuộc tính
Nội dung
Tác nhân
Worker; Hệ thống
Kênh
Mobile
Mục tiêu
Worker đủ điều kiện nhận ngay Work Order còn trống với one-winner concurrency.
Tiền điều kiện
Worker active, có quyền Job Board; WO OPEN và còn trống.
Luồng chính
1) Worker lọc Job Board. 2) Xem chi tiết. 3) Nhấn Nhận việc. 4) Hệ thống kiểm tra eligibility. 5) Tạo assignment theo one-winner transaction. 6) Cập nhật My Jobs/lịch.
Ngoại lệ
Không đủ điều kiện; nhiều Worker nhận đồng thời; retry do mạng.
Hậu điều kiện
Một assignment SELF_ACCEPT ACTIVE; WO không còn khả dụng cho người khác.
Thuộc tính
Nội dung
Tác nhân
Assigned Worker/Crew Lead; Crew Member được quyền; Hệ thống
Kênh
Mobile
Mục tiêu
Kiểm tra readiness, Start, cập nhật tiến độ/bằng chứng và Submit Work Done.
Tiền điều kiện
Assignment ACTIVE; WO chưa Closed/Cancelled.
Luồng chính
1) Worker/Crew Lead mở My Jobs. 2) Xem checklist/dependency/material/checkpoint. 3) Thực hiện readiness. 4) Nếu READY hoặc allowed-with-constraint thì Start. 5) Cập nhật progress/log/evidence. 6) Submit Work Done khi xong.
Ngoại lệ
NOT_READY; blocker; upload lỗi; assignment bị thu hồi; pause/resume nếu Should được triển khai.
Hậu điều kiện
Execution data được lưu; WO ở WORK_DONE nếu submit hợp lệ, chưa Closed.
Thuộc tính
Nội dung
Tác nhân
Worker/Crew Lead; Điều phối viên; Quản lý
Kênh
Mobile + Web
Mục tiêu
Theo dõi constraint làm ảnh hưởng khả năng bắt đầu/tiếp tục công việc và thời gian bị ảnh hưởng.
Tiền điều kiện
Work Order đang chuẩn bị hoặc thực hiện.
Luồng chính
1) Worker/Crew Lead tạo blocker. 2) Hệ thống thông báo Coordinator/Manager. 3) Người phụ trách acknowledge/resolving. 4) Ghi resolution và resolved. 5) Hệ thống tính duration.
Ngoại lệ
Blocker không blocking chỉ ghi constraint; blocker liên quan material có thể đồng thời sinh supplement request.
Hậu điều kiện
Nguyên nhân, responsible party và thời gian ảnh hưởng được truy vết.
Thuộc tính
Nội dung
Tác nhân
QC; Worker/Crew; Hệ thống
Kênh
Web + Mobile
Mục tiêu
Thực hiện checkpoint/inspection, rectification, reinspection và quality gate.
Tiền điều kiện
QC có quyền; checkpoint/form đúng version được gắn.
Luồng chính
1) QC mở Inspection Queue. 2) Thực hiện pre-activity/hold/final/reinspection. 3) Pass hoặc Fail. 4) Fail tạo rectification. 5) Worker/Crew sửa và submit. 6) QC re-inspect. 7) Hệ thống kiểm tra quality gate và Closed khi đủ điều kiện.
Ngoại lệ
Hold Point chưa release; rectification bị reject; Conditional Pass/Witness chỉ khi Should được triển khai.
Hậu điều kiện
Lịch sử inspection/rectification đầy đủ; Work Order chỉ Closed sau gate.
Thuộc tính
Nội dung
Tác nhân
Worker/Crew Lead; Điều phối viên/Quản lý
Kênh
Mobile + Web
Mục tiêu
Ghi vật tư dự kiến, kiểm tra sẵn sàng và theo dõi supplement request mà không làm procurement.
Tiền điều kiện
WO hợp lệ; planned material có thể được khai báo.
Luồng chính
1) Manager khai báo vật tư dự kiến. 2) Worker/Crew Lead xác nhận actual readiness. 3) Nếu thiếu, tạo supplement request và mức ảnh hưởng. 4) Manager acknowledge/update handling. 5) Fulfilled khi nhu cầu đã đáp ứng.
Ngoại lệ
Thiếu nhưng vẫn làm được; thiếu gây blocker; request bị cancel.
Hậu điều kiện
Material readiness và supplement timeline gắn Work Order; không phát sinh inventory/procurement.
Thuộc tính
Nội dung
Tác nhân
Quản lý; Điều phối viên; QC; Quản trị viên; Người dùng
Kênh
Web + Mobile
Mục tiêu
Theo dõi vận hành, mở đúng ngữ cảnh và truy vết dữ liệu nguồn.
Tiền điều kiện
Người dùng có quyền tương ứng.
Luồng chính
1) Hệ thống tổng hợp KPI. 2) Người dùng drill-down. 3) Mở notification đúng ngữ cảnh. 4) Admin/Manager tra audit theo actor/object/time.
Ngoại lệ
Mất quyền đối tượng; dữ liệu lớn dùng phân trang/lọc; export chỉ khi Should.
Hậu điều kiện
Dữ liệu điều hành/truy vết hiển thị đúng scope và nguồn.
Nhóm
Đối tượng tiêu biểu
Yêu cầu dữ liệu
Tài khoản/quyền
User, Role, Project Membership, Session/Audit
Unique, status rõ, kiểm soát project scope.
Nguồn lực
Worker, Contractor, Crew, Crew Member, Crew Lead, Trade/Skill
Giữ thời gian hiệu lực và dữ liệu cần cho eligibility.
Dự án
Project, Area/Category, Work Type, Dependency, Template, Attachment
Quan hệ toàn vẹn; không mất lịch sử khi inactive/closed.
Work Order
Work Order, Assignment, Schedule, Readiness, Blocker, Progress, Work Log
Lưu assignee type, source, Crew Lead rule, state/timeline.
Vật tư phục vụ WO
Material Reference, Planned Material, Material Readiness, Supplement Request
Không chứa stock, price, supplier, PO/VPO.
Chất lượng
Checklist, Checkpoint, Inspection, Rectification, Reinspection, Evidence
Mỗi vòng độc lập, có version, actor và bằng chứng.
Thông báo/audit
Notification, Read State, Audit Trail
Có source object; audit chỉ đọc và không chứa secret.
Thuộc tính
Yêu cầu
Đầy đủ
Không transition khi thiếu trường/checklist/bằng chứng bắt buộc.
Hợp lệ
Kiểm tra type/range/date/quantity/relation trước lưu.
Nhất quán
Web, Mobile, Dashboard và Detail phản ánh cùng assignee/state.
Duy nhất
Project code, account, active assignment và key danh mục tuân rule unique.
Kịp thời
Sau thao tác thành công, dữ liệu liên quan cập nhật trong baseline NFR.
Truy vết
Quyết định và thay đổi nhạy cảm truy tới actor, time và source object.
Thuộc tính
Baseline
Loại
JPEG, PNG, WebP; tệp tham chiếu bổ sung theo whitelist được phê duyệt.
Kích thước
Tối đa 10 MB/tệp trong baseline, trừ quyết định khác.
Liên kết
Project, Work Order, readiness/blocker, checklist/inspection, rectification hoặc material supplement.
Bảo mật
Chỉ người có quyền source object được xem/tải; URL không bỏ qua authorization.
Phản hồi
Hiển thị upload progress/kết quả; retry không tạo attachment trùng ngoài ý muốn.
Mã / Mức
Thuộc tính
Yêu cầu chất lượng
NFR-PERF-001
Must
Hiệu năng đọc
95% thao tác mở danh sách/chi tiết/lịch phổ biến phản hồi trong 2 giây ở môi trường nghiệm thu và bộ dữ liệu baseline, không tính tải tệp.
NFR-PERF-002
Must
Hiệu năng ghi
95% thao tác tạo/cập nhật thông thường phản hồi trong 3 giây; UI hiển thị processing và ngăn gửi lặp ngoài ý muốn.
NFR-PERF-003
Must
Self-accept đồng thời
Với 20 yêu cầu đồng thời cho cùng Work Order trong test, chỉ một assignment thành công và không có bản ghi trùng.
NFR-PERF-004
Should
Dashboard
Dashboard chính nên tải trong 5 giây với tối thiểu 10.000 Work Order và 50.000 audit/state records trên môi trường benchmark được ghi lại.
NFR-SEC-001
Must
Mã hóa truyền tải
Trao đổi có thông tin xác thực hoặc dữ liệu nghiệp vụ phải dùng kênh mã hóa trong môi trường triển khai.
NFR-SEC-002
Must
Lưu mật khẩu
Mật khẩu không lưu/log ở dạng đọc được; cơ chế lưu dùng password hashing phù hợp và salt.
NFR-SEC-003
Must
Phân quyền Backend
Mỗi thao tác đọc/ghi phải kiểm tra quyền và project scope ở Backend; không tin cậy quyền từ UI.
NFR-SEC-004
Must
Kiểm soát đầu vào
Input được kiểm tra kiểu, độ dài, phạm vi và định dạng; tệp được kiểm tra loại, kích thước và tên an toàn.
NFR-SEC-005
Must
Chống dò đăng nhập
Hệ thống phải giới hạn thử đăng nhập thất bại hoặc áp dụng throttling/lockout theo cấu hình.
NFR-SEC-006
Must
Bảo vệ log/audit
Log không ghi mật khẩu, reset code, access token hoặc bí mật; quyền xem audit giới hạn theo role.
NFR-REL-001
Must
Tính nguyên tử
Self-accept, direct assignment, state transition và quality close phải hoàn tất toàn bộ hoặc không để lại dữ liệu một phần.
NFR-REL-002
Must
Chống gửi lặp
Các thao tác ghi nhạy cảm phải an toàn khi bấm nhiều lần/retry; cùng yêu cầu không tạo nhiều bản ghi nghiệp vụ.
NFR-REL-003
Must
Phục hồi lỗi UI
Khi thao tác thất bại, UI hiển thị kết quả rõ; dữ liệu hợp lệ chưa gửi được giữ ở mức có thể để retry.
NFR-REL-004
Must
Upload retry
Upload ảnh/tệp thất bại phải hiển thị trạng thái, cho phép retry và không tạo attachment trùng ngoài ý muốn.
NFR-REL-005
Should
Sao lưu/khôi phục
Môi trường demo/triển khai nên có backup định kỳ và một kịch bản restore đã được thử trước nghiệm thu.
NFR-USA-001
Must
Luồng Mobile
Sau đăng nhập, Worker phải vào My Jobs/Job Board trong không quá hai hành động điều hướng chính; next action của WO hiển thị rõ.
NFR-USA-002
Must
Lỗi có thể hành động
Lỗi nghiệp vụ phải nêu nguyên nhân và cách xử lý khi xác định được; tránh thông báo chung không hướng dẫn.
NFR-USA-003
Must
Responsive
Web dùng được từ 1366x768; Mobile dùng được từ chiều rộng 360px mà không mất hành động chính.
NFR-USA-004
Must
Khả năng truy cập cơ bản
Chức năng chính có nhãn rõ; trạng thái không chỉ thể hiện bằng màu; Web hỗ trợ keyboard cho form/action chính.
NFR-CMP-001
Must
Trình duyệt Web
Web hỗ trợ hai phiên bản ổn định gần nhất của Chrome và Edge; các luồng chính được smoke-test trên Firefox.
NFR-CMP-002
TBD
Nền tảng Mobile
Nhóm phải chốt Android-only hay Android+iOS trước thiết kế phát hành; baseline kỹ thuật đề xuất Android 10+.
NFR-MNT-001
Must
Khả năng kiểm thử
Business rule eligibility, dependency/readiness gate, one-winner, blocker duration và quality gate phải có unit/integration test phù hợp.
NFR-MNT-002
Must
Logging/correlation
Lỗi hệ thống và thao tác quan trọng phải có mã correlation/request để đối chiếu giữa phản hồi, server log và audit.
NFR-MNT-003
Must
Cấu hình môi trường
Secret và cấu hình môi trường tách khỏi source/public docs; có hướng dẫn cấu hình cho môi trường demo.
Mã
Tiêu chí nghiệm thu
AC-01
Đăng nhập đúng role/project scope; truy cập ngoài quyền bị từ chối.
AC-02
Tạo được Project, Worker, Crew, Crew Lead, Work Type và dữ liệu nền hợp lệ.
AC-03
Điều phối viên tạo/lập lịch Work Order và phân công trực tiếp cho Worker hoặc Crew.
AC-04
Assignment Crew chỉ Crew Lead có quyền Submit Work Done; Crew member khác không thể thực hiện thao tác này.
AC-05
Worker đủ điều kiện self-accept trên Job Board và được xác nhận ngay; không cần quản lý duyệt lại.
AC-06
Hai Worker nhận đồng thời không tạo hai assignment active.
AC-07
Worker không đủ skill, ngoài dự án hoặc trùng lịch bị từ chối với lý do cụ thể.
AC-08
Dependency bắt buộc chưa đạt làm Work Order NOT_READY và không Start.
AC-09
Pre-start cho kết quả READY / READY_WITH_CONSTRAINT / NOT_READY đúng rule và chặn/cho Start tương ứng.
AC-10
Worker/Crew Lead tạo blocker; coordinator xử lý; hệ thống lưu reason, responsible party và blocked duration.
AC-11
Thiếu vật tư có thể tạo supplement request nhưng không tự block Work Order nếu được đánh dấu vẫn có thể thi công.
AC-12
Hold Point chưa release không cho tiếp tục bước bị kiểm soát.
AC-13
Worker/Crew Lead cập nhật tiến độ, nhật ký, ảnh và Submit Work Done; Work Order chưa Closed ở thời điểm submit.
AC-14
QC Fail tạo rectification; người thực hiện nộp bằng chứng; QC re-inspect và lưu các vòng riêng.
AC-15
Work Order chỉ Closed khi quality gate đạt và không còn rectification bắt buộc mở.
AC-16
Thông báo mở đúng Work Order/blocker/inspection và vẫn kiểm tra quyền.
AC-17
Dashboard drill-down khớp dữ liệu nguồn và hiển thị blocked/quality metrics theo quyền.
AC-18
Audit hiển thị actor, thời điểm, hành động, before/after hoặc lý do cho thay đổi nhạy cảm.
Nhóm
Phạm vi
Unit Test
Eligibility, dependency/readiness gate, blocker duration, state transition, quality gate.
Integration Test
Login/permission, direct assign, self-accept, Work Done, blocker, material, inspection, audit.
Concurrency Test
Nhiều Worker self-accept cùng WO; retry Submit Work Done; duplicate transition.
Security Test
ID tampering, project-scope bypass, role bypass, invalid input/file.
Usability Test
Manager/Coordinator/Worker/Crew Lead/QC hoàn thành kịch bản chính trên đúng kênh.
Performance Test
Các baseline NFR-PERF trên môi trường benchmark được ghi nhận.
Backup/Restore Test
Thực hiện nếu NFR-REL-005 Should được đưa vào phạm vi phát hành.
Module
Use Case
Business Rule chính
IAM / IAM-01..05
UC-01
BR-18, BR-19, BR-20
ORG / ORG-01..05
UC-02, UC-03, UC-04
BR-03, BR-04, BR-06, BR-07
PRJ / PRJ-01..06
UC-02, UC-03, UC-05
BR-08, BR-13, BR-14, BR-19
JOB / JOB-01..18
UC-03, UC-04, UC-05, UC-06, UC-08
BR-01..12, BR-15, BR-17
SCH / SCH-01..05
UC-03, UC-04, UC-05, UC-09
BR-04, BR-21
QUA / QUA-01..10
UC-05, UC-07
BR-13..16
RPT / RPT-01..05
UC-09
BR-11, BR-18..20
Nghiệp vụ
Yêu cầu trọng tâm
Kiểm thử chính
Self-accept
JOB-SRS-005..009; SCH-SRS-004; NFR-PERF-003; NFR-REL-001..002
Eligibility; one-winner; retry; cập nhật My Jobs.
Crew assignment
ORG-SRS-006..009; JOB-SRS-010..012,025
Crew active; Lead active; quyền Submit Work Done.
Dependency/Readiness
PRJ-SRS-010; JOB-SRS-017..018; QUA-SRS-003,006
Dependency gate; READY/NOT_READY; blocking checklist/pre-activity.
Blocker
JOB-SRS-019..020; RPT-SRS-001,004..005,008
Reason; owner; duration; resolve; KPI.
Material
JOB-SRS-023..024
Planned; readiness; supplement; shortage không tự block.
Quality/Hold
QUA-SRS-004..013
Checkpoint; Hold release; fail; rectification; reinspection; close gate.
Audit
IAM-SRS-008; RPT-SRS-008
Actor/time/action/object/before-after; immutable.
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
IAM-01
IAM-SRS-001, IAM-SRS-002
UC-01
AC-01
IAM-02
IAM-SRS-007
UC-01
-
IAM-03
IAM-SRS-003
UC-01
-
IAM-04
IAM-SRS-004, IAM-SRS-008
UC-01, UC-09
AC-01, AC-16
IAM-05
IAM-SRS-005, IAM-SRS-006, PRJ-SRS-006
UC-01, UC-02, UC-09
AC-01
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
ORG-01
ORG-SRS-001, ORG-SRS-002
UC-02
AC-02
ORG-02
ORG-SRS-003
UC-02, UC-03, UC-04
AC-02
ORG-03
ORG-SRS-006, ORG-SRS-007, ORG-SRS-008
UC-02, UC-03, UC-05
AC-02, AC-03, AC-05
ORG-04
ORG-SRS-004
UC-02, UC-03
AC-02
ORG-05
ORG-SRS-005, ORG-SRS-009
UC-02, UC-03, UC-04
AC-03, AC-04
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
PRJ-01
PRJ-SRS-001, PRJ-SRS-002, PRJ-SRS-007
UC-02
AC-02
PRJ-02
PRJ-SRS-003
UC-02, UC-03
AC-02
PRJ-03
PRJ-SRS-004
UC-02, UC-03
AC-02
PRJ-04
PRJ-SRS-005, PRJ-SRS-006
UC-02
AC-01, AC-02
PRJ-05
PRJ-SRS-010
UC-03, UC-05
AC-06
PRJ-06
PRJ-SRS-008, PRJ-SRS-009
UC-02, UC-03, UC-05
AC-17
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
JOB-01
JOB-SRS-001, JOB-SRS-003
UC-03
AC-17
JOB-02
JOB-SRS-002
UC-03
AC-03, AC-04
JOB-03
JOB-SRS-004
UC-04
AC-04
JOB-04
JOB-SRS-005, JOB-SRS-006, JOB-SRS-007
UC-04
AC-04
JOB-05
JOB-SRS-008, JOB-SRS-009
UC-03, UC-04
AC-04
JOB-06
JOB-SRS-010
UC-03
AC-03
JOB-07
JOB-SRS-011
UC-03, UC-05
AC-03, AC-05
JOB-08
JOB-SRS-012
UC-03
AC-16
JOB-09
JOB-SRS-013
UC-03
-
JOB-10
JOB-SRS-014
UC-03, UC-05
AC-16
JOB-11
JOB-SRS-015, JOB-SRS-016
UC-05
AC-17
JOB-12
JOB-SRS-017, JOB-SRS-018
UC-05
AC-06, AC-07
JOB-13
JOB-SRS-019, JOB-SRS-020
UC-06
AC-08
JOB-14
JOB-SRS-022
UC-05
AC-10
JOB-15
JOB-SRS-021
UC-05, UC-06
-
JOB-16
JOB-SRS-023, JOB-SRS-024
UC-03, UC-05, UC-08
AC-09
JOB-17
JOB-SRS-024
UC-08
AC-09
JOB-18
JOB-SRS-025
UC-05, UC-07
AC-05, AC-13
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
SCH-01
SCH-SRS-001
UC-03, UC-05
AC-03, AC-17
SCH-02
SCH-SRS-002, SCH-SRS-003
UC-03, UC-05, UC-09
AC-17
SCH-03
SCH-SRS-004
UC-03, UC-04
AC-03, AC-04
SCH-04
SCH-SRS-005
UC-03, UC-04
-
SCH-05
SCH-SRS-006, SCH-SRS-007
UC-05, UC-09
AC-15
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
QUA-01
QUA-SRS-001
UC-02, UC-07
AC-12, AC-17
QUA-02
QUA-SRS-002
UC-02, UC-07
AC-12, AC-17
QUA-03
QUA-SRS-003
UC-05
AC-07
QUA-04
QUA-SRS-004, QUA-SRS-005, QUA-SRS-006
UC-05, UC-07
AC-11, AC-12
QUA-05
QUA-SRS-007
UC-07
AC-11
QUA-06
QUA-SRS-008, QUA-SRS-009
UC-07
AC-12, AC-13
QUA-07
QUA-SRS-010, QUA-SRS-011
UC-07
AC-12
QUA-08
QUA-SRS-012, QUA-SRS-013
UC-07
AC-12, AC-13
QUA-09
QUA-SRS-014
UC-07
-
QUA-10
QUA-SRS-015
UC-07
-
BRD
Yêu cầu SRS
Use Case
Nghiệm thu
RPT-01
RPT-SRS-001, RPT-SRS-002, RPT-SRS-003
UC-03–UC-09
AC-14
RPT-02
RPT-SRS-004
UC-09
AC-15
RPT-03
RPT-SRS-005, RPT-SRS-006
UC-09
AC-15
RPT-04
IAM-SRS-008, RPT-SRS-008
UC-09
AC-16
RPT-05
RPT-SRS-007
UC-09
-
Mã
Quyết định
Q-01
Giữ riêng vai trò Quản lý dự án và Điều phối viên hay gộp ở phiên bản đầu?
Q-02
Direct assignment có bắt buộc Worker/Crew Lead Accept/Reject hay có hiệu lực ngay?
Q-03
Giới hạn việc đồng thời của Worker được tính theo số lượng, thời gian hay không áp dụng trong baseline?
Q-04
Xung đột lịch là hard-block hay cho phép Coordinator override có lý do?
Q-05
Crew member ngoài Crew Lead được cập nhật những loại dữ liệu nào: progress, log, photo, rectification?
Q-06
Khi Crew Lead đổi giữa Work Order, quyền Submit Work Done dùng current Lead hay Lead snapshot theo assignment?
Q-07
Dependency có hỗ trợ loại advisory hay baseline chỉ có hard dependency?
Q-08
Những readiness item nào mặc định blocking và ai có quyền override?
Q-09
Ai có quyền resolve blocker và responsible party có cần bắt buộc hay không?
Q-10
Ai có quyền release Hold Point: QC nội bộ, Project Manager hay cấu hình theo work type?
Q-11
Witness Point và Conditional Pass có được cam kết ở bản bảo vệ hay chỉ Should/backlog?
Q-12
Progress dự án dùng số Work Order hay có trọng số theo thời lượng/khối lượng?
Q-13
Định dạng export: CSV, XLSX hay cả hai?
Q-14
Mobile baseline là Android hay cần cả iOS?
Q-15
Thời gian lưu audit, ảnh và attachment trong môi trường demo/triển khai là bao lâu?
Kiểm soát phình to phạm vi
Yêu cầu mới không tự động trở thành Must. Witness Point và Conditional Pass là Should; Formal NCR/CAPA, RFI/Submittal đầy đủ, inventory/procurement và client portal không thuộc baseline SRS V2.1.
Thuật ngữ
Định nghĩa
Work Order
Đơn vị công việc thi công được quản lý xuyên suốt từ planning/dispatch đến execution, quality gate và Closed.
Worker
Cá nhân trực tiếp thực hiện công việc tại hiện trường.
Crew
Tổ/đội gồm nhiều Worker; được dùng như một nguồn lực cho direct assignment.
Crew Lead
Worker đại diện Crew và chịu trách nhiệm các thao tác xác nhận ở cấp Work Order theo rule.
Assignment
Quan hệ active xác định Work Order đang được giao cho Worker hoặc Crew.
Job Board
Danh sách Work Order còn trống được mở để Worker đủ điều kiện tự nhận.
Eligibility
Tập điều kiện về trạng thái, quyền, skill, lịch và giới hạn dùng cho self-accept/direct assignment.
Dependency
Quan hệ Work Order tiền nhiệm phải đạt điều kiện trước khi Work Order phụ thuộc có thể sẵn sàng.
Readiness
Kết quả pre-start: READY, READY_WITH_CONSTRAINT hoặc NOT_READY.
Blocker/Constraint
Vướng mắc có thể ngăn hoặc ảnh hưởng việc bắt đầu/tiếp tục Work Order; có reason, owner và duration.
Work Done
Phần thi công đã được Worker/Crew Lead xác nhận xong; chưa đồng nghĩa Work Order Closed.
Hold Point
Checkpoint bắt buộc được QC release trước khi bước thi công bị kiểm soát được tiếp tục.
Rectification
Hạng mục khắc phục phát sinh từ inspection không đạt/conditional pass.
Material Supplement Request
Yêu cầu bổ sung vật tư gắn với Work Order; không phải purchase requisition/procurement approval.
Inspection Checkpoint
Điểm kiểm tra được cấu hình theo giai đoạn thi công; có thể là Pre-activity, Hold Point, Final hoặc Witness (Should).
Conditional Pass
Kết quả kiểm tra Should: cơ bản chấp nhận nhưng còn rectification phải đóng trước Work Order Closed.
Audit Trail
Bản ghi chỉ đọc dùng truy vết actor, thời điểm, hành động, source object và thay đổi quan trọng.
Nhóm
Tổng
Must
Should
Tài khoản và phân quyền
8
7
1
Tổ chức và nguồn lực
9
9
0
Dự án và dữ liệu nền
10
8
2
Work Order và điều phối/thực hiện
25
22
3
Lịch và tiến độ
7
4
3
Checklist và kiểm soát chất lượng
15
13
2
Thông báo, báo cáo và audit
8
7
1
Tổng yêu cầu chức năng
82
70
12
