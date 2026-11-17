# Báo cáo chất lượng – v0.1.0 (Đợt 6)

Ngày đo: 17/11/2026 · nhánh `test/fe-e2e-polish` · Windows 10, Node 26.13, Chrome bản cài sẵn (Playwright 1.65, channel `chrome`).

## 1. Kết quả kiểm thử

`npm run test:all` = lint → Vitest → build → Playwright. Chạy 2 lần liên tiếp sau lần sửa cuối, cả hai đều đạt.

| Lần chạy | Lint | Vitest | Build | Playwright | Tổng thời gian |
|---|---|---|---|---|---|
| 1 | đạt | 674 đạt · 6 bỏ qua · 10 todo (39 file, 2,9 s) | đạt (0,5 s) | **98/98 đạt** (3,8 phút) | 249,8 s |
| 2 | đạt | 674 đạt · 6 bỏ qua · 10 todo (39 file, 2,8 s) | đạt (0,5 s) | **98/98 đạt** (3,9 phút) | 251,5 s |

- 6 test Vitest bị bỏ qua là các test "lệch tài liệu" có chủ đích (bật bằng `VITE_TC_DEVIATIONS=1`), 10 todo là test case
  chưa viết ở [coverage.md](test-cases/coverage.md); không thay đổi trong đợt này.
- Vitest tăng từ 651 lên 674: thêm `src/config/contrast.test.ts` (18) và `src/lib/format.test.ts` (5).
- Playwright: 49 test × 2 khung (1440×900, 1366×768) = 98, `retries: 0`, 2 worker.
- Trước 2 lần trên có một lần chạy trượt 1 test (`a11y-keyboard`, khung 1366): phím gõ tới trước khi danh sách Loại lệnh
  nhận focus. Đã sửa test chờ đúng mục được focus; chạy lặp 10 lần đều đạt. Không còn test lúc đạt lúc trượt đã biết.

### Playwright theo file

| Spec | Số test (mỗi khung) | Nội dung |
|---|---|---|
| `auth` | 5 | 3 vai trò đăng nhập; chưa đăng nhập → `/login`; CUSTOMER vào Vận hành, Cấu hình → `/403` |
| `trung-tam` | 5 | 4 KPI là số; mở chi tiết từ "Lệnh cần chú ý" bằng chuột và Enter; đánh dấu đã đọc |
| `dat-lenh` | 6 | Iceberg hợp lệ có trong Sổ lệnh; sai bước giá, sai lô 100, vượt trần, dưới sàn báo lỗi tiếng Việt; mẫu chiến lược điền sẵn và sửa được |
| `so-lenh` | 3 | ATO và ATC khóa Sửa/Hủy kèm lý do; phiên liên tục Tạm dừng → Tiếp tục → Hủy |
| `chi-tiet` | 2 | Timeline lệnh con, bảng khớp, thẻ Hiệu quả; ExplainCard của lệnh PAUSED_SYSTEM |
| `hunt` | 1 | Khung quét ≤ 3 mức, mọi mức quét và mọi lần khớp ≤ giá tối đa, mức vượt ghi "Vượt giới hạn giá" |
| `bao-cao` | 3 | Lọc, sắp xếp tăng/giảm, CSV có BOM, dấu `;`, đúng số dòng của bảng |
| `van-hanh` | 3 | Mất ACK → UNKNOWN → đối soát; kill switch 2 bước; maker-checker hai người |
| `demo` | 2 | 6 kịch bản ở x4, mọi điều kiện ĐẠT; thoát Demo (cuối kịch bản và giữa chừng) khôi phục dữ liệu |
| `search-tour` | 2 | Ctrl+K "hpg" ra lệnh và mã; tour hiện lần đầu, bỏ qua thì không hiện lại |
| `a11y-keyboard` | 1 | Đặt lệnh chỉ bằng Tab/Enter/Esc, mọi điểm dừng có viền focus nhìn thấy |
| `layout` | 5 | Thanh bên thu gọn dùng được và nhớ; bảng cuộn trong khung riêng; khung Demo không che phần tử cuối; ≤1280px tự thu gọn; breadcrumb không bị cắt |
| `states` | 8 | ErrorState có "Thử lại" ở 5 màn; LoadingState; EmptyState có hướng dẫn và nút |
| `console` | 3 | Mỗi vai trò mở mọi route (kể cả chi tiết lệnh, 404, 403): 0 lỗi console, 0 request lỗi, không tràn ngang, mọi nút/link có tên |

`screenshots.spec.ts` không nằm trong `test:e2e`; chạy riêng bằng `npm run screenshots`.

Ngoài ra, mọi test đều tự trượt nếu có lỗi console hoặc request lỗi ngoài dự kiến (fixture chung `e2e/fixtures.ts`).

## 2. Kích thước bundle (`npm run build`)

Tổng 53 file JS: 1.813 kB, khoảng 588 kB gzip; CSS 73,0 kB (13,0 kB gzip). Mỗi trang là một chunk lazy riêng (đã kiểm
`src/routes/routeConfig.tsx`).

| Chunk | Kích thước | gzip | Ghi chú |
|---|---|---|---|
| `index` | 468,3 kB | 149,2 kB | React, router, React Query, Radix, khung ứng dụng |
| `browser` | 402,1 kB | 154,5 kB | MSW + engine giả lập + dữ liệu mẫu; chỉ tải khi chạy với API giả lập |
| `CartesianChart` | 352,1 kB | 102,4 kB | Recharts, chỉ tải ở Chi tiết lệnh và Báo cáo |
| `zod` | 88,1 kB | 25,0 kB | Kiểm tra form và API giả lập |
| `OrderDetail` | 50,4 kB | 15,4 kB | Trang Chi tiết lệnh |
| `NumberInput` | 42,0 kB | 14,6 kB | Dùng chung các form |
| `ExecutionReport` | 36,7 kB | 12,3 kB | Trang Báo cáo |
| `controller` | 34,1 kB | 10,7 kB | Chế độ Demo, chỉ tải với vai trò được dùng Demo |
| Các trang còn lại | 3–23 kB mỗi trang | 1,5–7,3 kB | PlaceOrder 16,1 kB, Operations 15,5 kB, StrategyConfig 23,1 kB… |

Cờ test e2e (`src/testing/e2eHooks.ts`, handler làm lỗi API) nằm sau `import.meta.env.DEV` nên không có trong bản build
(đã kiểm bằng cách tìm chuỗi của chúng trong `dist/`).

## 3. Lỗi đã sửa trong đợt này

| # | Vấn đề | Phát hiện bởi | Sửa |
|---|---|---|---|
| 1 | Mức giá của sổ lệnh 3 mức nhận focus nhưng không có viền; dòng bảng bấm được (Lệnh cần chú ý, Báo cáo) cũng vậy | `a11y-keyboard` (mức giá), rà thêm (dòng bảng) | Viền focus 2px cho mức giá và `TableRow` |
| 2 | Màn Đặt lệnh không có tiêu đề h1 | `console` | Thêm h1 "Đặt lệnh nâng cao" |
| 3 | Chữ phụ mờ 60% (mục "Sắp có", ô trống sổ lệnh) ≈ 3,7:1 trên nền thẻ | Tính tương phản | Nâng lên 80% (≈ 5,5:1); test `contrast.test.ts` |
| 4 | Chuỗi tiếng Anh: "Cấu hình strategy", "Child/Parent" ở màn Vận hành, "Close" của hộp thoại | Rà chuỗi | Dịch sang tiếng Việt; nút X là "Đóng hộp thoại" để khác nút "Đóng" |
| 5 | Giờ thông báo dạng ISO "2026-11-16 09:10:00" | Rà định dạng | Dùng `formatDateTime` → "16/11 09:10:00" |
| 6 | Breadcrumb bị cắt ("Trung tâm…") ở 1366–1440px | Ảnh chụp 1440×900, `layout` | Dưới 1600px chỉ hiện tên màn hiện tại; thu gọn nút tìm và nhãn dữ liệu demo |
| 7 | Không tự thu gọn thanh bên ở màn ≤ 1280px | Yêu cầu Đợt 6 | `useMediaQuery`; mở tạm ở màn hẹp không ghi đè lựa chọn đã lưu |
| 8 | Thiếu nút "Thử lại" ở Vận hành, Lịch sử cấu hình, Đăng nhập, Sửa giá | Rà trạng thái | Thêm `onRetry` |
| 9 | EmptyState chỉ có một câu, không có bước tiếp theo; Sổ lệnh trống chỉ ghi "Không có lệnh nào phù hợp" | Rà trạng thái | Câu hướng dẫn + nút ("Đặt lệnh mới", "Bỏ lọc", "Xóa từ khóa"…); Sổ lệnh phân biệt chưa có lệnh và lọc không ra |
| 10 | Sổ lệnh vẽ lại toàn bộ bảng mỗi nhịp giá | Đo số lần vẽ | Dòng `memo`, chỉ theo dõi giá của đúng mã; 33,8 → 13,0 lần vẽ dòng mỗi nhịp (13 lệnh, dev + StrictMode) |
| 11 | Handler làm lỗi API của e2e lọt vào bản build | Tìm chuỗi trong `dist/` | Bọc bằng `import.meta.env.DEV` |

## 4. Việc còn tồn

- **Sau khi thoát Demo**, Sổ lệnh có thể còn hiện dữ liệu kịch bản khoảng một nhịp làm mới (~1 giây) trước khi tải lại
  dữ liệu của người dùng: controller dùng `invalidateQueries` (giữ dữ liệu cũ khi tải lại). Test Demo chờ dữ liệu khôi
  phục nên vẫn đạt; muốn hết hẳn thì đổi sang `resetQueries` (sẽ hiện "Đang tải" thay vì dữ liệu cũ).
- **Chi tiết lệnh** theo dõi giá của mã đang xem nên vẽ lại cả trang khi mã đó có giá mới. Chưa gây chậm (bảng nhỏ);
  có thể tách nhỏ như Sổ lệnh nếu lệnh có rất nhiều lệnh con.
- **Làm mờ có chủ đích** dưới 4,5:1: các bước HUNT chưa tới trong lúc "Xem lại" (30%) và mức giá sổ lệnh bị làm mờ (60%).
  Đây là hiệu ứng tạm thời, nội dung vẫn đọc được ở trạng thái thường.
- **Dấu âm** dùng dấu gạch ngang "-" (U+002D, theo `Intl.NumberFormat('vi-VN')`), chưa đổi sang dấu trừ "−" (U+2212) vì
  CSV và nhiều test đang khớp theo "-".
- **Ngày giờ trong bảng** (lệnh con, khớp, nhật ký) dùng dạng rút gọn `dd/MM HH:mm:ss` (bỏ năm); ngày đầy đủ
  `dd/MM/yyyy` dùng ở tiêu đề và thông tin lệnh.
- Thuật ngữ nghiệp vụ giữ tiếng Anh có chủ đích (Iceberg, TWAP, VWAP, arrival, slippage, kill switch, mã trạng thái như
  UNKNOWN): đều có tooltip giải thích tiếng Việt.
- `npm audit` báo một số cảnh báo ở thư viện; chưa xử lý trong đợt này (không thêm hay nâng gói nào ngoài `@playwright/test`).
- Vite báo `advancedChunks` sắp bị bỏ, nên đổi sang `codeSplitting` ở đợt sau.
