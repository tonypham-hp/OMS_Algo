import { useState } from 'react'
import { CallCountdown } from '@/components/SymbolStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSymbolHalt } from '@/hooks/useOperations'
import { formatClock } from '@/lib/format'
import { useMarketStore } from '@/store/market.store'
import { haltStatusOf } from '@/utils/symbolStatus'

/**
 * Vận hành tạm ngừng / cho giao dịch lại một mã (mô phỏng). Khi tạm ngừng, lệnh cha đang chạy của mã chuyển
 * PAUSED_SYSTEM; khi giao dịch lại, mã qua một phiên khớp định kỳ 15 phút (chỉ LO, cấm sửa/hủy) rồi về bình thường.
 */
export function SymbolHaltPanel() {
  const quotes = useMarketStore((state) => state.quotes)
  const [picked, setPicked] = useState('FPT')
  const mutation = useSymbolHalt()
  const quote = quotes.find((item) => item.symbol === picked)
  const special = quotes.filter((item) => item.halt)
  const halted = quote?.halt?.status === 'HALTED'

  return (
    <div className="flex flex-col gap-3" data-demo-id="symbol-halt-panel">
      <p className="text-muted-foreground text-sm">
        Tạm ngừng một mã: lệnh cha đang chạy của mã chuyển "Hệ thống tạm dừng", lệnh con chờ bị hủy. Giao dịch lại: phiên khớp
        định kỳ 15 phút chỉ nhận LO, cấm sửa, hủy; hết phiên thì lệnh khớp một lần rồi mã về lịch bình thường.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="halt-symbol">Mã</Label>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger id="halt-symbol" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {quotes
                .filter((item) => item.board !== null)
                .map((item) => (
                  <SelectItem key={item.symbol} value={item.symbol}>
                    {item.symbol}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        {quote && (
          <Badge className={haltStatusOf(quote).className} data-demo-id="halt-status">
            {haltStatusOf(quote).label}
          </Badge>
        )}
        <Button
          variant={halted ? 'default' : 'destructive'}
          disabled={!quote || mutation.isPending || quote.halt?.status === 'REOPEN'}
          onClick={() => mutation.mutate({ symbol: picked, action: halted ? 'resume' : 'halt' })}
        >
          {halted ? 'Giao dịch lại' : 'Tạm ngừng mã'}
        </Button>
      </div>
      {mutation.error && (
        <p role="alert" className="text-destructive text-sm">
          {mutation.error.message}
        </p>
      )}
      {special.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Mã đang tạm ngừng hoặc khớp định kỳ">
          {special.map((item) => (
            <li key={item.symbol} className="flex flex-wrap items-center gap-2" data-demo-id={`halt-row-${item.symbol}`}>
              <span className="font-semibold">{item.symbol}</span>
              <Badge className={haltStatusOf(item).className}>{haltStatusOf(item).label}</Badge>
              {item.halt && <span className="text-muted-foreground text-xs">từ {formatClock(item.halt.since).slice(0, 5)}</span>}
              <CallCountdown symbol={item.symbol} className="text-muted-foreground text-xs" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
