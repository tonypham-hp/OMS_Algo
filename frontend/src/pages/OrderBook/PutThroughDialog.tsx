import { useState } from 'react'
import { FieldError } from '@/components/FieldError'
import { NumberInput } from '@/components/NumberInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SESSION_LABELS } from '@/config/hose'
import { ruleMessage } from '@/explain/reasons'
import { useCreatePutThrough } from '@/hooks/usePutThrough'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildRuleContext } from '@/rules/context'
import { validatePutThrough } from '@/rules/putThrough'
import { boardLabel } from '@/rules/symbols'
import type { RuleField } from '@/rules/types'
import { useAuthStore } from '@/store/auth.store'
import { useMarketStore } from '@/store/market.store'
import type { Side } from '@/types'

/** Tài khoản đối ứng điền sẵn: số MÔ PHỎNG, không phải tài khoản thật. */
const DEMO_COUNTERPARTY = '999C000001'

type FieldName = 'symbol' | 'qty' | 'price' | 'counterparty' | 'session'
const FIELD_OF: Record<RuleField, FieldName> = {
  symbol: 'symbol',
  orderType: 'session',
  price: 'price',
  qty: 'qty',
  account: 'counterparty',
  session: 'session',
}

/** Phiếu lệnh thỏa thuận: mã, chiều, KL, giá, tài khoản đối ứng (mô phỏng). Kiểm tra ngay khi nhập bằng validatePutThrough. */
export function PutThroughDialog({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((state) => state.user)
  const accounts = user?.accounts ?? []
  const quotes = useMarketStore((state) => state.quotes)
  const boardSessions = useMarketStore((state) => state.board_sessions)
  const marketSession = useMarketStore((state) => state.session)
  const tradingDate = useMarketStore((state) => state.trading_date)
  const create = useCreatePutThrough()
  const [account, setAccount] = useState(accounts[0] ?? '')
  const [symbol, setSymbol] = useState('FPT')
  const [side, setSide] = useState<Side>('BUY')
  const [qty, setQty] = useState<number | undefined>(undefined)
  const [price, setPrice] = useState<number | undefined>(undefined)
  const [counterparty, setCounterparty] = useState(DEMO_COUNTERPARTY)
  const [touched, setTouched] = useState(false)

  const quote = quotes.find((item) => item.symbol === symbol)
  const rule = quote ? buildRuleContext(quote, tradingDate) : null
  const boardSession = quote?.board ? (boardSessions?.[quote.board] ?? marketSession) : 'CLOSED'
  const violations =
    rule && quote
      ? validatePutThrough(
          { side, qty: qty ?? 0, price: price ?? 0, accountNo: account, counterparty },
          rule.rules,
          boardSession,
          rule.symbol,
        )
      : []
  const errors: Partial<Record<FieldName, string>> = {}
  for (const violation of violations) {
    const field = FIELD_OF[violation.field]
    errors[field] ??= ruleMessage(violation)
  }
  const show = (field: FieldName) => (touched ? errors[field] : undefined)
  const spec = rule?.rules.putThrough

  function submit() {
    setTouched(true)
    if (violations.length > 0 || qty === undefined || price === undefined) return
    create.mutate(
      { account_no: account, counterparty_account: counterparty, symbol, side, qty, price },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-demo-id="put-through-dialog">
        <DialogHeader>
          <DialogTitle>Lệnh thỏa thuận</DialogTitle>
          <DialogDescription>
            Gửi cho bên đối ứng xác nhận; xác nhận thì khớp ngay, không qua sổ lệnh khớp lệnh. Chỉ hủy được khi chưa khớp.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pt-account">Tài khoản</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger id="pt-account" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pt-symbol">Mã</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger id="pt-symbol" className="w-full" aria-invalid={Boolean(show('symbol'))}>
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
              <FieldError message={show('symbol')} />
            </div>
          </div>

          {quote && spec && (
            <p className="text-muted-foreground text-xs" data-demo-id="put-through-rules">
              {boardLabel(quote.board)}: tối thiểu {formatNumber(spec.minQty)} CP, bước giá {spec.tick} đ, giá trong sàn{' '}
              {formatNumber(quote.floor_price)} – trần {formatNumber(quote.ceiling_price)}. Phiên hiện tại: {SESSION_LABELS[boardSession]}.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chiều lệnh thỏa thuận">
            {(['BUY', 'SELL'] as Side[]).map((item) => (
              <Button
                key={item}
                type="button"
                variant={side === item ? 'default' : 'outline'}
                aria-pressed={side === item}
                className={cn(side === item && (item === 'BUY' ? 'bg-green-600 hover:bg-green-600' : 'bg-red-600 hover:bg-red-600'))}
                onClick={() => setSide(item)}
              >
                {item === 'BUY' ? 'Mua' : 'Bán'}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pt-qty">Khối lượng</Label>
              <NumberInput id="pt-qty" value={qty} unit="CP" invalid={Boolean(show('qty'))} onChange={setQty} />
              <FieldError message={show('qty')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pt-price">Giá thỏa thuận</Label>
              <NumberInput id="pt-price" value={price} unit="đ" invalid={Boolean(show('price'))} onChange={setPrice} />
              <FieldError message={show('price')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pt-counterparty">Tài khoản đối ứng (mô phỏng)</Label>
            <Input
              id="pt-counterparty"
              value={counterparty}
              aria-invalid={Boolean(show('counterparty'))}
              onChange={(event) => setCounterparty(event.target.value)}
            />
            <FieldError message={show('counterparty')} />
          </div>

          {show('session') && (
            <p role="alert" className="text-destructive text-sm">
              {show('session')}
            </p>
          )}
          {create.error && (
            <p role="alert" className="text-destructive text-sm">
              {create.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Quay lại
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Đang gửi...' : 'Gửi lệnh thỏa thuận'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
