# OMS Algo

Hệ thống quản lý lệnh nâng cao (Advanced Order Management System) cho sàn HOSE, tổ chức theo dạng monorepo.
Khách hàng và dealer đặt lệnh thuật toán (Stop, Stop Limit, Take Profit, Trailing Stop, OCO, Bracket, Iceberg, TWAP,
VWAP, POV, HUNT). OMS tự chia thành lệnh con, gửi xuống Core, theo dõi khớp, xử lý lỗi và đối soát.

> **Trạng thái:** frontend đã xong 5 màn hình, Trung tâm lệnh và khung ứng dụng chung; chạy độc lập bằng dữ liệu giả lập (MSW và bộ giả lập thị trường
> trong trình duyệt), có ghi chú "Dữ liệu demo" trên header. Backend (FastAPI) và simulators chưa có code.

## Tính năng

- **Giới thiệu và đăng nhập** (`/`, `/login`): một màn hai cột. Bên trái giới thiệu sản phẩm, bên phải chọn tài khoản
  demo. Đã đăng nhập thì vào thẳng Trung tâm lệnh.
- **Khung ứng dụng** cho mọi trang sau đăng nhập. Thanh bên có menu theo vai trò, thu gọn được còn icon và nhớ lựa chọn
  sau khi tải lại trang. Các mục Mẫu chiến lược, Lịch sử và đối soát đang khóa, ghi "Sắp có".
  Thanh trên có phiên HOSE và giờ giả lập, nút tua x1/x10/x60, breadcrumb, nhãn "Dữ liệu demo · cập nhật", chuông
  thông báo và tài khoản.
- **Trung tâm lệnh** (`/trung-tam`, trang mặc định):
  - 4 chỉ số: lệnh đang chạy (kèm số đang tạm dừng), khối lượng khớp hôm nay trên tổng đã đặt, số lệnh cần chú ý
    (chia theo UNKNOWN / REJECTED / PAUSED_SYSTEM), slippage trung bình so với giá arrival.
  - Bảng lệnh cần chú ý; bấm một dòng để mở chi tiết lệnh.
  - 10 hoạt động gần nhất.
  - Khách hàng chỉ thấy lệnh của tài khoản mình; dealer thấy các tài khoản mình quản lý; vận hành thấy tất cả.
- **Thông báo**: sinh từ nhật ký lệnh theo các loại trong spec (kích hoạt lệnh, kích hoạt điều kiện, lệnh con bị từ chối,
  hệ thống tạm dừng, hoàn tất, hủy, hết hạn).
  - Chuông có badge số chưa đọc.
  - Bấm một thông báo thì nó được đánh dấu đã đọc và mở lệnh tương ứng; có nút "Đánh dấu tất cả đã đọc".
- **Báo cáo hiệu quả thực hiện** (`/bao-cao/hieu-qua`):
  - So giá khớp bình quân của từng lệnh với giá arrival và VWAP toàn thị trường cùng khoảng thời gian; có tỷ lệ tham gia.
  - Lọc theo khoảng thời gian (Hôm nay / 5 phiên), trạng thái, chiến lược, chiều, mã; dealer và vận hành lọc thêm theo
    tài khoản.
  - 4 chỉ số, bảng sắp xếp được theo từng cột, biểu đồ bps theo chiến lược kèm một câu nhận xét.
  - Nút "Xuất Excel" tải file CSV mở được bằng Excel tiếng Việt.
  - Chi tiết lệnh có thẻ "Hiệu quả" dùng cùng công thức.
  - Công thức: [docs/frontend-spec.md](docs/frontend-spec.md), mục 12.
- **Chế độ Demo**: app tự chạy 6 kịch bản E2E (Iceberg, Stop → Iceberg, POV, HUNT, Core mất ACK, OMS sập).
  - Mỗi bước có chú thích, tô sáng phần tử liên quan và tự chấm điều kiện kiểm tra.
  - Chạy trên dữ liệu riêng; thoát thì dữ liệu của bạn trở về nguyên vẹn.
  - Cách bật ở mục [Chế độ Demo](#chế-độ-demo).
- **5 màn nghiệp vụ**: xem bảng [Màn hình](#màn-hình). Mọi màn dùng chung các trạng thái đang tải, trống và lỗi.

Ảnh chụp ở 1440px và 1366px: [docs/screenshots/dot1/](docs/screenshots/dot1/) (khung ứng dụng, Trung tâm lệnh),
[docs/screenshots/dot2/](docs/screenshots/dot2/) (báo cáo hiệu quả, thẻ Hiệu quả ở chi tiết lệnh),
[docs/screenshots/dot3/](docs/screenshots/dot3/) (Chế độ Demo, ảnh 1440px).

## Cấu trúc thư mục

```text
OMS_Algo/
├── frontend/             # Giao diện web (Vite + React + TypeScript), chạy được với dữ liệu giả lập
│   └── src/
│       ├── pages/        # Mỗi màn hình một thư mục
│       ├── mocks/        # API giả lập (MSW), bộ giả lập giá, engine sinh lệnh con / khớp / bơm lỗi
│       ├── services/     # Hàm gọi API: nối backend thật chỉ cần đổi ở đây
│       ├── config/       # Luật HOSE, loại lệnh, tham số hệ thống, màu trạng thái
│       └── types/        # Kiểu dữ liệu theo ERD
├── backend/              # Dịch vụ OMS chính (Python, FastAPI): chưa có code
├── simulators/           # Giả lập hệ thống bên ngoài (Core, giá) để test: chưa có code
├── docs/
│   ├── frontend-spec.md  # Đặc tả frontend
│   ├── backend-gaps.md   # Những gì backend cần bổ sung so với ERD, và tồn đọng kỹ thuật
│   ├── test-cases/       # Bộ test case E2E và bảng phủ test
│   ├── screenshots/      # Ảnh chụp giao diện theo từng đợt
│   └── adr/              # Architecture Decision Records
├── scripts/              # Script tiện ích: chưa có
└── .claude/              # Cấu hình Claude Code dùng chung
```

## Chạy frontend

Cần Node.js (đã chạy với Node 26) và npm.

```bash
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in ra (mặc định http://localhost:5173), chọn một tài khoản demo rồi bấm "Vào hệ thống". Không cần backend:
mặc định app chạy với API giả lập. Trạng thái giả lập (lệnh, giá, cấu hình) lưu trong localStorage của trình duyệt;
nút "Về đầu ngày" trên header đưa mọi thứ về dữ liệu mẫu ban đầu.

Lệnh khác trong `frontend/`:

| Lệnh | Việc |
|---|---|
| `npm run lint` | ESLint |
| `npm run build` | Kiểm tra kiểu (`tsc -b`) và build |
| `npm run test` | Vitest. Test lệch tài liệu bị bỏ qua mặc định; chạy `VITE_TC_DEVIATIONS=1 npm run test` để xem chúng |

Cấu hình qua biến môi trường: xem `frontend/.env.example` (`VITE_API_BASE_URL`, `VITE_USE_MOCK`, `VITE_DEMO_MODE`).

## Chế độ Demo

App tự chạy 6 kịch bản E2E trong [TC-E2E.md](docs/test-cases/TC-E2E.md), để trình bày mà không phải thao tác tay.

**Bật Demo:**
- Đăng nhập `vanhanh` (vai trò Vận hành), bấm **▶ Demo** trên thanh trên cùng, chọn một kịch bản.
- Muốn mọi vai trò đều thấy nút Demo (ví dụ trình bày bằng tài khoản khách hàng): thêm `VITE_DEMO_MODE=true` vào
  `frontend/.env.local` rồi chạy lại `npm run dev`.

**Khi đang chạy:**
- Thanh trên có nhãn vàng "ĐANG CHẠY DEMO · Scenario n" và nút "Thoát Demo".
- Khung điều khiển ở đáy màn hình:
  - bước hiện tại và chú thích;
  - Phát / Tạm dừng, Bước tiếp, Làm lại, tốc độ x1 / x2 / x4;
  - kéo được, thả gần góc thì bám góc.
- Bảng "Điều kiện kiểm tra" bên phải: ĐẠT / KHÔNG ĐẠT / CHỜ.
- Phím tắt (chỉ khi đang Demo): `Space` phát / tạm dừng, `→` bước tiếp, `Esc` thoát.
- Chạy xong có hộp kết quả: chạy lại, chọn kịch bản khác, xuất kết quả ra CSV.

**Dữ liệu:**
- Trước khi chạy, app lưu nguyên trạng thái (lệnh, giá, cấu hình, localStorage của app, thông báo).
- Kịch bản chạy trên sổ lệnh trống với random có seed cố định, nên lần nào cũng ra cùng kết quả.
- Thoát Demo thì mọi thứ trở về đúng như lúc trước khi bấm.

Kịch bản trình bày 10 phút: [docs/demo-script.md](docs/demo-script.md).

## Tài khoản demo

Không cần mật khẩu. Trang đăng nhập hiện 3 thẻ cho `khachhang`, `dealer`, `vanhanh`. `vanhanh2` ở dòng nhỏ bên dưới, dùng
khi cần người duyệt thứ hai.

| Tài khoản | Vai trò | Được dùng |
|---|---|---|
| `khachhang` | Khách hàng | Trung tâm lệnh, Màn 1, 2, 3 với tài khoản của mình |
| `dealer` | Dealer | Trung tâm lệnh, Màn 1, 2, 3, xem lệnh của nhiều tài khoản |
| `vanhanh` | Vận hành | Trung tâm lệnh và cả 5 màn |
| `vanhanh2` | Vận hành | Trung tâm lệnh và cả 5 màn. Người thứ hai để demo maker-checker ở Màn 5: một người tạo yêu cầu, người kia duyệt |

## Màn hình

| # | Đường dẫn | Màn hình | Nội dung chính |
|---|---|---|---|
| 0 | `/trung-tam` | Trung tâm lệnh | KPI, lệnh cần chú ý, hoạt động gần nhất. Trang mặc định sau đăng nhập |
| 1 | `/dat-lenh` | Đặt lệnh nâng cao | Bảng giá VN30 thu gọn, ticket đặt 11 loại lệnh, kiểm tra luật HOSE ngay khi nhập |
| 2 | `/so-lenh` | Sổ lệnh nâng cao | Bảng lệnh cha, tiến độ, trạng thái, lọc; Sửa, Hủy, Tạm dừng, Tiếp tục |
| 3 | `/so-lenh/:id` | Chi tiết lệnh | Lệnh con, khớp, biểu đồ thực hiện so với kế hoạch, giá bình quân so với arrival, nhật ký |
| 4 | `/van-hanh` | Giám sát hệ thống | Cảnh báo, lệnh hệ thống tạm dừng, kill switch, nút bơm lỗi demo |
| 5 | `/cau-hinh` | Cấu hình chiến lược | Tham số hệ thống, đổi theo maker-checker, lịch sử thay đổi |
| 6 | `/bao-cao/hieu-qua` | Hiệu quả thực hiện | So giá BQ với arrival và VWAP, tỷ lệ tham gia, biểu đồ theo chiến lược, xuất CSV |

## Tài liệu

- [docs/frontend-spec.md](docs/frontend-spec.md): đặc tả frontend (màn hình, luật HOSE, mô hình dữ liệu, quy tắc nghiệp vụ).
- [docs/test-cases/](docs/test-cases/): [bộ test case E2E](docs/test-cases/TC-E2E.md) và
  [bảng phủ test](docs/test-cases/coverage.md), gồm danh sách chỗ engine giả lập còn lệch tài liệu.
- [docs/demo-script.md](docs/demo-script.md): kịch bản trình bày Chế độ Demo trong 10 phút.
- [docs/backend-gaps.md](docs/backend-gaps.md): bảng, trường, API backend cần thêm ngoài ERD; tồn đọng kỹ thuật.
