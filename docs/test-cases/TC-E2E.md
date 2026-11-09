# Bộ test case E2E của OMS (bản tóm tắt)

> Tóm tắt theo bộ TestCase E2E nội bộ (10/10/2026), viết lại ngắn gọn để đối chiếu test tự động.
> Tên test tự động đặt theo mã: `TC-E2E-<số> <mô tả>` (Vitest) hoặc `test_tc_e2e_<số>_<mô tả>` (pytest).
> Cột **Phạm vi**: FE = kiểm được trong frontend + engine giả lập; BE = chỉ kiểm được khi có backend / Core thật.
> Số liệu giá trong tài liệu gốc là ví dụ trừu tượng (100, 110…); khi viết test cho HOSE, quy đổi sang giá hợp lệ theo bước giá.

## Dữ liệu chuẩn dùng chung
- Mã FPT, giá tham chiếu ví dụ 100.000, trần 107.000, sàn 93.000, lô 100.
- Risk mặc định = PASS, phiên mặc định = khớp lệnh liên tục.

## A. Vòng đời lệnh cha
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-001 | Tạo lệnh cha thành công | Mua FPT 100.000 CP, Iceberg slice 10.000, giá giới hạn hợp lệ | Lệnh ACTIVE, executed 0, còn lại 100.000; **không** gửi cả 100.000 xuống Core một lần | FE |
| TC-E2E-002 | Gửi trùng yêu cầu tạo | 2 yêu cầu cùng `client_request_id` | Chỉ có 1 lệnh cha; yêu cầu thứ hai nhận lại lệnh đã tạo | FE |
| TC-E2E-003 | Tham số không hợp lệ | KL âm, hoặc slice > tổng KL | Không tạo lệnh, không gọi Risk, không gọi Core | FE |
| TC-E2E-004 | Risk từ chối ngay lúc tạo | Risk trả "tài khoản bị khóa" | Lệnh bị từ chối, không sinh lệnh con | FE |

## B. Lệnh Stop
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-010 | Chưa chạm ngưỡng | Bán FPT, kích hoạt 95.000; giá thị trường 98.000 | Điều kiện vẫn ACTIVE, không có lệnh con | FE |
| TC-E2E-011 | Chạm ngưỡng | Giá về 95.000 | Điều kiện TRIGGERED, sinh 1 lệnh con | FE |
| TC-E2E-012 | Chỉ kích hoạt một lần | Giá tiếp tục 94.000 → 93.000 → 92.000 | Không sinh lệnh con thứ hai | FE |
| TC-E2E-013 | Risk lỗi tại lúc kích hoạt | Risk đổi sang "không đủ chứng khoán" trước khi chạm ngưỡng | Điều kiện TRIGGERED, kết quả Risk được lưu, không gửi Core, lệnh cha PAUSED_SYSTEM | FE |

## C. Trailing Stop
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-020 | Cập nhật giá tốt nhất | Giá lên 120, khoảng trailing 10 | best = 120, ngưỡng = 110 | FE |
| TC-E2E-021 | Giá giảm, best không giảm | Giá về 115 | best vẫn 120, ngưỡng vẫn 110 | FE |
| TC-E2E-022 | Kích hoạt | Giá về 110 | Điều kiện TRIGGERED, sinh 1 lệnh con bán | FE |

## D. OCO
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-030 | Chốt lời thắng | TP 110, SL 90; giá lên 110 | TP TRIGGERED, SL CANCELLED trong cùng một lần cập nhật; chỉ 1 lệnh con bán | FE |
| TC-E2E-031 | Cắt lỗ thắng | Giá về 90 | SL TRIGGERED, TP CANCELLED | FE |
| TC-E2E-032 | Hai sự kiện gần như đồng thời | Sự kiện TP và SL đến sát nhau | Chỉ một nhánh thắng; tuyệt đối không có 2 lệnh con thoát | FE + BE |

## E. Bracket
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-040 | Lệnh vào chưa khớp | Mua 10.000, TP 110, SL 90; Core nhận nhưng chưa khớp; giá chạm 110 | TP chưa bật, không có lệnh thoát | FE |
| TC-E2E-041 | Lệnh vào khớp một phần | Khớp 4.000 | KL được phép thoát = 4.000; nếu TP kích hoạt thì lệnh thoát ≤ 4.000 | FE |
| TC-E2E-042 | Lệnh vào khớp thêm | Khớp thêm 6.000 | KL được phép thoát = 10.000 | FE |

## F. Iceberg
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-050 | Iceberg cơ bản | Tổng 100.000, slice 10.000 | Lệnh con #1 = 10.000; khớp đủ thì sinh #2 = 10.000 | FE |
| TC-E2E-051 | Lệnh con khớp một phần | #1 khớp 6.000, phần còn lại bị hủy | executed 6.000, còn lại 94.000; lệnh con kế tiếp tính theo số đã khớp thật | FE |
| TC-E2E-052 | Slice cuối | Tổng 25.000, slice 10.000 | Thứ tự 10.000 → 10.000 → 5.000; không được 3 × 10.000 | FE |
| TC-E2E-053 | Tuần tự | Lệnh con #1 đã được nhận nhưng chưa kết thúc | Chưa sinh #2 | FE |
| TC-E2E-054 | Iceberg ngẫu nhiên | Slice 10.000 ±20% (8.000–12.000) | Mỗi lệnh con trong khoảng; tổng không vượt lệnh cha | FE |

## G. TWAP
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-060 | TWAP bình thường | 100.000 chia 10 khoảng hợp lệ | Khoảng 10.000 mỗi khoảng | FE |
| TC-E2E-061 | Nghỉ trưa | Một khoảng rơi vào giờ nghỉ | Không sinh lệnh con; lịch dời sang phiên hợp lệ | FE |
| TC-E2E-062 | Khớp thiếu | Kế hoạch 10.000, thực khớp 6.000 | 4.000 thiếu được rải vào các khoảng còn lại | FE |
| TC-E2E-063 | Hết giờ | Đến giờ kết thúc còn 20.000, chính sách hủy phần còn lại | Không sinh thêm lệnh con; lệnh cha kết thúc (EXPIRED) | FE |

## H. POV
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-070 | Tính mục tiêu | Tham gia 10%; KL thị trường 1.000.000; đã khớp 80.000; đang chờ 5.000 | Cần sinh thêm 15.000 | FE |
| TC-E2E-071 | KL thị trường không đổi | Không có KL mới, chỉ đồng hồ chạy | Không sinh thêm lệnh con | FE |
| TC-E2E-072 | Trần tham gia | Tối đa 10% | Không để tỷ lệ tham gia thực tế vượt giới hạn | FE |

## I. VWAP
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-080 | Mục tiêu theo profile | 1.000.000; profile lũy kế 30%; đã khớp 250.000; đang chờ 20.000 | Mục tiêu 300.000, cần sinh thêm 30.000 | FE |
| TC-E2E-081 | Thiếu profile | Không có dữ liệu profile | Không ACTIVE, hoặc chuyển TWAP nếu cấu hình cho phép, có ghi nhật ký | FE |
| TC-E2E-082 | KL thị trường tăng đột biến | KL tăng mạnh | Tính lại nhưng vẫn tôn trọng trần tham gia, KL còn lại, Risk | FE |

## J. HUNT
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-090 | Quét thanh khoản | Mua 100.000, giá tối đa 100.5, tối đa 3 mức giá | Chỉ xét 3 mức đầu, tối đa 60.000 | FE |
| TC-E2E-091 | Giới hạn giá | Mức thứ 3 ở 100.6 > giá tối đa | Tối đa 30.000; không quét mức 100.6 | FE |
| TC-E2E-092 | Không có thanh khoản | Không có giá bán trong khoảng chấp nhận | Không sinh lệnh con; đánh giá lại sau chu kỳ thử | FE |
| TC-E2E-093 | Hết thời gian săn | Cửa sổ 5 giây, chính sách hủy khi hết hạn | Dừng săn, không sinh lệnh con | FE |

## K. Chọn giá lệnh con (Adaptive)
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-100 | Mua bị động | Bid 99.5, Ask 100, giới hạn 101 | Giá lệnh con gần Bid, không ăn ngay Ask | FE |
| TC-E2E-101 | Mua chủ động | Cùng thị trường | Được đặt tại Ask nếu không vượt giới hạn lệnh cha | FE |
| TC-E2E-102 | Chặn bởi giới hạn cha | Tính ra 101, giới hạn cha 100 | Giá lệnh con ≤ 100 | FE |

## L. Giá arrival
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-110 | Chụp giá arrival | Lệnh chuyển sang ACTIVE khi Bid 99.9 / Last 100 / Ask 100.1 | Lưu đúng 3 giá; không cập nhật lại về sau | FE |
| TC-E2E-111 | Shortfall | Mua, arrival 100, giá BQ 100.3 | Shortfall +0.3, đúng dấu (bất lợi) | FE |

## M. Risk trong lúc thuật toán chạy
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-120 | Risk lỗi giữa chừng | Iceberg đang chạy, đã khớp 50.000, Risk chuyển sang lỗi | Không sinh lệnh con mới; lệnh cha PAUSED_SYSTEM | FE |
| TC-E2E-121 | Risk phục hồi | Risk về PASS, vận hành / khách cho chạy lại | Nạp lại trạng thái, còn lại 50.000, không chạy lại từ 100.000 | FE |

## N. Core từ chối
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-130 | Từ chối nghiệp vụ | Core trả "giá không hợp lệ" | Lệnh con REJECTED, lưu lý do, không cộng executed; xử lý theo chính sách từ chối | FE |
| TC-E2E-131 | Không đủ số dư | Core trả "không đủ số dư" | Không thử lại vô hạn; lệnh cha PAUSED_SYSTEM | FE |

## O. Core không phản hồi
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-140 | Timeout, Core **chưa** tạo lệnh | Gửi đi, Core không nhận | Lệnh con UNKNOWN → tra Core trả "không tìm thấy" → mới được gửi lại theo chính sách | FE + BE |
| TC-E2E-141 | Timeout, Core **đã** tạo lệnh | Core tạo lệnh nhưng mất ACK | UNKNOWN → tra theo `client_order_id` → lệnh tồn tại → đối soát; **không gửi lần hai**. Bắt buộc trước khi nối Core thật | FE + BE |

## P. Sự kiện trùng / sai thứ tự
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-150 | Báo khớp trùng | Cùng mã khớp M0001, 5.000 gửi 2 lần | Ghi 1 lần; executed chỉ +5.000 | FE |
| TC-E2E-151 | Sự kiện sai thứ tự | Nhận sequence 102 rồi mới tới 101 | Không quay lùi trạng thái vì sự kiện cũ | FE + BE |

## Q. Hủy lệnh
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-160 | Hủy khi không có lệnh con | — | Lệnh cha CANCELLED, không gọi Core hủy | FE |
| TC-E2E-161 | Hủy khi có lệnh con đang chờ | — | CANCEL_PENDING → dừng thuật toán → hủy lệnh con → chờ xác nhận → đối soát khớp → CANCELLED | FE |
| TC-E2E-162 | Khớp trong lúc hủy | Lệnh con 10.000, đang hủy thì khớp 4.000 | executed +4.000, tính lại còn lại, CANCELLED, không mất phần khớp | FE |

## R. Tạm dừng / tiếp tục
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-170 | Tạm dừng thuật toán | TWAP đang chạy, khách tạm dừng, tới khoảng kế tiếp | Không sinh lệnh con | FE |
| TC-E2E-171 | Tiếp tục | Khách tiếp tục | Đọc KL đã khớp thật, tính lại các khoảng còn lại, không chạy lại khoảng cũ | FE |

## S. Dữ liệu thị trường lỗi
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-180 | Dữ liệu giá cũ | Giá cũ hơn ngưỡng (gốc: 2 giây) | Stop, Trailing, POV, VWAP, HUNT, Adaptive không ra quyết định mới; lệnh PAUSED_SYSTEM | FE |
| TC-E2E-181 | Dữ liệu phục hồi | Giá mới về | Không dùng ảnh giá cũ; nạp giá mới rồi mới đánh giá lại | FE |

## T. Phiên giao dịch
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-190 | Hết phiên | Phiên đóng | Không sinh lệnh con | FE |
| TC-E2E-191 | Phiên mở lại | Về khớp liên tục | Thuật toán tính lại từ trạng thái mới | FE |
| TC-E2E-192 | Mã bị tạm ngừng | FPT bị tạm ngừng giao dịch | Thuật toán tạm dừng, không sinh lệnh con | FE |

## U. Khởi động lại OMS
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-200 | Restart khi Iceberg đang chạy | Đã khớp 40.000, lệnh con #5 đang chờ | Nạp lệnh, tra #5 trên Core, đối soát, chạy tiếp; không sinh trùng #5 | BE (FE: mô phỏng bằng F5) |
| TC-E2E-201 | Restart Trailing | best 120, ngưỡng 110; giá 111 sau restart | best vẫn 120, ngưỡng vẫn 110 | BE (FE: F5) |
| TC-E2E-202 | Restart TWAP | Xong 5/10 khoảng, khớp 45.000 | Không chạy lại 5 khoảng cũ; 55.000 chia cho các khoảng còn lại | BE (FE: F5) |

## V. Sửa lệnh cha
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-210 | Tăng tổng KL | Tổng 100.000, đã khớp 30.000, sửa thành 150.000 | Còn lại 120.000 (nếu được phép) | FE |
| TC-E2E-211 | Tổng KL thấp hơn đã khớp | Đã khớp 50.000, sửa thành 40.000 | Từ chối sửa | FE |
| TC-E2E-212 | Sửa đồng thời | 2 yêu cầu cùng version 5 | Yêu cầu A thành công (version 6), B báo xung đột version | FE + BE |

## W. Hoàn tất lệnh cha
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-220 | Hoàn tất chính xác | Tổng 100.000, khớp đủ | executed 100.000, còn lại 0, COMPLETED, không sinh lệnh con | FE |
| TC-E2E-221 | Chống khớp vượt | Đã khớp 95.000, đang chờ 5.000, thuật toán muốn sinh 10.000 | Được phép = 0, không sinh lệnh con | FE |

## X. Báo cáo
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-230 | Giá bình quân | 5.000 @100 và 10.000 @101 | BQ = (5.000×100 + 10.000×101) / 15.000 | FE |
| TC-E2E-231 | Đối soát cha / con | — | executed của lệnh cha = tổng KL các lần khớp hợp lệ | FE |
| TC-E2E-232 | Tỷ lệ tham gia thực tế | KL thị trường 1.000.000, OMS khớp 80.000 | 8% | FE |

## Y. Nhật ký kiểm toán
| Mã | Tên | Bối cảnh | Kết quả mong đợi | Phạm vi |
|---|---|---|---|---|
| TC-E2E-240 | Thao tác của người dùng | Tạo, sửa, tạm dừng, tiếp tục, hủy | Mỗi thao tác ghi: người làm, thời điểm, kênh, giá trị cũ, giá trị mới, request id | FE |
| TC-E2E-241 | Quyết định của hệ thống | Iceberg sinh lệnh con | Lưu: strategy, chu kỳ, trạng thái đầu vào, KL và giá tính ra, thời điểm quyết định | FE |

## Kịch bản E2E đầy đủ
| Mã | Tên | Luồng | Kết quả cuối |
|---|---|---|---|
| Scenario 1 | Iceberg thành công | Tạo 50.000 Iceberg → Risk PASS → lệnh con 10.000 khớp đủ → lệnh con kế khớp 5.000, hủy phần còn lại → tiếp tục tới đủ 50.000 | COMPLETED, khớp 50.000, còn lại 0, không còn lệnh con chờ |
| Scenario 2 | Stop → Iceberg | Mua 100.000, điều kiện giá ≤ 95; giá 100 không làm gì; giá 95 kích hoạt → bật Iceberg slice 10.000 | Điều kiện kích hoạt một lần, Iceberg chạy đúng slice |
| Scenario 3 | POV + Adaptive | Mua 200.000, POV 10%, giới hạn 101; KL thị trường 500.000 → mục tiêu 50.000; khớp 30.000; KL lên 800.000 → mục tiêu 80.000 | Giá lệnh con theo Bid/Ask, tính đúng khoảng thiếu |
| Scenario 4 | HUNT + phần còn lại | Mua 100.000, giá tối đa 100.5, 3 mức, quét được 60.000 | 60.000 đi chủ động; 40.000 còn lại đặt bị động sau cửa sổ săn |
| Scenario 5 | Core mất ACK + đối soát | Iceberg → lệnh con 10.000 → Core tạo nhưng mất ACK → UNKNOWN → tra Core → đối soát → khớp → Iceberg chạy tiếp | Không có lệnh trùng. Bắt buộc trong UAT trước khi nối Core thật |
| Scenario 6 | OMS sập | POV đã khớp 30.000, đang chờ 10.000; OMS tắt; Core khớp 5.000 trong lúc tắt; OMS bật lại | Phát hiện 5.000, executed = 35.000, tính lại POV, chạy tiếp, không mất phần khớp |
