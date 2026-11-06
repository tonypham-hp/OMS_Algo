import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useOrderNotifications } from '@/hooks/useOrders'
import { RepriceOrderDialog } from '@/pages/OrderBook/RepriceOrderDialog'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { getAllowedActions, isRepriceRequired } from '@/utils/orderActions'
import { getPauseReason } from './pauseReason'

/** Khung đầu trang của lệnh PAUSED_SYSTEM: lý do tạm dừng, và nút Sửa giá nếu lý do là giá ngoài biên độ. */
export function PausedOrderBanner({ order }: { order: ParentOrder }) {
  const session = useMarketStore((state) => state.session)
  const notifications = useOrderNotifications(order.parent_order_id, true)
  const [isRepricing, setIsRepricing] = useState(false)

  const reason = getPauseReason(notifications.data ?? [])
  const canReprice = isRepriceRequired(order.status, order.reason_code)
  const edit = getAllowedActions(order.status, session, order.reason_code).edit

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/15 p-3"
    >
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-medium text-amber-300">Hệ thống đang tạm dừng lệnh này</p>
        <p className="mt-1 text-sm">
          {notifications.error
            ? `Không tải được lý do: ${notifications.error.message}`
            : notifications.isPending
              ? 'Đang tải lý do...'
              : (reason ?? 'Chưa có thông báo về lý do tạm dừng.')}
        </p>
      </div>
      {canReprice && (
        // Nút bị tắt không nhận sự kiện chuột, nên đặt title ở thẻ bọc ngoài để vẫn hiện được lý do.
        <span title={edit.reason}>
          <Button disabled={!edit.allowed} onClick={() => setIsRepricing(true)}>
            Sửa giá
          </Button>
        </span>
      )}
      {canReprice && !edit.allowed && <p className="basis-full text-xs text-amber-300">{edit.reason}.</p>}
      {isRepricing && <RepriceOrderDialog order={order} onClose={() => setIsRepricing(false)} />}
    </div>
  )
}
