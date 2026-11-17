# Changelog

Ghi các thay đổi đáng chú ý của frontend OMS Algo theo từng đợt phát triển. Định dạng theo
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).
Bản 0.x là bản demo chạy với dữ liệu giả lập, chưa có backend.

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
