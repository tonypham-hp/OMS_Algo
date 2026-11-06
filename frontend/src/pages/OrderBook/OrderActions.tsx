import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

export function OrderActions({ order, isBusy, onEdit, onCancel, onPause, onResume }: OrderActionsProps) {
  const session = useMarketStore((state) => state.session)
  const actions = getAllowedActions(order.status, session)
  const isPaused = order.status === 'PAUSED_USER' || order.status === 'PAUSED_SYSTEM'

  const items: Array<{ label: string; availability: ActionAvailability; run: () => void }> = [
    { label: 'Sửa', availability: actions.edit, run: () => onEdit(order) },
    { label: 'Hủy', availability: actions.cancel, run: () => onCancel(order) },
    isPaused
      ? { label: 'Tiếp tục', availability: actions.resume, run: () => onResume(order) }
      : { label: 'Tạm dừng', availability: actions.pause, run: () => onPause(order) },
  ]
  const hasAllowedAction = items.some((item) => item.availability.allowed)

  return (
    <div className="flex justify-end">
      {/* modal={false}: menu dạng modal khóa trang lúc đóng, làm hộp thoại Sửa, Hủy mở ngay sau đó bị kẹt. */}
      <DropdownMenu modal={false}>
        {/* Nút bị tắt không nhận sự kiện chuột, nên đặt title ở thẻ bọc ngoài để vẫn hiện được lý do. */}
        <span title={hasAllowedAction ? undefined : items[0].availability.reason}>
          <DropdownMenuTrigger asChild>
            <Button
              size="xs"
              variant="outline"
              disabled={isBusy || !hasAllowedAction}
              aria-label={`Hành động cho lệnh ${order.parent_order_id}`}
            >
              ⋯
            </Button>
          </DropdownMenuTrigger>
        </span>
        <DropdownMenuContent align="end" className="w-56">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.label}
              disabled={!item.availability.allowed}
              className="flex-col items-start gap-0"
              onSelect={item.run}
            >
              <span>{item.label}</span>
              {item.availability.reason && <span className="text-xs">{item.availability.reason}</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
