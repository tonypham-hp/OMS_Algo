import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { STRATEGIES } from '@/config/strategies'
import { useOrderPriceFields, useRepriceOrder } from '@/hooks/useOrders'
import { formatNumber } from '@/lib/format'
import { useMarketStore } from '@/store/market.store'
import type { OrderPriceField, ParentOrder } from '@/types'
import { createRepriceSchema, type RepriceOrderValues } from './repriceOrderSchema'

interface RepriceOrderDialogProps {
  order: ParentOrder
  onClose: () => void
}

function getQuote(symbol: string) {
  return useMarketStore.getState().quotes.find((quote) => quote.symbol === symbol)
}

function RepriceForm({
  order,
  fields,
  onClose,
}: RepriceOrderDialogProps & { fields: OrderPriceField[] }) {
  const reprice = useRepriceOrder()
  const [schema] = useState(() => createRepriceSchema(fields, () => getQuote(order.symbol)?.ref_price))
  const { control, handleSubmit } = useForm<RepriceOrderValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: Object.fromEntries(fields.map((field) => [field.name, field.value])),
  })
  const labels = STRATEGIES[order.strategy_type].fields

  function submit(values: RepriceOrderValues) {
    reprice.mutate(
      {
        id: order.parent_order_id,
        request: {
          version: order.version,
          prices: Object.fromEntries(fields.map((field) => [field.name, values[field.name] as number])),
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
      {fields.map((item) => (
        <Controller
          key={item.name}
          control={control}
          name={item.name}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`reprice_${item.name}`}>
                {labels.find((label) => label.name === item.name)?.label}
              </Label>
              <NumberInput
                id={`reprice_${item.name}`}
                value={field.value ?? undefined}
                unit="đ"
                invalid={fieldState.invalid}
                onBlur={field.onBlur}
                onChange={(value) => field.onChange(value ?? null)}
              />
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
      ))}
      {reprice.error && (
        <p role="alert" className="text-destructive text-sm">
          {reprice.error.message}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={reprice.isPending} onClick={onClose}>
          Quay lại
        </Button>
        <Button type="submit" disabled={reprice.isPending}>
          {reprice.isPending ? 'Đang lưu...' : 'Lưu và chạy lại lệnh'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Sửa giá lệnh hệ thống tạm dừng vì giá ngoài biên độ. Sửa hợp lệ thì lệnh tự chạy lại. */
export function RepriceOrderDialog({ order, onClose }: RepriceOrderDialogProps) {
  const priceFields = useOrderPriceFields(order.parent_order_id)
  const quote = getQuote(order.symbol)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa giá lệnh {order.symbol}</DialogTitle>
          <DialogDescription>
            {order.parent_order_id} đang tạm dừng vì có giá ngoài biên độ hôm nay
            {quote && ` (sàn ${formatNumber(quote.floor_price)}, trần ${formatNumber(quote.ceiling_price)})`}.
            Khối lượng giữ nguyên.
          </DialogDescription>
        </DialogHeader>
        {priceFields.error && (
          <p role="alert" className="text-destructive text-sm">
            {priceFields.error.message}
          </p>
        )}
        {priceFields.isPending && <p className="text-muted-foreground text-sm">Đang tải...</p>}
        {priceFields.data && <RepriceForm order={order} fields={priceFields.data} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
