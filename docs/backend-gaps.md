# Khoảng trống giữa frontend và backend

Danh sách những gì frontend đang dùng (qua API giả lập MSW trong `frontend/src/mocks`) mà backend FastAPI cần bổ sung,
vì ERD chưa có.

> **Cơ sở đối chiếu:** tài liệu ERD 14 bảng và bộ TestCase chưa có trong repo (`docs/test-cases` đang rỗng).
> File này được đối chiếu với mô hình dữ liệu ở `docs/frontend-spec.md` mục 6, nên cần rà lại với ERD 14 bảng thật:
> mục nào ERD đã có thì bỏ khỏi danh sách.
> Cột "Luồng E2E" chỉ ghi các mã đã được nêu trong yêu cầu làm Màn 4. "Chưa có mã" nghĩa là chưa biết mã TestCase tương ứng.

Tên kiểu dữ liệu nằm ở `frontend/src/types`, logic mẫu nằm ở `frontend/src/mocks/engine.ts`.

## 1. Giá trị `reason_code` của ParentOrder

Spec có trường `reason_code` nhưng chỉ mô tả một giá trị. Trường này quyết định lệnh `PAUSED_SYSTEM` được xử lý thế nào.

| Giá trị | Lý do cần | Luồng E2E |
|---|---|---|
| `PRICE_OUT_OF_BAND` | Giá lệnh mang sang nằm ngoài biên độ mới. Chỉ được sửa giá, vận hành không được mở lại trực tiếp | Chưa có mã (spec mục 5) |
| `CHILD_REJECTED_REPEAT` | Core từ chối 2 lệnh con liên tiếp | TC-E2E-130 |
| `MARKET_DATA_STALE` | Dữ liệu giá trễ. Là lý do duy nhất tự chạy lại khi có giá mới | TC-E2E-180 |
| `KILL_SWITCH` | Vận hành dừng khẩn cấp. Gỡ kill switch không làm lệnh tự chạy lại | Chưa có mã (kill switch) |

## 2. Loại `notification_type` mới

Spec mục 6 có 7 loại. Các loại dưới đây là thêm mới.

| Giá trị | Lý do cần | Luồng E2E |
|---|---|---|
| `PARENT_RESUMED` | Báo lệnh chạy lại, do có giá mới hoặc do vận hành mở lại | TC-E2E-180; mở lại lệnh: chưa có mã |
| `CHILD_UNKNOWN` | Báo mất phản hồi từ Core, lệnh con đang chờ đối soát | TC-E2E-140, TC-E2E-141 |
| `CHILD_RECOVERED` | Báo kết quả đối soát lệnh con | TC-E2E-140, TC-E2E-141 |
| `DUPLICATE_FILL_IGNORED` | Báo đã bỏ qua báo khớp trùng, KL không đổi | TC-E2E-150 |

## 3. Trường mới

| Bảng | Trường | Kiểu | Lý do cần | Luồng E2E |
|---|---|---|---|---|
| Notification | `parent_order_id` | chuỗi | Hiển thị thông báo theo từng lệnh ở Màn 3, Màn 4 | Mọi kịch bản lỗi |
| Notification | `message` | chuỗi | Nội dung lý do hiển thị cho người dùng | Mọi kịch bản lỗi |
| OrderEvent | `fill_detail` | `{qty, price, exchange_match_id}`, chỉ có ở event FILL | Nhật ký ghi "Khớp 300 CP @ 61.000 · M-0000047". `new_value` vẫn phải là trạng thái lệnh con. `qty` là KL thực ghi nhận, có thể nhỏ hơn KL trong báo khớp nếu bị cắt bớt | Chưa có mã (nhật ký khớp); liên quan TC-E2E-150 |
| OrderEvent | `reason` | chuỗi, chỉ có khi vận hành mở lại lệnh | Lưu lý do vận hành nhập, kèm `user_id` | Chưa có mã (mở lại lệnh) |

Giá trị `old_value`, `new_value` có quy ước riêng mà frontend đang đọc (xem `pages/OrderDetail/eventFormat.ts`):
`DUPLICATE_FILL:<mã khớp>` → `IGNORED`, và `KILL_SWITCH:ALL` hoặc `KILL_SWITCH:ACCOUNT:<tài khoản>`.
Hai bên cần thống nhất nếu backend đổi cách ghi.

## 4. Trạng thái hệ thống chưa có bảng

| Dữ liệu | Hình dạng | Lý do cần | Luồng E2E |
|---|---|---|---|
| Kill switch | `{global: boolean, accounts: string[]}` | Phải lưu bền: còn bật thì chặn đặt lệnh mới và chặn mở lại lệnh, khởi động lại dịch vụ cũng không được mất | Chưa có mã (kill switch) |
| Tuổi dữ liệu giá | `quote_age_seconds` (số giây **thật**) | Ngưỡng `MAX_DATA_DELAY` = 5 giây thật, không phụ thuộc tốc độ tua. Backend tính từ thời điểm nhận giá cuối | TC-E2E-180 |

Phần `pendingFaults` trong engine chỉ phục vụ nút bơm lỗi demo. Backend thật không cần lưu; nếu cần thử lỗi thì nên làm ở simulator Core riêng.

## 5. API ngoài CRUD lệnh

Mọi API `/api/ops/*` chỉ role OPS được gọi, sai role trả 403. Lỗi nghiệp vụ trả `{ "message": "..." }` bằng tiếng Việt.

### Dùng thật khi vận hành

| API | Dữ liệu gửi | Lý do cần | Luồng E2E |
|---|---|---|---|
| `GET /api/ops/overview` | | Số lệnh theo trạng thái, số Child UNKNOWN / REJECTED, tuổi dữ liệu giá, cảnh báo, kill switch. Frontend hỏi lại mỗi giây | Mọi kịch bản lỗi |
| `POST /api/ops/kill-switch` | `{scope: "ALL"}` hoặc `{scope: "ACCOUNT", account_no}` | Dừng khẩn cấp: hủy Child chưa khớp, giữ Child UNKNOWN, lệnh chuyển `PAUSED_SYSTEM`. Có hiệu lực cả trong ATO, ATC | Chưa có mã (kill switch) |
| `POST /api/ops/kill-switch/release` | như trên | Gỡ chặn đặt lệnh mới, không tự chạy lại lệnh | Chưa có mã (kill switch) |
| `POST /api/ops/orders/:id/reopen` | `{reason}` | Mở lại lệnh `PAUSED_SYSTEM`. Từ chối khi kill switch còn bật, dữ liệu giá còn trễ, hoặc lý do dừng là `PRICE_OUT_OF_BAND`. Ghi OrderEvent `RESUME` kèm `user_id`, `reason` | Chưa có mã (mở lại lệnh) |
| `POST /api/ops/children/:id/reconcile` | | Đối soát ngay Child UNKNOWN với Core, ghi OrderEvent `RECOVERY` | TC-E2E-140, TC-E2E-141 |

### Chỉ phục vụ bơm lỗi demo

Backend thật không cần các API này nếu lỗi được tạo từ simulator Core. Nếu giữ lại, phải tắt ở môi trường thật.

| API | Dữ liệu gửi | Luồng E2E |
|---|---|---|
| `POST /api/ops/faults/reject` | `{parent_order_id}` | TC-E2E-130 |
| `POST /api/ops/faults/timeout-before-core` | `{parent_order_id}` | TC-E2E-140 |
| `POST /api/ops/faults/timeout-after-core` | `{parent_order_id}` | TC-E2E-141 |
| `POST /api/ops/faults/duplicate-fill` | `{parent_order_id}` | TC-E2E-150 |
| `POST /api/ops/faults/market-data` | `{stale: boolean}` | TC-E2E-180 |

### API lệnh cho Màn 3 và lệnh giá ngoài biên độ

| API | Lý do cần | Luồng E2E |
|---|---|---|
| `GET /api/orders/:id/detail` | Gộp tham số, lệnh con, khớp, arrival snapshot, nhật ký cho trang Chi tiết lệnh | Chưa có mã (Màn 3) |
| `GET /api/orders/:id/notifications` | Lý do tạm dừng ở trang Chi tiết lệnh | Chưa có mã (Màn 3) |
| `GET /api/orders/:id/price-fields` | Các giá còn dùng tới cần sửa của lệnh `PRICE_OUT_OF_BAND` | Chưa có mã (spec mục 5) |
| `POST /api/orders/:id/reprice` | Sửa giá, hợp lệ thì lệnh tự chạy lại | Chưa có mã (spec mục 5) |

## 6. Hành vi backend phải khớp với frontend

- **Mở lại lệnh:** khách hàng không được gọi API này. Frontend chỉ hiện nút ở Màn 4, nhưng backend vẫn phải tự kiểm tra role.
- **TC-E2E-140:** Core chưa tạo lệnh → hủy Child UNKNOWN, sinh đúng 1 Child mới.
- **TC-E2E-141:** Core đã tạo lệnh → giữ Child, về `ACKNOWLEDGED`, không sinh Child mới. Nếu lệnh cha đã ngừng chạy lúc đối soát xong thì hủy Child đó.
- **Từ chối lặp lại:** 2 lần liên tiếp trên cùng lệnh cha thì tạm dừng. Một Child được Core nhận thì đếm lại từ đầu.
- **Đặt lệnh khi kill switch bật:** `POST /api/orders` trả lỗi nghiệp vụ, kèm `message`.
