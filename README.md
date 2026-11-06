# OMS Algo

Hệ thống quản lý lệnh nâng cao (Advanced Order Management System) cho sàn HOSE, tổ chức theo dạng monorepo.

> Dự án đang ở giai đoạn khởi tạo: mới có khung thư mục, chưa có code nghiệp vụ.

## Cấu trúc thư mục

```text
OMS_Algo/
├── backend/          # Dịch vụ OMS chính (Python): API, logic quản lý lệnh
├── simulators/       # Giả lập hệ thống bên ngoài để test
├── frontend/         # Giao diện web đặt và theo dõi lệnh (Node)
├── docs/             # Tài liệu dự án
│   ├── adr/          # Architecture Decision Records
│   └── test-cases/   # Kịch bản kiểm thử
├── scripts/          # Script tiện ích cho phát triển và vận hành
└── .claude/          # Cấu hình Claude Code dùng chung
```

## Cách chạy

