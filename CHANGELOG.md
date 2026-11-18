# Changelog

Ghi các thay đổi đáng chú ý của frontend OMS Algo theo từng đợt phát triển. Định dạng theo
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).
Bản 0.x là bản demo chạy với dữ liệu giả lập, chưa có backend.

## [0.1.1] – 2026-11-18 · Đợt 7: Lịch sử và đối soát

### Thêm
- Màn `/bao-cao/lich-su` (mục "Lịch sử và đối soát" trên thanh bên đã mở khóa, mọi vai trò), 3 tab nhớ trên URL:
  - **Lịch sử lệnh**: lệnh đã kết thúc và lệnh nhiều phiên đang chạy theo ngày; lọc Hôm nay / 5 phiên / tùy chọn, mã,
    chiến lược, chiều, trạng thái, tài khoản; sắp xếp, 50 dòng mỗi trang, dòng tổng, xuất CSV đúng bộ lọc.
  - **Nhật ký kiểm toán**: mọi OrderEvent, chỉ đọc, lọc theo hành động, người, mã lệnh, thời gian, tìm không dấu, xuất CSV.
    Khách hàng thấy "Người dùng khác" thay cho user_id của người khác.
  - **Đối soát** (DEALER, OPS): so OMS với Core theo từng lệnh con (STATUS_MISMATCH, QTY_MISMATCH, UNKNOWN_OPEN,
    UNKNOWN_RESOLVED, DUP_FILL_IGNORED, PARENT_SUM_MISMATCH, OVERFILL), 4 thẻ, "Đối soát ngay"; vận hành đánh dấu đã xử lý
    có ghi chú và duyệt theo maker-checker.
- Engine giả lập có sổ phía Core; lệnh mẫu đủ 5 phiên gần nhất, có sẵn ít nhất một chênh lệch mỗi loại (trừ OVERFILL).
- Trung tâm lệnh: liên kết "Xem đối soát" khi có chênh lệch đang mở. Ctrl+K: "Mở nhật ký kiểm toán", "Đối soát ngay".
- Thuật ngữ: STATUS_MISMATCH, QTY_MISMATCH, DUP_FILL_IGNORED, PARENT_SUM_MISMATCH, OVERFILL, Nhật ký kiểm toán.
- Test: `reconcile` (mỗi loại, khớp hoàn toàn = 0, khớp trùng bỏ qua đúng 1 lần, OVERFILL = 0 với 6 kịch bản Demo),
  lịch sử, nhật ký, phân quyền; Playwright `lich-su.spec`. Ảnh [docs/screenshots/dot7/](docs/screenshots/dot7/).

### Sửa
- Lệnh mẫu "hôm qua" lấy phiên giao dịch liền trước thay vì ngày lịch (trước đây mở app thứ Hai thì có phiên Chủ nhật).

## [0.1.0] – 2026-11-17 · Đợt 6: Chất lượng và hoàn thiện

Không thêm tính năng nghiệp vụ. Chi tiết số liệu ở [docs/quality-report.md](docs/quality-report.md).

### Thêm
- Kiểm thử giao diện tự động bằng Playwright (`npm run test:e2e`, `test:e2e:ui`, `test:all`), chạy trên Chrome/Edge có
  sẵn ở 2 khung 1440×900 và 1366×768; đồng hồ giả lập và seed cố định để kết quả lặp lại.
- Spec cho đăng nhập và phân quyền, Trung tâm lệnh, Đặt lệnh, Sổ lệnh, Chi tiết lệnh, HUNT, Báo cáo + CSV, Vận hành,
  Chế độ Demo, Tìm nhanh và tour, thao tác chỉ bằng bàn phím, bố cục, trạng thái tải/trống/lỗi, quét lỗi console mọi route.
- Cờ chỉ dùng khi test (`?e2e=1&seed=…&fail=…&delay=…`), không có trong bản build.
- [docs/quality-report.md](docs/quality-report.md), [docs/demo-checklist.md](docs/demo-checklist.md), bộ ảnh
  [docs/screenshots/v0.1.0/](docs/screenshots/v0.1.0/).

### Sửa
- Thanh bên tự thu gọn ở màn ≤1280px; breadcrumb không còn bị cắt ở 1366–1440px.
- Mọi màn có dữ liệu đều có nút "Thử lại" khi lỗi; trạng thái trống có câu hướng dẫn và nút hành động
  (vd "Chưa có lệnh nào · Đặt lệnh mới", "Bỏ lọc").
- Truy cập: viền focus rõ cho dòng bảng và mức giá sổ lệnh; màn Đặt lệnh có tiêu đề h1; chữ phụ mờ 60% (≈3,7:1) nâng
  lên 80% (≈5,5:1); nút X của hộp thoại đọc là "Đóng hộp thoại".
- Bỏ chữ tiếng Anh còn sót ("Cấu hình strategy", "Child/Parent", "Close"); giờ thông báo theo dạng dd/MM HH:mm:ss.
- Sổ lệnh không còn vẽ lại toàn bộ bảng mỗi nhịp giá (33,8 → 13,0 lần vẽ dòng mỗi nhịp, đo ở chế độ dev).

## [0.0.5] – 2026-11-16 · Đợt 5: Giải thích, thuật ngữ, tìm nhanh, tour

### Thêm
- Thẻ "Vì sao lệnh này…" ở Chi tiết lệnh, giải thích theo quy tắc cho lệnh dừng, bị từ chối, chưa rõ, chờ kích hoạt…;
  câu rút gọn khi rê chuột vào badge trạng thái ở Sổ lệnh và Trung tâm lệnh.
- Tooltip thuật ngữ có công thức và ví dụ bằng số; trang `/thuat-ngu`.
- Tìm nhanh Ctrl+K (lệnh, mã, màn hình, thao tác, thuật ngữ; gõ không dấu).
- Tour 5 bước lần đầu cho từng vai trò.

## [0.0.4] – 2026-11-13 · Đợt 4: Sổ lệnh 3 mức, HUNT quét, mẫu chiến lược

### Thêm
- Sổ lệnh 3 mức mua/bán ở Đặt lệnh (bấm để điền giá) và Chi tiết lệnh.
- HUNT quét từng mức giá, không vượt giá tối đa; khung quét từng bước và "Xem lại".
- 6 mẫu chiến lược một chạm, trang `/mau-chien-luoc`.

## [0.0.3] – 2026-11-12 · Đợt 3: Chế độ Demo

### Thêm
- 6 kịch bản E2E tự chạy có chú thích, tô sáng, điều kiện kiểm tra và hộp kết quả; dữ liệu riêng, thoát thì khôi phục.

## [0.0.2] – 2026-11-11 · Đợt 2: Báo cáo hiệu quả thực hiện

### Thêm
- Báo cáo `/bao-cao/hieu-qua`: so giá bình quân với arrival và VWAP, tỷ lệ tham gia, biểu đồ theo chiến lược, xuất CSV.
- Thẻ "Hiệu quả" ở Chi tiết lệnh.

## [0.0.1] – 2026-11-10 · Đợt 1: Khung ứng dụng và Trung tâm lệnh

### Thêm
- Trang giới thiệu + đăng nhập gộp; khung ứng dụng có thanh bên theo vai trò và thanh trên.
- Trung tâm lệnh: 4 KPI, lệnh cần chú ý, hoạt động gần nhất.
- Trung tâm thông báo có số chưa đọc.

## [0.0.0] – 2026-11-06 → 2026-11-09 · Nền tảng (trước Đợt 1)

### Thêm
- 5 màn nghiệp vụ: Đặt lệnh nâng cao (kiểm luật HOSE), Sổ lệnh, Chi tiết lệnh, Giám sát hệ thống (bơm lỗi, kill switch),
  Cấu hình chiến lược (maker-checker).
- Engine giả lập sinh lệnh con, khớp, ATO/ATC, đối soát; API giả lập bằng MSW.
- Bộ test case E2E và bảng phủ test.

[0.1.0]: https://github.com/tonypham-hp/OMS_Algo/compare/main...test/fe-e2e-polish
