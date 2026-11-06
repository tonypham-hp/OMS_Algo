import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { getAllowedActions, type ActionAvailability } from '@/utils/orderActions'

interface OrderActionsProps {
  order: ParentOrder
  isBusy: boolean
  onEdit: (order: ParentOrder) => void
  onCancel: (order: ParentOrder) => void
  onPause: (order: ParentOrder) => void
  onResume: (order: ParentOrder) => void
}

function ActionButton({
  availability,
  isBusy,
  onClick,
  children,
}: {
  availability: ActionAvailability
  isBusy: boolean
  onClick: () => void
  children: ReactNode
}) {
  // Nút bị tắt không nhận sự kiện chuột, nên đặt title ở thẻ bọc ngoài để vẫn hiện được lý do.
  return (
    <span title={availability.reason}>
      <Button size="xs" variant="outline" disabled={!availability.allowed || isBusy} onClick={onClick}>
        {children}
      </Button>
    </span>
  )
}

export function OrderActions({ order, isBusy, onEdit, onCancel, onPause, onResume }: OrderActionsProps) {
  const session = useMarketStore((state) => state.session)
  const actions = getAllowedActions(order.status, session)
  const isPaused = order.status === 'PAUSED_USER' || order.status === 'PAUSED_SYSTEM'

  return (
    <div className="flex justify-end gap-1">
      <ActionButton availability={actions.edit} isBusy={isBusy} onClick={() => onEdit(order)}>
        Sửa
      </ActionButton>
      <ActionButton availability={actions.cancel} isBusy={isBusy} onClick={() => onCancel(order)}>
        Hủy
      </ActionButton>
      {isPaused ? (
        <ActionButton availability={actions.resume} isBusy={isBusy} onClick={() => onResume(order)}>
          Tiếp tục
        </ActionButton>
      ) : (
        <ActionButton availability={actions.pause} isBusy={isBusy} onClick={() => onPause(order)}>
          Tạm dừng
        </ActionButton>
      )}
    </div>
  )
}
