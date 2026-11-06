import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePauseOrder, useResumeOrder } from '@/hooks/useOrders'
import { CancelOrderDialog } from '@/pages/OrderBook/CancelOrderDialog'
import { EditOrderDialog } from '@/pages/OrderBook/EditOrderDialog'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { getOrderActionItems, isRepriceRequired, isTerminalStatus, type OrderAction } from '@/utils/orderActions'

/**
 * Các nút Sửa, Hủy, Tạm dừng, Tiếp tục của lệnh. Lệnh cần sửa giá đã có nút Sửa giá ở khung tạm dừng,
 * nên không hiện nút Sửa ở đây nữa. Lệnh đã kết thúc không còn hành động nào.
 */
export function OrderDetailActions({ order }: { order: ParentOrder }) {
  const session = useMarketStore((state) => state.session)
  const pauseOrder = usePauseOrder()
  const resumeOrder = useResumeOrder()
  // Giữ bản chụp lúc mở form: nếu lấy lệnh mới nhất, version đổi theo và mất tác dụng phát hiện sửa trùng.
  const [editing, setEditing] = useState<ParentOrder | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  if (isTerminalStatus(order.status)) return null

  const handlers: Record<OrderAction, () => void> = {
    edit: () => setEditing(order),
    cancel: () => setIsCancelling(true),
    pause: () => pauseOrder.mutate(order.parent_order_id),
    resume: () => resumeOrder.mutate(order.parent_order_id),
  }
  const isBusy = pauseOrder.isPending || resumeOrder.isPending
  const error = pauseOrder.error?.message ?? resumeOrder.error?.message
  const items = getOrderActionItems(order.status, session, order.reason_code).filter(
    (item) => !(item.action === 'edit' && isRepriceRequired(order.status, order.reason_code)),
  )

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {items.map((item) => (
          // Nút bị tắt không nhận sự kiện chuột, nên đặt title ở thẻ bọc ngoài để vẫn hiện được lý do.
          <span key={item.action} title={item.availability.reason}>
            <Button
              size="sm"
              variant={item.action === 'cancel' ? 'destructive' : 'outline'}
              disabled={isBusy || !item.availability.allowed}
              onClick={handlers[item.action]}
            >
              {item.label}
            </Button>
          </span>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {editing && <EditOrderDialog key={editing.version} order={editing} onClose={() => setEditing(null)} />}
      {isCancelling && <CancelOrderDialog order={order} onClose={() => setIsCancelling(false)} />}
    </div>
  )
}
