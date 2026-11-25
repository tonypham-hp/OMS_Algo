import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FieldError } from '@/components/FieldError'
import { NumberInput } from '@/components/NumberInput'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useUpdateOrder } from '@/hooks/useOrders'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { createEditOrderSchema, describeAmend, hasLimitPrice, type EditOrderValues } from './editOrderSchema'

interface EditOrderDialogProps {
  order: ParentOrder
  onClose: () => void
}

function getQuote(symbol: string) {
  return useMarketStore.getState().quotes.find((quote) => quote.symbol === symbol)
}

/** Component được tạo mới mỗi lần mở (nhờ `key` ở nơi gọi), nên form luôn lấy đúng giá trị của lệnh. */
export function EditOrderDialog({ order, onClose }: EditOrderDialogProps) {
  const updateOrder = useUpdateOrder()
  const [schema] = useState(() => createEditOrderSchema(order, () => getQuote(order.symbol)))
  const original: EditOrderValues = { total_qty: order.total_qty, limit_price: order.limit_price }
  const { control, handleSubmit, reset } = useForm<EditOrderValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: original,
  })
  // KRX: mỗi lần sửa chỉ đổi giá HOẶC khối lượng. Đã sửa một ô thì ô còn lại bị khóa.
  const current = useWatch({ control }) as EditOrderValues
  const qtyChanged = current.total_qty !== original.total_qty
  const priceChanged = hasLimitPrice(order) && current.limit_price !== original.limit_price
  const amend = describeAmend(order, current, getQuote(order.symbol))

  function submit(values: EditOrderValues) {
    updateOrder.mutate(
      {
        id: order.parent_order_id,
        request: {
          version: order.version,
          total_qty: values.total_qty as number,
          limit_price: hasLimitPrice(order) ? (values.limit_price as number) : null,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa lệnh {order.symbol}</DialogTitle>
          <DialogDescription>
            {order.parent_order_id}. Đã khớp {formatNumber(order.executed_qty)} CP. Mỗi lần chỉ sửa giá hoặc khối lượng; lệnh con LO đang chờ được sửa tại chỗ.
          </DialogDescription>
        </DialogHeader>
        <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
          <Controller
            control={control}
            name="total_qty"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit_total_qty">Khối lượng đặt</Label>
                <NumberInput
                  id="edit_total_qty"
                  value={field.value ?? undefined}
                  unit="CP"
                  disabled={priceChanged}
                  invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={(value) => field.onChange(value ?? null)}
                />
                <FieldError message={fieldState.error?.message} />
              </div>
            )}
          />
          {hasLimitPrice(order) && (
            <Controller
              control={control}
              name="limit_price"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit_limit_price">Giá giới hạn</Label>
                  <NumberInput
                    id="edit_limit_price"
                    value={field.value ?? undefined}
                    unit="đ"
                    disabled={qtyChanged}
                    invalid={fieldState.invalid}
                    onBlur={field.onBlur}
                    onChange={(value) => field.onChange(value ?? null)}
                  />
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
          )}
          {(qtyChanged || priceChanged) && (
            <div className="flex items-start justify-between gap-3">
              {amend && (
                <p
                  role="status"
                  data-demo-id="amend-priority"
                  className={cn(
                    'rounded-md p-2 text-xs',
                    amend.losesPriority ? 'bg-status-warning-bg text-status-warning' : 'bg-status-success-bg text-status-success',
                  )}
                >
                  {amend.text}
                </p>
              )}
              <Button type="button" size="xs" variant="ghost" className="shrink-0" onClick={() => reset(original)}>
                Đổi trường sửa
              </Button>
            </div>
          )}
          {updateOrder.error && (
            <p role="alert" className="text-destructive text-sm">
              {updateOrder.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={updateOrder.isPending} onClick={onClose}>
              Quay lại
            </Button>
            <Button type="submit" disabled={updateOrder.isPending || (!qtyChanged && !priceChanged)}>
              {updateOrder.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
