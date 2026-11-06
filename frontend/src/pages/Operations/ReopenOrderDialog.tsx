import { useState } from 'react'
import { FieldError } from '@/components/FieldError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReopenOrder } from '@/hooks/useOperations'
import { formatNumber } from '@/lib/format'
import type { ParentOrder } from '@/types'

interface ReopenOrderDialogProps {
  order: ParentOrder
  onClose: () => void
}

/** Vận hành mở lại lệnh PAUSED_SYSTEM: phải nhập lý do rồi mới xác nhận được. */
export function ReopenOrderDialog({ order, onClose }: ReopenOrderDialogProps) {
  const reopen = useReopenOrder()
  const [reason, setReason] = useState('')
  const [isTouched, setIsTouched] = useState(false)
  const isEmpty = reason.trim() === ''

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mở lại lệnh {order.symbol}?</DialogTitle>
          <DialogDescription>
            {order.parent_order_id}. Đã khớp {formatNumber(order.executed_qty)}/{formatNumber(order.total_qty)} CP.
            Lệnh sẽ chạy tiếp và sinh lệnh con cho phần còn lại.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reopen_reason">Lý do mở lại</Label>
          <Input
            id="reopen_reason"
            autoComplete="off"
            value={reason}
            aria-invalid={isTouched && isEmpty}
            onBlur={() => setIsTouched(true)}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldError message={isTouched && isEmpty ? 'Vui lòng nhập lý do' : undefined} />
        </div>
        {reopen.error && (
          <p role="alert" className="text-destructive text-sm">
            {reopen.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={reopen.isPending} onClick={onClose}>
            Quay lại
          </Button>
          <Button
            disabled={isEmpty || reopen.isPending}
            onClick={() => reopen.mutate({ id: order.parent_order_id, reason }, { onSuccess: onClose })}
          >
            {reopen.isPending ? 'Đang mở lại...' : 'Xác nhận mở lại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
