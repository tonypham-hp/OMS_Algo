import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCancelOrder } from '@/hooks/useOrders'
import { formatNumber } from '@/lib/format'
import type { ParentOrder } from '@/types'

interface CancelOrderDialogProps {
  order: ParentOrder
  onClose: () => void
}

export function CancelOrderDialog({ order, onClose }: CancelOrderDialogProps) {
  const cancelOrder = useCancelOrder()

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hủy lệnh {order.symbol}?</DialogTitle>
          <DialogDescription>
            {order.parent_order_id}. Đã khớp {formatNumber(order.executed_qty)}/{formatNumber(order.total_qty)} CP.
            Phần chưa khớp sẽ bị hủy và không khôi phục lại được.
          </DialogDescription>
        </DialogHeader>
        {cancelOrder.error && (
          <p role="alert" className="text-destructive text-sm">
            {cancelOrder.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={cancelOrder.isPending} onClick={onClose}>
            Quay lại
          </Button>
          <Button
            variant="destructive"
            disabled={cancelOrder.isPending}
            onClick={() => cancelOrder.mutate(order.parent_order_id, { onSuccess: onClose })}
          >
            {cancelOrder.isPending ? 'Đang hủy...' : 'Xác nhận hủy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
