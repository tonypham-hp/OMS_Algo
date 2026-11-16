export interface TourStep {
  /** data-demo-id của phần tử được tô sáng; nhiều phần tử thì tô khung bao quanh cả nhóm. */
  targets: string[]
  /** Màn phải mở trước khi tô sáng (phần tử chỉ có ở màn đó). */
  path?: string
  title: string
  body: string
}

/** Tour 5 bước cho lần đầu đăng nhập. Mỗi bước 1–2 câu, dùng các data-demo-id có sẵn. */
export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    targets: ['sidebar'],
    title: 'Thanh bên',
    body: 'Mọi màn hình bạn được dùng nằm ở đây, theo vai trò. Cuối thanh có trang Thuật ngữ để tra nghĩa các từ chuyên môn.',
  },
  {
    targets: ['session-status'],
    title: 'Đồng hồ phiên và nút tua',
    body: 'Cho biết đang ở phiên nào và giờ giả lập. Bấm x1, x10, x60 để tua nhanh thời gian khi muốn xem lệnh chạy.',
  },
  {
    targets: ['attention-card'],
    path: '/trung-tam',
    title: 'Lệnh cần chú ý',
    body: 'Lệnh có lệnh con chưa rõ trạng thái, bị từ chối hoặc bị hệ thống tạm dừng hiện ở đây. Bấm một dòng để xem vì sao và cách xử lý.',
  },
  {
    targets: ['nav-dat-lenh', 'nav-mau-chien-luoc'],
    title: 'Đặt lệnh và mẫu chiến lược',
    body: 'Đặt lệnh thuật toán ở màn Đặt lệnh, hoặc chọn một mẫu có sẵn để điền nhanh tham số rồi chỉnh lại.',
  },
  {
    targets: ['notification-bell'],
    title: 'Thông báo',
    body: 'Chuông báo khi lệnh kích hoạt, khớp xong, bị từ chối hoặc tạm dừng. Bấm Ctrl K bất cứ lúc nào để tìm nhanh lệnh, mã, màn hình.',
  },
]
