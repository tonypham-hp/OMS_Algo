import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSymbolSession } from '@/hooks/useSymbolSession'
import type { ParentOrder } from '@/types'
import { getOrderActionItems } from '@/utils/orderActions'

interface OrderActionsProps {
  order: ParentOrder
  isBusy: boolean
  onEdit: (order: ParentOrder) => void
  onCancel: (order: ParentOrder) => void
  onPause: (order: ParentOrder) => void
  onResume: (order: ParentOrder) => void
}

export function OrderActions({ order, isBusy, onEdit, onCancel, onPause, onResume }: OrderActionsProps) {
  // Phiên theo mã: mã hạn chế có lượt khớp định kỳ, khóa sửa, hủy 5 phút cuối lượt.
  const { session, rules, phase } = useSymbolSession(order.symbol)
  const items = getOrderActionItems(order.status, session, order.reason_code, rules, phase)
  const handlers = { edit: onEdit, cancel: onCancel, pause: onPause, resume: onResume }
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
              onSelect={() => handlers[item.action](order)}
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
