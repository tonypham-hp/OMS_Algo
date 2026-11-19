import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/format'
import { LISTING_TRANSFERS } from '@/rules/symbols'
import { marketService } from '@/services/market.service'
import { useMarketStore } from '@/store/market.store'

/** Ngày mã niêm yết HNX bắt đầu giao dịch trên HOSE: nút nhảy nhanh để xem luật mới. */
const TRANSFER_DATE = LISTING_TRANSFERS[0].firstTradingDate

/**
 * Đồng hồ ngày mô phỏng, cạnh đồng hồ phiên. Thanh trên chỉ hiện ngày rút gọn (dd/MM) cho gọn;
 * bấm vào thì mở khung chọn ngày giao dịch (chỉ tiến, không lùi) và nút "Đến 28/12/2026".
 * Đổi ngày thì bảng giá dựng lại theo luật của ngày mới, không tải lại trang.
 */
export function SimDateControl({ readOnly = false }: { readOnly?: boolean }) {
  const tradingDate = useMarketStore((state) => state.trading_date)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!tradingDate) return null
  const full = formatDate(tradingDate)
  const short = full.slice(0, 5)

  if (readOnly) {
    return (
      <span className="text-muted-foreground tabular-nums" data-demo-id="sim-date" title={`Ngày mô phỏng ${full}`}>
        {short}
      </span>
    )
  }

  function go(date: string) {
    try {
      marketService.setTradingDate(date)
      setError(null)
      setOpen(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đổi được ngày')
    }
  }

  return (
    <span ref={rootRef} className="relative" data-demo-id="sim-date">
      <Button
        size="xs"
        variant="ghost"
        className="px-1.5 tabular-nums"
        aria-label={`Ngày mô phỏng ${full}`}
        aria-expanded={open}
        aria-controls="sim-date-panel"
        title={`Ngày mô phỏng ${full}`}
        onClick={() => setOpen((value) => !value)}
      >
        {short}
      </Button>
      {open && (
        <div
          id="sim-date-panel"
          role="group"
          aria-label="Đổi ngày mô phỏng"
          className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 flex w-64 flex-col gap-2 rounded-md border p-3 shadow-md"
        >
          <label htmlFor="sim-date-input" className="text-muted-foreground text-xs">
            Ngày giao dịch mô phỏng (chỉ tiến, không lùi)
          </label>
          <Input
            id="sim-date-input"
            type="date"
            className="h-8 tabular-nums"
            value={tradingDate}
            min={tradingDate}
            aria-invalid={error !== null}
            onChange={(event) => event.target.value && go(event.target.value)}
          />
          {tradingDate < TRANSFER_DATE && (
            <Button size="sm" variant="outline" onClick={() => go(TRANSFER_DATE)}>
              Đến {formatDate(TRANSFER_DATE)}
            </Button>
          )}
          <p className="text-muted-foreground text-[11px]">
            Từ {formatDate(TRANSFER_DATE)} cổ phiếu niêm yết HNX giao dịch trên HOSE (nghỉ 24–25/12).
          </p>
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </div>
      )}
    </span>
  )
}
