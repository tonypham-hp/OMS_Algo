import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { PERSISTENCE_LABELS, SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { formatDate, formatNumber } from '@/lib/format'
import type { ParentOrder } from '@/types'
import type { OrderFormValues } from './orderSchema'

interface ConfirmDialogProps {
  /** Lệnh đang chờ xác nhận. null thì đóng hộp thoại. */
  values: OrderFormValues | null
  createdOrder: ParentOrder | undefined
  isPending: boolean
  errorMessage: string | undefined
  onConfirm: () => void
  onClose: () => void
}

function buildSummary(values: OrderFormValues): Array<[string, string]> {
  const strategy = STRATEGIES[values.strategy_type]
  const validity =
    values.persistence_mode !== 'DAY' && values.valid_to
      ? `${PERSISTENCE_LABELS[values.persistence_mode]}, đến ${formatDate(values.valid_to)}`
      : PERSISTENCE_LABELS[values.persistence_mode]

  return [
    ['Tài khoản', values.account_no],
    ['Mã', values.symbol],
    ['Chiều', SIDE_LABELS[values.side]],
    ['Loại lệnh', strategy.label],
    ['Khối lượng', `${formatNumber(values.total_qty ?? 0)} CP`],
    ...strategy.fields.map((field): [string, string] => {
      const value = values[field.name]
      const text = typeof value === 'number' ? formatNumber(value) : (value ?? '')
      return [field.label, field.unit ? `${text} ${field.unit}` : text]
    }),
    ['Hiệu lực', validity],
  ]
}

export function ConfirmDialog({
  values,
  createdOrder,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={values !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {createdOrder ? (
          <>
            <DialogHeader>
              <DialogTitle>Đặt lệnh thành công</DialogTitle>
              <DialogDescription>Lệnh cha đã được tạo.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-lg font-semibold">{createdOrder.parent_order_id}</span>
              <Badge className={PARENT_STATUS_STYLES[createdOrder.status].className}>
                {PARENT_STATUS_STYLES[createdOrder.status].label}
              </Badge>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Đóng</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Xác nhận đặt lệnh</DialogTitle>
              <DialogDescription>Kiểm tra lại thông tin trước khi gửi.</DialogDescription>
            </DialogHeader>
            {values && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                {buildSummary(values).map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {errorMessage && (
              <p role="alert" className="text-destructive text-sm">
                {errorMessage}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={isPending} onClick={onClose}>
                Quay lại
              </Button>
              <Button disabled={isPending} onClick={onConfirm}>
                {isPending ? 'Đang gửi...' : 'Xác nhận đặt lệnh'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
