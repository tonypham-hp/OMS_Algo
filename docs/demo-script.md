# Kịch bản trình bày Chế độ Demo (10 phút)

Dùng khi trình bày OMS cho lãnh đạo. App tự chạy 6 kịch bản trong [TC-E2E.md](test-cases/TC-E2E.md). Người trình bày chỉ
cần phát, dừng ở chỗ cần nhấn mạnh, và nói theo gợi ý dưới đây.

## Chuẩn bị (trước buổi họp)

- [ ] `cd frontend && npm run dev`, mở bằng Chrome, màn hình 1440px trở lên, phóng to 100%.
- [ ] Đăng nhập `vanhanh` (vận hành luôn thấy nút Demo). Muốn đăng nhập tài khoản khác thì đặt `VITE_DEMO_MODE=true`
      trong `frontend/.env.local` rồi chạy lại `npm run dev`.
- [ ] Bấm "▶ Demo" → chạy thử Scenario 1 ở tốc độ x4 tới hộp kết quả → "Thoát Demo". Dữ liệu trở về như cũ.
- [ ] Tắt thông báo hệ điều hành, đóng tab khác.

Phím tắt khi đang Demo:
- `Space`: phát / tạm dừng.
- `→`: chạy đúng một bước.
- `Esc`: thoát Demo.

Khung điều khiển kéo được, thả gần góc thì bám góc. Bảng "Điều kiện kiểm tra" bên phải thu gọn được.

Gợi ý chạy: để x1 và bấm `→` từng bước khi muốn nói kỹ; để x2 khi chỉ cần xem lướt.

## Thứ tự và thời lượng

| # | Phút | Kịch bản | Thông điệp chính |
|---|---|---|---|
| 0 | 0:00–1:00 | Mở đầu | OMS chia lệnh lớn thành lệnh con và tự kiểm soát rủi ro |
| 1 | 1:00–2:30 | Scenario 1 · Iceberg thành công | Không gửi dư, khớp thiếu thì tính lại theo số thật |
| 2 | 2:30–4:00 | Scenario 2 · Stop → Iceberg | Chỉ hành động khi điều kiện đúng, và chỉ một lần |
| 3 | 4:00–6:00 | Scenario 5 · Core mất ACK | Mất phản hồi cũng không gửi trùng lệnh |
| 4 | 6:00–8:00 | Scenario 6 · OMS sập | Sập rồi bật lại không mất phần đã khớp |
| 5 | 8:00–9:00 | Scenario 3 · POV | Bám theo thị trường, không vượt trần tham gia |
| 6 | 9:00–10:00 | Scenario 4 · HUNT | Quét thanh khoản nhưng không vượt giá tối đa |

Scenario 5 và 6 là phần quan trọng nhất về rủi ro vận hành. Nếu thiếu thời gian, bỏ Scenario 3 và 4.

## 0. Mở đầu (1 phút)

> "Khi khách đặt một lệnh lớn, OMS không đẩy cả lệnh xuống sàn mà chia thành nhiều lệnh con theo chiến lược. Rủi ro lớn
> nhất là gửi dư, gửi trùng, hoặc mất dấu phần đã khớp khi có sự cố. Hôm nay em cho máy tự chạy 6 tình huống trong bộ test
> case E2E. Bên phải là các điều kiện kiểm tra, máy tự chấm sau mỗi bước."

Chỉ vào:
- nhãn vàng **ĐANG CHẠY DEMO**;
- bảng **Điều kiện kiểm tra**. Nhóm "Quy tắc lõi" chạy sau mọi bước: không khớp vượt KL, `allowed = total − executed −
  working`, không trùng mã lệnh con, không cộng trùng báo khớp.

Câu chốt:

> "Dữ liệu Demo chạy riêng; thoát ra thì dữ liệu thật trở về nguyên vẹn."

## 1. Scenario 1 · Iceberg thành công (1,5 phút)

- **Bước 1:** lệnh 50.000, chỉ 1 lệnh con 10.000 xuống sàn.
  > "Giấu khối lượng thật, sàn chỉ thấy 10.000."
- **Bước 3–4:** lệnh con #2 khớp 5.000 rồi Core hủy phần còn lại. Dừng lại (`Space`), chỉ vào "Đã khớp 15.000, còn
  lại 35.000".
  > "Hệ thống tính theo số đã khớp thật, không theo kế hoạch. Nếu tính theo kế hoạch sẽ thiếu 5.000 hoặc gửi dư."
- **Bước 5:** lệnh con cuối chỉ 5.000.
- **Câu chốt:**
  > "Tổng khớp đúng 50.000, KL lệnh cha bằng đúng tổng các lần khớp. Đó là điều kiện đối soát với Core."

## 2. Scenario 2 · Stop kích hoạt → Iceberg (1,5 phút)

- **Bước 2:** giá về 117.000, chưa chạm 116.000.
  > "Chưa đúng điều kiện thì tuyệt đối không có lệnh nào xuống sàn."
- **Bước 3:** chạm 116.000. Chỉ vào điều kiện "Lệnh con đầu tiên sinh SAU thời điểm kích hoạt".
- **Bước 4:** giá tiếp tục giảm.
  > "Chỉ kích hoạt một lần. Nếu kích hoạt lại mỗi lần giá chạm, khách sẽ bị bán gấp đôi."
- **Câu chốt:**
  > "Điều kiện giá và thuật toán chia lệnh chạy chung trên một lệnh cha."

## 3. Scenario 5 · Core mất ACK → UNKNOWN → đối soát (2 phút)

- **Bước 2:** bơm lỗi.
  > "Đây là tình huống nguy hiểm nhất khi nối Core thật: Core đã nhận lệnh nhưng phản hồi bị mất."
- **Bước 4: dừng lại (`Space`).** Lệnh con #2 được tô vàng, trạng thái **Chưa rõ (UNKNOWN)**.
  > "Hệ thống không biết Core có giữ lệnh hay không. Nếu coi như chưa gửi và gửi lại, khách có thể mua gấp đôi.
  > Vì vậy 10.000 của #2 vẫn được tính là đang chờ, và không sinh lệnh thay thế."
  - Chỉ vào ba điều kiện: working = 10.000, `allowed = 10.000`, không có lệnh con #3.
- **Bước 5:** đối soát.
  > "Tra Core theo `client_order_id`, thấy lệnh còn đó, nên giữ nguyên, không gửi lần hai."
- **Bước 7:** Core gửi lại báo khớp cũ.
  > "Báo khớp trùng mã bị bỏ qua, KL không cộng hai lần."
- **Câu chốt:**
  > "Tài liệu ghi kịch bản này là bắt buộc trong UAT trước khi nối Core thật. Bản demo đã chạy đúng logic; khi có
  > backend sẽ chạy lại với Core thật."

## 4. Scenario 6 · OMS sập → khôi phục (2 phút)

- **Bước 1–3:** POV đã khớp 30.000, còn 10.000 đang chờ trên sàn.
- **Bước 5:** OMS sập, sổ lệnh trống trơn.
  > "Mọi thứ trong bộ nhớ mất hết."
- **Bước 6:** trong lúc OMS tắt, Core vẫn khớp 5.000.
- **Bước 7:** bật lại. Chỉ vào điều kiện "giống hệt trước khi sập".
- **Bước 8:** nhận báo khớp bị lỡ, đã khớp 35.000.
  > "Không mất phần khớp lúc tắt, không gửi lại lệnh con."
- **Câu chốt:**
  > "Ở bản demo, 'đĩa' là localStorage. Ở backend thật, trạng thái phải ghi vào CSDL trước khi gửi lệnh xuống sàn, và
  > khởi động lại phải đối soát với Core trước khi chạy tiếp."

## 5. Scenario 3 · POV điều chỉnh theo thị trường (1 phút)

- Chạy x2, chỉ dừng ở bước "KL tăng đột biến".
  > "Thị trường đứng yên thì POV đứng yên. Thị trường tăng đột biến, 10% là 20.000 nhưng lệnh chỉ còn 15.000, nên chỉ
  > gửi 15.000."
- **Câu chốt:** chỉ vào "Tỷ lệ tham gia thực tế ≤ 20%". Con số này tính bằng cùng công thức với màn Báo cáo hiệu quả.

## 6. Scenario 4 · HUNT quét mức + phần còn lại (1 phút)

- **Bước 3:**
  > "Được phép quét 3 mức nhưng mức thứ 3 là 118.400, vượt giá tối đa 118.300, nên chỉ quét 2 mức. Hệ thống không bao
  > giờ trả giá cao hơn mức khách cho phép."
- **Bước 4:**
  > "Phần còn lại 3.000 không đuổi giá mà đặt chờ ở giá mua tốt nhất."
- **Kết thúc:** hộp kết quả hiện "Mọi điều kiện kiểm tra đều ĐẠT". Bấm **Xuất kết quả** để có file CSV gửi kèm biên bản.
- **Thoát Demo** (`Esc`):
  > "Dữ liệu thật trở về như lúc trước khi bấm Demo."

## Câu hỏi hay gặp

- **"Đây là dữ liệu thật à?"**
  Không. Giá và Core đều là giả lập trong trình duyệt. Kịch bản điều khiển giá nên lần nào chạy cũng ra cùng kết quả.
- **"Điều kiện kiểm tra lấy từ đâu?"**
  Từ quy tắc lõi trong đặc tả (mục 8 của `docs/frontend-spec.md`) và từ kết quả mong đợi của từng TC trong bộ test case.
  Cùng bộ kịch bản này cũng chạy tự động trong `npm run test`.
- **"Còn gì chưa làm?"**
  Chọn giá thích ứng (Adaptive) theo Bid/Ask, kiểm tra Risk, profile VWAP thật. Scenario 3 trong tài liệu gốc có Adaptive;
  bản demo chỉ trình diễn phần POV.
  Xem mục "Engine chưa có tính năng" trong [coverage.md](test-cases/coverage.md).
- **"Khi có backend thì sao?"**
  Kịch bản 5 và 6 phải chạy lại với Core thật; những gì backend cần cung cấp ghi trong
  [backend-gaps.md](backend-gaps.md).

## Nếu có sự cố khi trình bày

- **Kịch bản đứng:** bấm "Làm lại", hoặc `→` để chạy từng bước.
- **Màn hiển thị lạ:** `Esc` để thoát Demo (dữ liệu được khôi phục), rồi bấm "▶ Demo" chọn lại.
- **Tải lại trang giữa chừng:** Demo dừng.
  - Lệnh, giá, cấu hình không bị ghi đè, vì trong lúc Demo app không lưu trạng thái giả lập vào localStorage.
  - Riêng danh sách thông báo (chuông) có thể lẫn vài thông báo của Demo; bấm "Đánh dấu tất cả đã đọc" là xong.
