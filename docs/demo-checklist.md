# Checklist trước buổi demo (v0.1.0)

Làm theo thứ tự, trên đúng máy và trình duyệt sẽ dùng để trình bày. Mất khoảng 10–15 phút, phần lâu nhất là bước 3.

| # | Việc | Cách làm | Đạt khi |
|---|---|---|---|
| 1 | Lấy code mới nhất | `git checkout main` rồi `git pull` | `git log -1` là commit mới nhất của bản demo |
| 2 | Cài thư viện | `cd frontend` rồi `npm install` (hoặc `npm ci` cho đúng lock) | Không có lỗi; cảnh báo `npm audit` không chặn demo |
| 3 | Chạy toàn bộ kiểm thử | `npm run test:all` (lint → Vitest → build → Playwright) | Kết thúc không lỗi; Playwright báo mọi test passed. Cần Chrome hoặc Edge đã cài sẵn |
| 4 | Chạy app | `npm run dev`, mở http://localhost:5173 | Trang đăng nhập hiện 3 thẻ tài khoản |
| 5 | Đăng nhập vận hành | Chọn thẻ `vanhanh`, bấm "Vào hệ thống với vai trò Vận hành" | Vào Trung tâm lệnh, thanh trên có nút **▶ Demo** |
| 6 | Tắt thông báo hệ điều hành | Windows: bật Focus assist / Do not disturb; tắt thông báo Teams, Outlook, Zalo | Không có cửa sổ bật lên trong lúc trình bày |
| 7 | Phóng to trình duyệt 100% | `Ctrl+0`; cửa sổ toàn màn hình (`F11`) hoặc tối đa ở 1440×900 / 1366×768 | Breadcrumb ở thanh trên không bị cắt, không có thanh cuộn ngang |
| 8 | Chạy thử Scenario 1 | **▶ Demo** → Scenario 1 · Iceberg, để chạy hết (tốc độ x4 cho nhanh) | Hộp kết quả ghi "Mọi điều kiện kiểm tra đều ĐẠT."; bấm "Thoát Demo" |
| 9 | Xóa dữ liệu demo cũ | Bấm "Về đầu ngày" trên thanh trên (chỉ hiện khi không Demo); nếu cần sạch hẳn: DevTools → Application → Clear site data, rồi tải lại | Sổ lệnh về đúng lệnh mẫu ban đầu, đồng hồ 09:10 phiên ATO |
| 10 | Mở sẵn các tab | Tab 1: app ở `/trung-tam`; tab 2: [docs/demo-script.md](demo-script.md); tab 3: [docs/test-cases/TC-E2E.md](test-cases/TC-E2E.md) | Chuyển tab không phải gõ địa chỉ |

## Nếu có sự cố trong lúc demo

- **Kịch bản báo KHÔNG ĐẠT**: bấm "Chạy lại" trong hộp kết quả. Kịch bản dùng seed cố định nên lần chạy lại cho cùng kết quả;
  nếu vẫn lỗi, thoát Demo và chuyển sang kịch bản khác, ghi lại số kịch bản để kiểm sau.
- **Trang trắng hoặc không có dữ liệu**: tải lại trang (`F5`). Dữ liệu giả lập lưu trong localStorage nên không mất.
- **Cần quay về trạng thái đầu**: "Về đầu ngày", hoặc Clear site data như bước 9.
