// Cầu nối Chế độ Demo ↔ Bàn làm việc (Đợt 10A, kịch bản 13). Không phụ thuộc React để chạy được trong Vitest.
// Trang Bàn làm việc đăng ký cầu nối khi đã sẵn sàng; thao tác tới trước lúc đó được xếp hàng và chạy khi đăng ký.
// Chạy headless (Vitest) không có trang: các thao tác giao diện bị bỏ qua, phần dữ liệu (đặt lệnh) vẫn chạy qua engine.

import type { OrderFormValues } from '@/pages/PlaceOrder/orderSchema'

export interface WorkspaceDemoBridge {
  /** Dựng bố cục mẫu. */
  preset: (preset: 'basic' | 'pro') => void
  /** Như bấm phím B / S. */
  openTicket: (side: 'BUY' | 'SELL') => void
  /** Điền phiếu lệnh của nhóm 1 (chưa gửi). */
  fillTicket: (values: Partial<OrderFormValues>) => void
  /** Làm trống phiếu lệnh của nhóm 1 (sau khi đã đặt lệnh). */
  resetTicket: () => void
  /** Mở lệnh ở panel Chi tiết của nhóm 1. */
  openOrder: (orderId: string) => void
}

type Operation = (bridge: WorkspaceDemoBridge) => void

let bridge: WorkspaceDemoBridge | null = null
let queue: Operation[] = []

/** Trang Bàn làm việc gọi khi sẵn sàng (null khi rời trang). Chạy các thao tác đang chờ. */
export function setWorkspaceDemoBridge(next: WorkspaceDemoBridge | null) {
  bridge = next
  if (!next) return
  const pending = queue
  queue = []
  for (const operation of pending) operation(next)
}

/** Chạy ngay nếu đã có trang, không thì chờ tới khi trang đăng ký (màn vừa được điều hướng tới). */
export function withWorkspace(operation: Operation) {
  if (bridge) operation(bridge)
  else queue.push(operation)
}

/** Bỏ các thao tác đang chờ (bắt đầu / thoát Demo). */
export function clearWorkspaceDemoQueue() {
  queue = []
}
