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
  sau khi tải lại trang. Các mục Mẫu chiến lược, Hiệu quả thực hiện, Lịch sử và đối soát đang khóa, ghi "Sắp có".
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
- **5 màn nghiệp vụ**: xem bảng [Màn hình](#màn-hình). Mọi màn dùng chung các trạng thái đang tải, trống và lỗi.

Ảnh chụp ở 1440px và 1366px: [docs/screenshots/dot1/](docs/screenshots/dot1/).

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

Cấu hình qua biến môi trường: xem `frontend/.env.example` (`VITE_API_BASE_URL`, `VITE_USE_MOCK`).

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

## Tài liệu

- [docs/frontend-spec.md](docs/frontend-spec.md): đặc tả frontend (màn hình, luật HOSE, mô hình dữ liệu, quy tắc nghiệp vụ).
- [docs/test-cases/](docs/test-cases/): [bộ test case E2E](docs/test-cases/TC-E2E.md) và
  [bảng phủ test](docs/test-cases/coverage.md), gồm danh sách chỗ engine giả lập còn lệch tài liệu.
- [docs/backend-gaps.md](docs/backend-gaps.md): bảng, trường, API backend cần thêm ngoài ERD; tồn đọng kỹ thuật.
