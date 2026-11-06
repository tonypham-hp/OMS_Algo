import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FieldError } from '@/components/FieldError'
import { NumberInput } from '@/components/NumberInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SESSION_LABELS } from '@/config/hose'
import { getPriceColor, PRICE_COLOR } from '@/config/priceColors'
import { PERSISTENCE_LABELS, STRATEGIES, STRATEGY_TYPES } from '@/config/strategies'
import { useCreateOrder } from '@/hooks/useOrders'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useMarketStore } from '@/store/market.store'
import { useUiStore } from '@/store/ui.store'
import type { PersistenceMode, Side, StrategyType } from '@/types'
import { getDisplayPrice, getTickSize, isAuctionSession, isMtlAllowed } from '@/utils/hose'
import { ConfirmDialog } from './ConfirmDialog'
import { createOrderSchema, toCreateOrderRequest, type OrderFormValues } from './orderSchema'
import { StrategyFields } from './StrategyFields'

// Luôn đọc giá mới nhất ở thời điểm kiểm tra, không giữ bản cũ.
const orderSchema = createOrderSchema(() => ({
  getQuote: (symbol) => useMarketStore.getState().quotes.find((quote) => quote.symbol === symbol),
  today: useMarketStore.getState().trading_date,
}))

const PERSISTENCE_MODES = Object.keys(PERSISTENCE_LABELS) as PersistenceMode[]

function buildDefaults(accountNo: string, symbol: string): OrderFormValues {
  return {
    account_no: accountNo,
    symbol,
    side: 'BUY',
    strategy_type: 'STOP_LIMIT',
    total_qty: undefined,
    persistence_mode: 'DAY',
    valid_to: '',
  }
}

export function OrderTicket() {
  const user = useAuthStore((state) => state.user)
  const accounts = user?.accounts ?? []
  const quotes = useMarketStore((state) => state.quotes)
  const session = useMarketStore((state) => state.session)
  const selectedSymbol = useUiStore((state) => state.selectedSymbol)
  const setSelectedSymbol = useUiStore((state) => state.setSelectedSymbol)
  const createOrder = useCreateOrder()
  const [pendingValues, setPendingValues] = useState<OrderFormValues | null>(null)

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    mode: 'onChange',
    defaultValues: buildDefaults(accounts[0] ?? '', selectedSymbol),
  })
  const { control, getValues, handleSubmit, reset, setValue, trigger } = form
  const values = useWatch({ control })
  const strategyType = values.strategy_type ?? 'STOP_LIMIT'
  const strategy = STRATEGIES[strategyType]
  const persistenceMode = values.persistence_mode ?? 'DAY'
  const quote = quotes.find((item) => item.symbol === selectedSymbol)

  // Bấm vào bảng giá thì ticket đổi theo mã vừa chọn.
  useEffect(() => {
    setValue('symbol', selectedSymbol)
  }, [selectedSymbol, setValue])

  // Các ô phụ thuộc nhau: đổi chiều, mã hay khối lượng có thể làm ô khác đúng hoặc sai.
  // Nên kiểm tra lại mọi ô đã nhập, nhưng không báo "vui lòng nhập" ở ô chưa đụng tới.
  const valuesKey = JSON.stringify(values)
  useEffect(() => {
    const current = getValues()
    const names = [
      'total_qty' as const,
      'valid_to' as const,
      ...STRATEGIES[current.strategy_type].fields.map((field) => field.name),
    ].filter((name) => current[name] !== undefined && current[name] !== '')
    if (names.length > 0) void trigger(names)
  }, [valuesKey, getValues, trigger])

  function closeDialog() {
    setPendingValues(null)
    createOrder.reset()
  }

  function confirmOrder() {
    if (!pendingValues) return
    createOrder.mutate(toCreateOrderRequest(pendingValues, crypto.randomUUID()), {
      onSuccess: () => reset(buildDefaults(pendingValues.account_no, selectedSymbol)),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đặt lệnh nâng cao</CardTitle>
        <CardDescription>{strategy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((submitted) => setPendingValues(submitted))}
        >
          <Controller
            control={control}
            name="side"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chiều lệnh">
                {(['BUY', 'SELL'] as Side[]).map((side) => {
                  const isActive = field.value === side
                  const activeClass =
                    side === 'BUY'
                      ? 'bg-green-600 text-white hover:bg-green-600'
                      : 'bg-red-600 text-white hover:bg-red-600'
                  return (
                    <Button
                      key={side}
                      type="button"
                      variant={isActive ? 'default' : 'outline'}
                      className={cn(isActive && activeClass)}
                      aria-pressed={isActive}
                      onClick={() => field.onChange(side)}
                    >
                      {side === 'BUY' ? 'Mua' : 'Bán'}
                    </Button>
                  )
                })}
              </div>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="symbol">Mã</Label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger id="symbol" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((item) => (
                    <SelectItem key={item.symbol} value={item.symbol}>
                      {item.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Controller
              control={control}
              name="strategy_type"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="strategy_type">Loại lệnh</Label>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as StrategyType)}
                  >
                    <SelectTrigger id="strategy_type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {STRATEGIES[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          </div>

          {quote && (
            <dl className="bg-muted/50 grid grid-cols-5 gap-1 rounded-md p-2 text-center text-xs tabular-nums">
              {[
                ['Trần', quote.ceiling_price, PRICE_COLOR.ceiling],
                ['TC', quote.ref_price, PRICE_COLOR.ref],
                ['Sàn', quote.floor_price, PRICE_COLOR.floor],
                [
                  isAuctionSession(session) ? 'Dự kiến' : 'Khớp',
                  getDisplayPrice(quote),
                  getPriceColor(getDisplayPrice(quote), quote),
                ],
                ['Bước', getTickSize(quote.last_price), ''],
              ].map(([label, price, color]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn('font-medium', color as string)}>
                    {formatNumber(price as number)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <Controller
            control={control}
            name="account_no"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="account_no">Tài khoản</Label>
                {accounts.length > 1 ? (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="account_no" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account} value={account}>
                          {account}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="account_no" value={field.value} readOnly />
                )}
                <FieldError message={fieldState.error?.message} />
              </div>
            )}
          />

          <Controller
            control={control}
            name="total_qty"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="total_qty">Khối lượng</Label>
                <NumberInput
                  id="total_qty"
                  value={field.value}
                  unit="CP"
                  invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
                <FieldError message={fieldState.error?.message} />
              </div>
            )}
          />

          <StrategyFields control={control} fields={strategy.fields} />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="persistence_mode"
              render={({ field }) => (
                <div
                  className={cn(
                    'flex flex-col gap-1.5',
                    persistenceMode === 'DAY' && 'col-span-2',
                  )}
                >
                  <Label htmlFor="persistence_mode">Hiệu lực</Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="persistence_mode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSISTENCE_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {PERSISTENCE_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            {persistenceMode !== 'DAY' && (
              <Controller
                control={control}
                name="valid_to"
                render={({ field, fieldState }) => (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="valid_to">Hết hạn</Label>
                    <Input
                      id="valid_to"
                      type="date"
                      value={field.value ?? ''}
                      aria-invalid={fieldState.invalid}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                    />
                    <FieldError message={fieldState.error?.message} />
                  </div>
                )}
              />
            )}
          </div>

          {strategy.usesMtl && !isMtlAllowed(session) && (
            <p role="status" className="rounded-md bg-amber-500/15 p-2 text-xs text-amber-300">
              Hiện tại: {SESSION_LABELS[session]}. Lệnh {strategy.label} có thể sinh lệnh con MTL, mà MTL
              chỉ hợp lệ trong phiên liên tục. Trong ATO, ATC lệnh con đó được gửi dưới dạng lệnh ATO, ATC.
            </p>
          )}

          <Button type="submit">Đặt lệnh</Button>
        </form>

        <ConfirmDialog
          values={pendingValues}
          createdOrder={createOrder.data?.parent_order}
          isPending={createOrder.isPending}
          errorMessage={createOrder.error?.message}
          onConfirm={confirmOrder}
          onClose={closeDialog}
        />
      </CardContent>
    </Card>
  )
}
