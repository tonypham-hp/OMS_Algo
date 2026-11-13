# Bảng phủ test TC-E2E

Đối chiếu [TC-E2E.md](TC-E2E.md) với test tự động của frontend (Vitest), cập nhật 13/11/2026 (Đợt 3: HUNT quét mức, Stop Limit chia phần, Chế độ Demo; Đợt 4: sổ lệnh 3 mức, HUNT khớp theo sổ lệnh — `src/mocks/depth.test.ts`, `src/mocks/engine.depth.test.ts`, `src/utils/huntSweep.test.ts`, mẫu chiến lược — `src/utils/strategyTemplates.test.ts`).

## Tóm tắt

| | Số TC | Tỷ lệ |
|---|---|---|
| TC phạm vi FE (gồm cả FE + BE) | 69 | |
| Đã có test | **60** | **87,0%** |
| — trong đó xanh và khớp đủ tài liệu (✅) | 47 | 68,1% |
| — có test một phần (⚠️) | 9 | |
| — lệch tài liệu, test đỏ (🔴) | 4 | |
| Chưa có test vì engine chưa có tính năng (⛔) | 9 | |
| TC chỉ phạm vi BE (⏳ chờ backend) | 3 | không tính vào tỷ lệ |

Trước đợt này chỉ 5/69 TC (130, 140, 141, 150, 180) có test đặt tên theo mã.

### Ký hiệu

- ✅ Có test, kết quả khớp tài liệu.
- ⚠️ Có test cho một phần; phần còn lại ghi ở cột Ghi chú.
- 🔴 Có test viết đúng kết quả mong đợi của tài liệu, nhưng engine cho kết quả khác. Test được giữ nguyên, không sửa cho xanh.
- ⛔ Chưa có test: engine chưa có tính năng nên không có gì để kiểm.
- ⏳ Chờ backend.

### Chạy test

- `npm test` (thư mục `frontend`): chạy toàn bộ. Test 🔴 bị **skip**, test ⛔ hiện là **todo**.
- `VITE_TC_DEVIATIONS=1 npm test`: bật cả test 🔴. Hiện có 6 test đỏ (4 TC 🔴, cộng phần lệch của TC-041 và TC-240).

### Tên file viết tắt

| Viết tắt | File |
|---|---|
| E2E | `frontend/src/mocks/engine.e2e.test.ts` (test mới, tên bắt đầu bằng mã TC) |
| ENG | `frontend/src/mocks/engine.test.ts` |
| FLT | `frontend/src/mocks/engine.faults.test.ts` |
| SCH | `frontend/src/pages/PlaceOrder/orderSchema.test.ts` |
| DET | `frontend/src/pages/OrderDetail/orderDetail.test.ts` |
| DEMO | `frontend/src/demo/scenarios.test.ts` (6 kịch bản của Chế độ Demo, chạy headless) |
| EDM | `frontend/src/mocks/engine.demo.test.ts` (bổ sung engine cho Chế độ Demo) |

Số liệu giá trừu tượng của tài liệu được quy đổi sang FPT tham chiếu 100.000, trần 107.000, sàn 93.000, bước 100
(ví dụ trailing "120 / 110" thành 103.000 / 102.000; OCO "TP 110, SL 90" thành 104.000 / 96.000).

## Cần quyết định

### Lệch tài liệu (test 🔴)

| Mã | Tài liệu mong đợi | Engine hiện tại | Kết quả test khi bật |
|---|---|---|---|
| TC-E2E-162 | Báo khớp 4.000 về trong lúc hủy vẫn được cộng, không mất phần khớp | `cancelOrder` chuyển lệnh con sang CANCELLED ngay, báo khớp đến sau bị `applyExecution` bỏ qua. **Mất phần khớp thật, vị thế OMS lệch với sàn** | `executed_qty` = 0, mong đợi 4.000 |
| TC-E2E-002 | Gửi trùng `client_request_id` chỉ tạo 1 lệnh | Không chống trùng, cả engine lẫn API `POST /api/orders` | Lần hai tạo `PO-…-0002` |
| TC-E2E-062 | Khớp thiếu 4.000 được rải vào 9 khoảng còn lại | Lịch TWAP là lũy kế: dồn cả 4.000 vào khoảng kế tiếp | Khoảng 2 gửi 14.000, mong đợi ≤ 10.500 |
| TC-E2E-171 | Tiếp tục TWAP: chia lại phần còn lại cho các khoảng còn lại, không chạy lại khoảng đã lỡ | Gửi bù một lần toàn bộ các khoảng đã lỡ lúc tạm dừng | Gửi 30.000, mong đợi ≤ 12.900 |
| TC-E2E-041 (một phần) | KL được phép thoát = 4.000 khi lệnh vào mới khớp 4.000 | Bracket chỉ theo dõi TP/SL khi lệnh vào khớp **đủ**, nên chạm TP lúc khớp một phần không thoát gì | KL thoát 0, mong đợi 4.000 |
| TC-E2E-240 (một phần) | Mỗi thao tác ghi kèm request id | `OrderEvent` không có trường request id | Thiếu `request_id` |

TC-062, TC-171 và cách xử lý nghỉ trưa ở TC-061 cùng một gốc: TWAP chạy theo mục tiêu lũy kế theo giờ, nên phần thiếu
hay phần lỡ luôn được gửi bù ngay, không chia lại.

### Test xanh nhưng cần xác nhận cách hiểu

| Mã | Điểm cần xác nhận |
|---|---|
| TC-E2E-061 | Không sinh lệnh con trong giờ nghỉ (đúng), nhưng lúc 13:00 gửi một lệnh con 100.000 cho cả 8 khoảng rơi vào giờ nghỉ. "Lịch dời sang phiên hợp lệ" có cho phép dồn như vậy không? |
| TC-E2E-130 | Lệnh con REJECTED, không cộng executed (đúng), nhưng không lưu lý do cụ thể ("giá không hợp lệ"): bơm lỗi không mang mã lỗi, Notification chỉ ghi "Core từ chối" |
| TC-E2E-131 | Không thử lại vô hạn, PAUSED_SYSTEM (đúng), nhưng engine không phân biệt loại lỗi: "không đủ số dư" vẫn chờ 2 lần từ chối liên tiếp mới dừng |
| TC-E2E-161 | Chuỗi trạng thái đúng, nhưng Core xác nhận hủy là đồng bộ trong giả lập. Chỉ lệnh con UNKNOWN mới làm lệnh cha chờ ở CANCEL_PENDING |
| TC-E2E-003 | Tham số sai bị chặn ở API `POST /api/orders` (dùng `validateOrderValues`). Bản thân `engine.createOrder` không kiểm tra lại |

### Engine chưa có tính năng (⛔)

| Tính năng | TC bị ảnh hưởng |
|---|---|
| Risk (kiểm tra lúc tạo, lúc kích hoạt, trong lúc chạy) | 004, 013, 120; một phần 082, 121 |
| Iceberg ngẫu nhiên ±% | 054 |
| VWAP: nhập profile, xử lý thiếu profile, trần tham gia theo KL thị trường | 081; một phần 080, 082 |
| Adaptive: chọn giá bị động / chủ động theo Bid/Ask. Engine luôn đặt đúng giá giới hạn của lệnh cha | 100, 101; một phần 102; Scenario 3 |
| Sequence của sự kiện từ Core | 151 |
| Trạng thái tạm ngừng giao dịch của mã | 192 |

## Bảng phủ chi tiết

### A. Vòng đời lệnh cha
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-001 | FE | ✅ | E2E: `TC-E2E-001 tạo Iceberg 100.000 slice 10.000: ACTIVE, chưa khớp, không gửi cả 100.000 một lần`. Liên quan ENG: `Iceberg: mỗi lần một phần đúng slice_qty, phần trước xong mới có phần sau` | |
| TC-E2E-002 | FE | 🔴 | E2E: `TC-E2E-002 gửi trùng client_request_id: chỉ có 1 lệnh cha, lần hai nhận lại lệnh đã tạo` | Xem mục Lệch |
| TC-E2E-003 | FE | ✅ | E2E: `TC-E2E-003 tham số không hợp lệ: KL âm hoặc slice lớn hơn tổng KL bị chặn trước khi tạo lệnh`. Liên quan SCH: `kiểm tra khối lượng theo luật HOSE`, `Iceberg: slice là bội số 100 và không lớn hơn KL` | Chặn ở API, xem mục Cần xác nhận |
| TC-E2E-004 | FE | ⛔ | E2E (todo) | Chưa có Risk |

### B. Lệnh Stop
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-010 | FE | ✅ | E2E: `TC-E2E-010 chưa chạm ngưỡng: điều kiện ACTIVE, không có lệnh con`. Liên quan ENG: `Stop chưa chạm thì không sinh lệnh con; chạm thì sinh MTL và khớp` | |
| TC-E2E-011 | FE | ✅ | E2E: `TC-E2E-011 chạm ngưỡng: điều kiện TRIGGERED, sinh 1 lệnh con` | |
| TC-E2E-012 | FE | ✅ | E2E: `TC-E2E-012 chỉ kích hoạt một lần: giá tiếp tục giảm không sinh lệnh con thứ hai` | Tài liệu có giá 92 (dưới sàn), test dừng ở sàn 93.000 |
| TC-E2E-013 | FE | ⛔ | E2E (todo) | Chưa có Risk |

### C. Trailing Stop
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-020 | FE | ✅ | E2E: `TC-E2E-020 cập nhật giá tốt nhất: best = 103.000, ngưỡng = 102.000`. Liên quan ENG: `Trailing bán: giá kích hoạt bám đỉnh, không tụt theo giá giảm` | |
| TC-E2E-021 | FE | ✅ | E2E: `TC-E2E-021 giá giảm về 102.500: best và ngưỡng không giảm, chưa có lệnh con` | |
| TC-E2E-022 | FE | ✅ | E2E: `TC-E2E-022 giá về 102.000: TRIGGERED, sinh 1 lệnh con bán` | |

### D. OCO
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-030 | FE | ✅ | E2E: `TC-E2E-030 chốt lời thắng: TP TRIGGERED, SL CANCELLED trong cùng một nhịp, chỉ 1 lệnh con bán`. Liên quan ENG: `OCO chạm TP: sinh LO giá TP, SL bị hủy` | |
| TC-E2E-031 | FE | ✅ | E2E: `TC-E2E-031 cắt lỗ thắng: SL TRIGGERED, TP CANCELLED`. Liên quan ENG: `OCO chạm SL: sinh MTL, TP bị hủy, và không kích hoạt lần hai` | |
| TC-E2E-032 | FE + BE | ✅ FE, ⏳ BE | E2E: `TC-E2E-032 (phần FE) TP rồi SL ở hai nhịp liền nhau: chỉ một nhánh thắng, không có 2 lệnh con thoát` | Engine xử lý tuần tự từng nhịp. Hai sự kiện đồng thời thật giữa nhiều tiến trình: chờ backend |

### E. Bracket
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-040 | FE | ✅ | E2E: `TC-E2E-040 lệnh vào được Core nhận nhưng chưa khớp, giá chạm TP: TP chưa bật, không có lệnh thoát`. Liên quan ENG: `khớp lệnh vào xong mới theo dõi TP/SL; lệnh thoát ngược chiều, không cộng vào executed` | |
| TC-E2E-041 | FE | ⚠️ 🔴 | E2E: `TC-E2E-041 lệnh vào khớp một phần 4.000, giá chạm TP: lệnh thoát không vượt 4.000` (xanh); `TC-E2E-041 KL được phép thoát = 4.000: …` (🔴) | Xem mục Lệch |
| TC-E2E-042 | FE | ✅ | E2E: `TC-E2E-042 lệnh vào khớp thêm 6.000 (đủ 10.000): TP chạm thì thoát 10.000` | |

### F. Iceberg
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-050 | FE | ✅ | E2E: `TC-E2E-050 cơ bản: lệnh con #1 = 10.000, khớp đủ thì sinh #2 = 10.000` | |
| TC-E2E-051 | FE | ✅ | E2E: `TC-E2E-051 #1 khớp 6.000, phần còn lại bị hủy: còn lại 94.000, lệnh con kế tiếp tính theo số đã khớp thật` | Engine chưa có sự kiện "Core hủy lệnh con", test hủy bằng Tạm dừng rồi Tiếp tục |
| TC-E2E-052 | FE | ✅ | E2E: `TC-E2E-052 slice cuối: tổng 25.000 slice 10.000 → 10.000, 10.000, 5.000` | |
| TC-E2E-053 | FE | ✅ | E2E: `TC-E2E-053 tuần tự: #1 đã được Core nhận nhưng chưa kết thúc thì chưa sinh #2` | |
| TC-E2E-054 | FE | ⛔ | E2E (todo) | Chưa có Iceberg ngẫu nhiên |

### G. TWAP
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-060 | FE | ✅ | E2E: `TC-E2E-060 100.000 chia 10 khoảng: mỗi khoảng 10.000`. Liên quan ENG: `TWAP: lịch lũy kế chia đều theo chu kỳ, chu kỳ cuối bằng total` | |
| TC-E2E-061 | FE | ✅ | E2E: `TC-E2E-061 nghỉ trưa: không sinh lệnh con trong giờ nghỉ, chạy tiếp từ 13:00`. Liên quan ENG: `nghỉ trưa: không sinh và không khớp lệnh con` | Xem mục Cần xác nhận |
| TC-E2E-062 | FE | 🔴 | E2E: `TC-E2E-062 khớp thiếu: kế hoạch 10.000, khớp 6.000 thì 4.000 thiếu rải vào 9 khoảng còn lại` | Xem mục Lệch |
| TC-E2E-063 | FE | ✅ | E2E: `TC-E2E-063 hết giờ còn 20.000, lệnh trong ngày: không sinh thêm lệnh con, lệnh cha EXPIRED`. Liên quan ENG: `TWAP hết khung giờ mà chưa đủ thì hết hạn, lệnh con đang chờ cũng hết hạn` | |

### H. POV
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-070 | FE | ✅ | E2E: `TC-E2E-070 tính mục tiêu: 10% × 1.000.000 − đã khớp 80.000 − đang chờ 5.000 = 15.000` | Engine đếm KL thị trường từ lúc đặt lệnh, nên test bắt đầu từ KL 0 |
| TC-E2E-071 | FE | ✅ | E2E: `TC-E2E-071 KL thị trường không đổi, chỉ đồng hồ chạy: không sinh thêm lệnh con` | |
| TC-E2E-072 | FE | ✅ | E2E: `TC-E2E-072 trần tham gia 10%: KL gửi đi không vượt 10% KL thị trường ở mọi thời điểm`. Liên quan ENG: `POV: sinh theo % KL thị trường, cộng dồn phần lẻ, không quá max %` | |

### I. VWAP
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-080 | FE | ⚠️ | E2E: `TC-E2E-080 mục tiêu theo profile: lệnh con mới = mục tiêu lũy kế − đã khớp − đang chờ` | Kiểm công thức với profile cố định hình chữ U của engine; chưa nhập được profile 30% như tài liệu |
| TC-E2E-081 | FE | ⛔ | E2E (todo) | Engine không có dữ liệu profile |
| TC-E2E-082 | FE | ⚠️ | E2E: `TC-E2E-082 KL thị trường tăng đột biến: không gửi vượt KL còn lại` | VWAP của engine không dùng KL thị trường, không có trần tham gia; chưa có Risk |

### J. HUNT
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-090 | FE | ✅ | E2E: `TC-E2E-090 quét thanh khoản: tối đa 3 mức, mỗi mức 20.000 → chỉ 3 mức đầu, tổng 60.000` | HUNT với tham số tùy chọn `max_levels`; sổ lệnh lấy từ `quote.depth`. Giá 100.5 quy đổi thành 100.500 |
| TC-E2E-091 | FE | ✅ | E2E: `TC-E2E-091 giới hạn giá: mức thứ 3 ở 100.600 vượt giá tối đa → chỉ quét 30.000`. Liên quan DEMO: Scenario 4 | |
| TC-E2E-092 | FE | ✅ | E2E: `TC-E2E-092 không có thanh khoản trong khoảng chấp nhận: không sinh lệnh con, nhịp sau có thanh khoản thì quét`; `HUNT quét mức mà mãi không có thanh khoản: hết thời gian săn thì EXPIRED, không sinh lệnh con` | Chu kỳ thử là mỗi nhịp giả lập (1 giây) |
| TC-E2E-093 | FE | ⚠️ | E2E: `TC-E2E-093 hết thời gian săn, chính sách hủy: dừng săn, không sinh lệnh con`. Liên quan ENG: `HUNT chờ quá hạn thì hết hạn, không sinh lệnh con` | Tài liệu: cửa sổ 5 giây. Engine tính bằng phút (tối thiểu 1), test dùng 1 phút |

### K. Chọn giá lệnh con (Adaptive)
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-100 | FE | ⛔ | E2E (todo) | Chưa có Adaptive |
| TC-E2E-101 | FE | ⛔ | E2E (todo) | Chưa có Adaptive |
| TC-E2E-102 | FE | ⚠️ | E2E: `TC-E2E-102 giá lệnh con mua không vượt giá giới hạn của lệnh cha` | Đúng một cách hiển nhiên vì engine luôn đặt giá bằng giới hạn cha; chưa có bước "tính ra 101 rồi chặn về 100" |

### L. Giá arrival
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-110 | FE | ✅ | E2E: `TC-E2E-110 chụp Bid 99.900 / Last 100.000 / Ask 100.100 lúc ACTIVE, không cập nhật về sau`. Liên quan ENG: `tạo lệnh lưu arrival snapshot từ giá hiện tại` | |
| TC-E2E-111 | FE | ✅ | E2E: `TC-E2E-111 shortfall lệnh mua: arrival 100.000, giá BQ 100.300 → +300 (30 bps), bất lợi`. Liên quan DET: `bình quân theo KL, chênh lệch theo bps`, `cùng một chênh lệch thì lệnh bán có lợi, lệnh mua bất lợi` | |

### M. Risk trong lúc thuật toán chạy
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-120 | FE | ⛔ | E2E (todo) | Chưa có Risk |
| TC-E2E-121 | FE | ⚠️ | E2E: `TC-E2E-121 chạy lại sau khi hệ thống tạm dừng: còn lại 50.000, không chạy lại từ 100.000` | Dùng 2 lần Core từ chối thay cho Risk lỗi, vận hành mở lại thay cho Risk về PASS |

### N. Core từ chối
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-130 | FE | ⚠️ | FLT: `TC-E2E-130 từ chối một lần: Child REJECTED, lệnh cha vẫn chạy và sinh Child mới`, `TC-E2E-130 từ chối 2 lần liên tiếp: Parent PAUSED_SYSTEM, không sinh thêm Child`, `TC-E2E-130 giữa hai lần từ chối có Child được Core nhận thì không tạm dừng`, `TC-E2E-130 chỉ bơm được vào lệnh đang chạy` | Không lưu lý do từ chối cụ thể, xem mục Cần xác nhận |
| TC-E2E-131 | FE | ✅ | E2E: `TC-E2E-131 Core từ chối liên tục: không thử lại vô hạn, lệnh cha PAUSED_SYSTEM` | Xem mục Cần xác nhận |

### O. Core không phản hồi
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-140 | FE + BE | ✅ FE, ⏳ BE | FLT: `TC-E2E-140 hủy Child UNKNOWN rồi sinh đúng 1 Child mới`, `TC-E2E-140 kết cục cố định, không phụ thuộc số ngẫu nhiên (%s)`, `TC-E2E-140 đối soát ngay: hủy Child và sinh đúng 1 Child mới` | Tra Core thật theo `client_order_id`: chờ backend |
| TC-E2E-141 | FE + BE | ✅ FE, ⏳ BE | FLT: `TC-E2E-141 Child UNKNOWN vẫn tính là working, không gửi trùng trong lúc chờ`, `TC-E2E-141 giữ Child, đối soát về ACKNOWLEDGED, không sinh Child mới`, `TC-E2E-141 kết cục cố định, …`, `TC-E2E-141 Core đã nhận nhưng lệnh cha đã tạm dừng: …`, `TC-E2E-141 khớp tiếp sau đối soát: tổng KL không vượt total_qty`, `TC-E2E-141 đối soát ngay theo đúng kết cục đã định, …` | Bắt buộc chạy lại với Core thật trước khi nối: chờ backend |

### P. Sự kiện trùng / sai thứ tự
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-150 | FE | ✅ | FLT: `TC-E2E-150 bỏ qua bản lặp: KL không tăng, ghi event và Notification`, `TC-E2E-150 lệnh chưa có khớp thì báo lỗi, không ghi gì thêm`. Liên quan ENG: `cùng exchange_match_id gửi hai lần chỉ cộng một lần` | |
| TC-E2E-151 | FE + BE | ⛔ FE, ⏳ BE | E2E (todo) | Engine chưa có sequence của sự kiện |

### Q. Hủy lệnh
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-160 | FE | ✅ | E2E: `TC-E2E-160 hủy khi chưa có lệnh con: CANCELLED, không có lệnh hủy nào gửi Core`. Liên quan ENG: `Hủy: lệnh con và điều kiện bị hủy, lệnh chuyển CANCELLED` | |
| TC-E2E-161 | FE | ✅ | E2E: `TC-E2E-161 hủy khi có lệnh con đang chờ: CANCEL_PENDING → hủy lệnh con → CANCELLED, không sinh thêm`. Liên quan ENG: `Hủy khi còn Child UNKNOWN: giữ CANCEL_PENDING, nhịp sau đối soát rồi CANCELLED` | Xem mục Cần xác nhận |
| TC-E2E-162 | FE | 🔴 | E2E: `TC-E2E-162 khớp 4.000 trong lúc hủy: executed +4.000, CANCELLED, không mất phần khớp` | Xem mục Lệch |

### R. Tạm dừng / tiếp tục
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-170 | FE | ✅ | E2E: `TC-E2E-170 TWAP đang chạy bị tạm dừng: tới khoảng kế tiếp không sinh lệnh con`. Liên quan ENG: `Tạm dừng hủy lệnh con đang chờ, không khớp thêm; Tiếp tục sinh lại phần còn lại` | |
| TC-E2E-171 | FE | 🔴 | E2E: `TC-E2E-171 tiếp tục: tính lại các khoảng còn lại theo KL đã khớp, không chạy lại khoảng đã lỡ` | Xem mục Lệch |

### S. Dữ liệu thị trường lỗi
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-180 | FE | ✅ | E2E: `TC-E2E-180 giá trễ: Stop, Trailing, POV, VWAP, HUNT đều PAUSED_SYSTEM, không ra quyết định mới`. FLT: 6 test `TC-E2E-180 …` và 3 test `TC-E2E-180 ở tốc độ x%s: trễ đúng sau 5 giây thật` | Ngưỡng engine là 5 giây thật (tài liệu gốc: 2 giây). Adaptive chưa có |
| TC-E2E-181 | FE | ✅ | E2E: `TC-E2E-181 dữ liệu phục hồi: không dùng ảnh giá cũ, đánh giá lại theo giá mới` | |

### T. Phiên giao dịch
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-190 | FE | ✅ | E2E: `TC-E2E-190 hết phiên: không sinh lệnh con` | |
| TC-E2E-191 | FE | ✅ | E2E: `TC-E2E-191 phiên mở lại: thuật toán tính lại từ trạng thái mới`. Liên quan ENG: `MULTI_SESSION: mang phần còn lại sang phiên sau, …` | |
| TC-E2E-192 | FE | ⛔ | E2E (todo) | Chưa có trạng thái tạm ngừng của mã |

### U. Khởi động lại OMS
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-200 | BE (FE: F5) | ⏳ chờ backend | | Phần F5 có ENG nhóm `lưu và nạp lại trạng thái` |
| TC-E2E-201 | BE (FE: F5) | ⏳ chờ backend | | Như trên |
| TC-E2E-202 | BE (FE: F5) | ⏳ chờ backend | | Như trên. Lưu ý: TWAP của engine có cùng lệch với TC-062, TC-171 |

### V. Sửa lệnh cha
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-210 | FE | ✅ | E2E: `TC-E2E-210 tăng tổng KL 100.000 → 150.000 khi đã khớp 30.000: còn lại 120.000` | |
| TC-E2E-211 | FE | ✅ | E2E: `TC-E2E-211 sửa tổng KL 40.000 thấp hơn đã khớp 50.000: từ chối`. Liên quan ENG: `Sửa kiểm tra luật HOSE, không cho KL nhỏ hơn đã khớp cộng UNKNOWN` | |
| TC-E2E-212 | FE + BE | ✅ FE, ⏳ BE | E2E: `TC-E2E-212 (phần FE) hai yêu cầu cùng version 5: A thành công lên version 6, B báo xung đột`. Liên quan ENG: `Sửa sai version thì từ chối` | Hai yêu cầu đồng thời thật: chờ backend |

### W. Hoàn tất lệnh cha
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-220 | FE | ✅ | E2E: `TC-E2E-220 khớp đủ 100.000: còn lại 0, COMPLETED, không sinh lệnh con` | |
| TC-E2E-221 | FE | ✅ | E2E: `TC-E2E-221 đã khớp 95.000, đang chờ 5.000, thuật toán muốn thêm 10.000: được phép 0, không sinh`. Liên quan ENG: nhóm `allowed = total − executed − working` | |

### X. Báo cáo
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-230 | FE | ✅ | E2E: `TC-E2E-230 giá bình quân: 5.000 @100.000 và 10.000 @101.000` | |
| TC-E2E-231 | FE | ✅ | E2E: `TC-E2E-231 đối soát cha / con: executed của lệnh cha = tổng KL các lần khớp hợp lệ`. Liên quan ENG: `cả 11 loại lệnh chạy hết nhiều ngày giả lập vẫn giữ đúng luật (seed %i)` | |
| TC-E2E-232 | FE | ✅ | E2E: `TC-E2E-232 tỷ lệ tham gia thực tế: OMS khớp 80.000 trên KL thị trường 1.000.000 = 8%`. Liên quan: `utils/execQuality.test.ts`, DEMO: Scenario 3 | Dùng chung `getParticipation` với báo cáo hiệu quả thực hiện |

### Y. Nhật ký kiểm toán
| Mã | Phạm vi | Trạng thái | Test | Ghi chú |
|---|---|---|---|---|
| TC-E2E-240 | FE | ⚠️ 🔴 | E2E: `TC-E2E-240 tạo, sửa, tạm dừng, tiếp tục, hủy: ghi người làm, thời điểm, kênh, giá trị cũ, giá trị mới` (xanh); `TC-E2E-240 mỗi thao tác của người dùng ghi kèm request id` (🔴) | Xem mục Lệch |
| TC-E2E-241 | FE | ⚠️ | E2E: `TC-E2E-241 Iceberg sinh lệnh con: lưu strategy, chu kỳ, KL và giá tính ra, thời điểm quyết định` | Chưa lưu "trạng thái đầu vào" (executed, working, allowed lúc quyết định) |

### Kịch bản E2E đầy đủ (không tính vào tỷ lệ)
| Mã | Trạng thái | Test | Ghi chú |
|---|---|---|---|
| Scenario 1 | ✅ | E2E: `Scenario 1 Iceberg thành công: 50.000, có một lệnh con khớp 5.000 rồi hủy phần còn lại` | |
| Scenario 2 | ⚠️ | E2E: `Scenario 2 Stop → Iceberg (Stop Limit bán có slice_qty): …`; DEMO: Scenario 2 | Stop Limit có tham số tùy chọn `slice_qty`. Tài liệu ghi lệnh mua "giá ≤ 95"; Stop của engine kích hoạt lệnh mua khi giá tăng, nên dùng lệnh bán |
| Scenario 3 | ⚠️ | E2E (todo, phần Adaptive); DEMO: Scenario 3 (phần POV) | Chưa có Adaptive. Phần POV chạy trong Chế độ Demo, kiểm tỷ lệ tham gia ≤ trần |
| Scenario 4 | ✅ | E2E: `Scenario 4: quét xong thì phần còn lại đặt bị động một lệnh LO tại giá mua tốt nhất, chặn bởi giá tối đa`; DEMO: Scenario 4 | |
| Scenario 5 | ✅ FE, ⏳ BE | E2E: `Scenario 5 Core mất ACK: UNKNOWN → đối soát → khớp → Iceberg chạy tiếp, không có lệnh trùng`. Liên quan FLT: `TC-E2E-141 khớp tiếp sau đối soát: …` | Bắt buộc chạy lại trong UAT với Core thật |
| Scenario 6 | ⚠️ FE, ⏳ BE | DEMO: Scenario 6 | FE mô phỏng: ghi trạng thái engine ra JSON, xóa bộ nhớ, nạp lại, nhận báo khớp bị lỡ. Với backend thật phải chạy lại (CSDL, tra Core lúc khởi động) |
