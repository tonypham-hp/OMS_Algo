# Đặc tả Frontend OMS (bản demo, dữ liệu mô phỏng)

> File này là đầu vào cho Claude Code. Làm frontend chạy độc lập bằng dữ liệu mock;
> backend FastAPI sẽ nối vào sau, nên mọi chỗ gọi dữ liệu phải đi qua `src/services/`.

## 1. Mục tiêu
Giao diện Advanced Order Management cho khách hàng / dealer trên sàn HOSE:
đặt lệnh nâng cao, theo dõi sổ lệnh, xem chi tiết lệnh cha – lệnh con – khớp lệnh,
và màn vận hành. Toàn bộ dữ liệu là demo, có ghi chú "Dữ liệu demo" trên header.

## 2. Công nghệ (khớp dự án admin-p2p của công ty)
- Vite + React + TypeScript, Tailwind CSS + shadcn/ui (`components.json`)
- React Router (lazy load từng trang), TanStack Query (dữ liệu server), Zustand (state client)
- react-hook-form + zod (form đặt lệnh), Recharts (biểu đồ)
- MSW (Mock Service Worker) giả lập API REST; bộ giả lập thị trường chạy trong trình duyệt
- ESLint, Vitest
- Không thêm thư viện ngoài danh sách khi chưa hỏi.

## 3. Cấu trúc thư mục (giữ đúng convention admin-p2p)
```
frontend/
  public/
  src/
    assets/
    components/        # component dùng chung; components/ui là của shadcn, không sửa tay
    config/            # hằng số: phiên giao dịch, bước giá, màu trạng thái
    hooks/             # useOrders, useMarketStream, usePermission ...
    lib/               # utils của shadcn, format số VN, query client
    mocks/             # MSW handlers + simulator (giá, sinh lệnh con, khớp, lỗi)
    pages/             # mỗi màn hình một thư mục
    routes/            # index.tsx, LazyLoader.tsx, LoginRoute.tsx, ProtectedRoute.tsx, PermissionRoute.tsx
    services/          # hàm gọi API (orders.service.ts, market.service.ts ...)
    store/             # zustand: auth, market ticks, ui
    types/             # kiểu dữ liệu theo ERD (mục 6)
    utils/
    App.tsx
    main.tsx
  .env.example         # VITE_API_BASE_URL, VITE_USE_MOCK=true
  components.json, eslint.config.js, tsconfig*.json, vite.config.ts
```

## 4. Đăng nhập và phân quyền (demo)
- Trang /login: chọn 1 trong 3 tài khoản demo, không cần mật khẩu thật.
  - `khachhang` (role CUSTOMER): màn 1, 2, 3
  - `dealer` (role DEALER): màn 1, 2, 3 + xem lệnh của nhiều tài khoản
  - `vanhanh` (role OPS): thêm màn 4, 5
- ProtectedRoute: chưa đăng nhập → /login. PermissionRoute: thiếu quyền → trang 403.

## 5. Màn hình
| # | Route | Màn hình | Nội dung chính |
|---|---|---|---|
| 1 | /dat-lenh | Đặt lệnh nâng cao | Bảng giá VN30 thu gọn (giá trần/sàn/TC, giá khớp, nháy màu khi đổi) + ticket đặt lệnh |
| 2 | /so-lenh | Sổ lệnh nâng cao | Bảng lệnh cha: mã, chiều, loại lệnh, KL đặt/khớp, thanh tiến độ, trạng thái; lọc + hành động |
| 3 | /so-lenh/:id | Chi tiết lệnh | Thông tin lệnh cha, timeline lệnh con, bảng khớp, biểu đồ thực hiện vs kế hoạch, giá BQ vs arrival, nhật ký |
| 4 | /van-hanh | Màn vận hành | Cảnh báo (Child UNKNOWN, REJECTED, dữ liệu giá trễ), kill switch, nút bơm lỗi cho demo |
| 5 | /cau-hinh | Cấu hình strategy | Danh sách tham số theo strategy; tạo yêu cầu thay đổi → người khác duyệt (maker-checker) |

Làm theo thứ tự 1 → 2 → 3 → 4 → 5, mỗi màn xong mới sang màn sau.

### Ticket đặt lệnh (màn 1)
- Loại lệnh: Stop, Stop Limit, Take Profit, Trailing Stop, OCO, Bracket, Iceberg, TWAP, VWAP, POV, HUNT.
- Form tham số đổi theo loại lệnh (ví dụ Iceberg: slice_qty; TWAP: start, end, interval;
  POV: participation %, max %; Trailing: trailing_value; OCO: giá TP + giá SL).
- Kiểm tra ngay khi nhập (mục 7), báo lỗi bằng tiếng Việt cạnh ô nhập.
- Bấm Đặt lệnh → hộp xác nhận tóm tắt → tạo lệnh cha, trả mã lệnh.

### Hành động ở sổ lệnh (màn 2)
| Hành động | Cho phép khi trạng thái | Khóa thêm khi |
|---|---|---|
| Sửa | ACTIVE, PARTIALLY_EXECUTED, PAUSED_USER | phiên ATO/ATC |
| Hủy | mọi trạng thái chưa kết thúc | phiên ATO/ATC |
| Tạm dừng | ACTIVE, PARTIALLY_EXECUTED | — |
| Tiếp tục | PAUSED_USER | — |

## 6. Mô hình dữ liệu (dùng đúng tên trường, đặt trong src/types)
- **ParentOrder**: parent_order_id, client_request_id, account_no, symbol, side (BUY|SELL),
  total_qty, executed_qty, limit_price, strategy_type, status, valid_from, valid_to,
  persistence_mode (DAY|GTD|MULTI_SESSION), version, created_at, updated_at
  - status: DRAFT, ACTIVE, PARTIALLY_EXECUTED, PAUSED_USER, PAUSED_SYSTEM,
    CANCEL_PENDING, COMPLETED, CANCELLED, EXPIRED
- **StrategyParameter**: parameter_code, parameter_value, data_type
- **OrderCondition**: condition_id, parent_order_id, condition_type, trigger_price,
  oco_group_id, status (ACTIVE|TRIGGERED|CANCELLED), triggered_at
- **ChildOrder**: child_order_id, parent_order_id, cycle_no, side, order_type (LO|MTL|ATO|ATC),
  price, quantity, filled_qty, status, client_order_id, idempotency_key, core_order_id,
  created_at, sent_at
  - status: CREATED, SENDING, ACKNOWLEDGED, PARTIAL_FILLED, FILLED, CANCEL_PENDING,
    CANCELLED, REJECTED, UNKNOWN, EXPIRED
- **Execution**: execution_id, child_order_id, parent_order_id, exchange_match_id, price, qty, match_time
- **MarketSnapshot**: arrival_price, arrival_bid, arrival_ask, arrival_timestamp
- **OrderEvent** (nhật ký): event_id, parent_order_id, child_order_id, action
  (CREATE, MODIFY, PAUSE, RESUME, CANCEL, TRIGGER, CHILD_CREATE, CHILD_SEND, FILL, REJECT,
  RECOVERY, DECISION, CHILD_UNKNOWN), user_id, channel, old_value, new_value, event_time
- **Notification**: notification_type (PARENT_ACTIVATED, CONDITION_TRIGGERED, CHILD_REJECTED,
  PARENT_PAUSED, PARENT_COMPLETED, PARENT_CANCELLED, PARENT_EXPIRED), sent_at

## 7. Luật HOSE (kiểm tra ở form và trong simulator)
- Phiên: ATO 9:00–9:15 · liên tục 9:15–11:30 · nghỉ trưa · liên tục 13:00–14:30 · ATC 14:30–14:45.
- Không sửa / hủy lệnh trong ATO, ATC. Lệnh MTL chỉ trong phiên liên tục.
- Biên độ ±7% so với giá tham chiếu (giá trần / sàn).
- Bước giá: 10đ (giá < 10.000), 50đ (10.000–49.950), 100đ (≥ 50.000).
- Khối lượng: bội số 100, tối đa 500.000 cổ phiếu / lệnh.
- Giá dùng số nguyên đồng (không dùng số thực); hiển thị kiểu Việt Nam: 1.000.000.

## 8. Quy tắc nghiệp vụ lõi (simulator phải tôn trọng)
- KL được phép sinh lệnh con = total_qty − executed_qty − working (Child chưa kết thúc).
- Tổng khớp không bao giờ vượt total_qty.
- Child UNKNOWN (mất phản hồi Core) vẫn tính là working cho tới khi đối soát xong.
- Mỗi lần khớp có exchange_match_id duy nhất; báo khớp lặp lại thì bỏ qua.
- Mọi thay đổi trạng thái đều ghi một OrderEvent.

## 9. Bộ giả lập (src/mocks)
- Mã: FPT, HPG, VCB, MWG, TCB, VNM, SSI, VHM, MBB, ACB với giá tham chiếu hợp lý.
- Giá nhảy ngẫu nhiên trong biên độ, đúng bước giá; có đồng hồ phiên + nút tua nhanh (x1, x10, x60).
- Engine giả lập: lệnh cha sinh lệnh con theo strategy (Iceberg theo slice, TWAP theo interval…),
  lệnh con khớp dần theo giá thị trường.
- Nút bơm lỗi (màn 4): lệnh con bị từ chối, mất kết nối Core → UNKNOWN rồi tự đối soát,
  báo khớp trùng, dữ liệu giá trễ → lệnh cha PAUSED_SYSTEM.
- Có sẵn 6–8 lệnh mẫu ở nhiều trạng thái khác nhau để demo ngay khi mở.

## 10. Giao diện
- Nền tối kiểu bảng giá; màu giá theo quy ước VN: trần tím, tăng xanh lá, tham chiếu vàng,
  giảm đỏ, sàn xanh lam. Số căn phải, font số đều nhau (tabular-nums).
- Trạng thái lệnh có badge màu thống nhất (khai báo trong src/config).
- Tiếng Việt toàn bộ giao diện.

## 11. Nghiệm thu mỗi màn
- `npm run lint` và `npm run build` không lỗi; có ít nhất vài test Vitest cho hàm kiểm tra luật HOSE.
- Chạy `npm run dev`, mở localhost, thao tác được đúng luồng của màn đó.
- Commit theo Conventional Commits, ví dụ `feat(frontend): add order ticket with HOSE validation`.
