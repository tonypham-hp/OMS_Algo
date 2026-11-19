import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { LISTING_TRANSFERS } from '@/rules/symbols'
import { marketService } from '@/services/market.service'
import { useMarketStore } from '@/store/market.store'

/** Ngày mã niêm yết HNX bắt đầu giao dịch trên HOSE: nút nhảy nhanh để xem luật mới. */
const TRANSFER_DATE = LISTING_TRANSFERS[0].firstTradingDate

/**
 * Đồng hồ ngày mô phỏng, cạnh đồng hồ phiên: chọn ngày giao dịch (chỉ tiến, không lùi), hoặc nhảy tới 28/12/2026.
 * Đổi ngày thì bảng giá dựng lại theo luật của ngày mới, không tải lại trang.
 */
export function SimDateControl({ readOnly = false }: { readOnly?: boolean }) {
  const tradingDate = useMarketStore((state) => state.trading_date)
  const [error, setError] = useState<string | null>(null)

  function go(date: string) {
    try {
      marketService.setTradingDate(date)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không đổi được ngày')
    }
  }

  if (readOnly || !tradingDate) {
    return (
      <span className="text-muted-foreground tabular-nums" data-demo-id="sim-date">
        {tradingDate ? formatDate(tradingDate) : ''}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5" data-demo-id="sim-date">
      <label className="sr-only" htmlFor="sim-date-input">
        Ngày mô phỏng
      </label>
      <input
        id="sim-date-input"
        type="date"
        className="border-input bg-background h-7 rounded-md border px-1.5 text-xs tabular-nums"
        value={tradingDate}
        min={tradingDate}
        aria-invalid={error !== null}
        title={error ?? 'Ngày giao dịch mô phỏng'}
        onChange={(event) => event.target.value && go(event.target.value)}
      />
      {tradingDate < TRANSFER_DATE && (
        <Button size="xs" variant="outline" className="whitespace-nowrap" onClick={() => go(TRANSFER_DATE)}>
          Đến {formatDate(TRANSFER_DATE)}
        </Button>
      )}
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      )}
    </span>
  )
}
