import { useState, type ReactNode } from 'react'
import { EmptyState, LoadingState } from '@/components/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPriceColor } from '@/config/priceColors'
import { SESSION_LABELS } from '@/config/hose'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BookLevel, OrderBookDepth, SessionCode, SymbolQuote } from '@/types'
import { buildBookRows, getSpread } from '@/utils/orderBook'
import { isAuctionSession } from '@/utils/hose'

interface OrderBook3Props {
  quote: SymbolQuote | undefined
  session: SessionCode
  /** Sổ lệnh hiển thị thay cho `quote.depth` (ví dụ ảnh chụp lúc HUNT quét, khi xem lại). */
  depth?: OrderBookDepth
  /** Mức giá được viền nhấn (mức HUNT đang quét). */
  highlightPrice?: number | null
  /** Có thì bấm vào một mức để điền giá đó vào form đặt lệnh. */
  onPickPrice?: (price: number) => void
  /** Đang chờ dữ liệu giá lần đầu. */
  loading?: boolean
  /** Ghi chú nhỏ dưới tiêu đề (ví dụ "Ảnh chụp lúc quét"). */
  note?: ReactNode
  className?: string
}

/** Giá trị nháy màu 600ms mỗi khi đổi (không nháy lần đầu hiển thị). */
function FlashValue({ value, className, children }: { value: string; className?: string; children: ReactNode }) {
  const [previous, setPrevious] = useState(value)
  const [version, setVersion] = useState(0)
  if (previous !== value) {
    setPrevious(value)
    setVersion((current) => current + 1)
  }
  return (
    <span key={version} className={cn('inline-block rounded px-1', version > 0 && 'flash-cell', className)}>
      {children}
    </span>
  )
}

function LevelRow({
  level,
  side,
  rank,
  quote,
  highlighted,
  dimmed,
  onPickPrice,
}: {
  level: BookLevel | null
  side: 'ask' | 'bid'
  rank: number
  quote: SymbolQuote
  highlighted: boolean
  dimmed: boolean
  onPickPrice?: (price: number) => void
}) {
  const sideLabel = `${side === 'ask' ? 'Bán' : 'Mua'} ${rank}`
  if (!level) {
    return (
      <tr className="text-muted-foreground/60 h-8">
        <td className="px-2 text-right tabular-nums">—</td>
        <td className="px-2 text-right tabular-nums">—</td>
        <td className="px-2 text-xs">{sideLabel}</td>
      </tr>
    )
  }
  const pickable = Boolean(onPickPrice)
  const pick = () => onPickPrice?.(level.price)
  return (
    <tr
      data-demo-id={`orderbook-level-${side}-${level.price}`}
      data-highlighted={highlighted || undefined}
      className={cn(
        'h-8 transition-colors',
        side === 'ask' ? 'bg-price-down/5' : 'bg-price-up/5',
        pickable && 'hover:bg-accent focus-visible:bg-accent cursor-pointer outline-none',
        highlighted && 'outline-primary bg-primary/10 outline-2 -outline-offset-2',
        dimmed && 'opacity-60',
      )}
      onClick={pickable ? pick : undefined}
      onKeyDown={
        pickable
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                pick()
              }
            }
          : undefined
      }
      tabIndex={pickable ? 0 : undefined}
      role={pickable ? 'button' : undefined}
      aria-label={pickable ? `${sideLabel}: giá ${formatNumber(level.price)}, bấm để điền giá` : undefined}
    >
      <td className="px-2 text-right tabular-nums">
        <FlashValue value={String(level.qty)}>{formatNumber(level.qty)}</FlashValue>
        {level.own_taken ? (
          <span className="text-price-ref ml-1 text-xs tabular-nums" title="KL lệnh của bạn vừa lấy ở mức này">
            -{formatNumber(level.own_taken)}
          </span>
        ) : null}
      </td>
      <td className="px-2 text-right font-semibold tabular-nums">
        <FlashValue value={String(level.price)} className={getPriceColor(level.price, quote)}>
          {formatNumber(level.price)}
        </FlashValue>
      </td>
      <td className="text-muted-foreground px-2 text-xs">{sideLabel}</td>
    </tr>
  )
}

/**
 * Sổ lệnh 3 mức: bán ở trên (bán 3 → bán 1), dòng chênh lệch ở giữa, mua ở dưới (mua 1 → mua 3).
 * Trong ATO, ATC hiện giá dự kiến khớp và ghi rõ là phiên khớp lệnh định kỳ.
 */
export function OrderBook3({ quote, session, depth, highlightPrice = null, onPickPrice, loading, note, className }: OrderBook3Props) {
  const auction = isAuctionSession(session)
  const book = depth ?? quote?.depth

  let body: ReactNode
  if (loading) {
    body = <LoadingState label="Đang tải sổ lệnh…" />
  } else if (!quote) {
    body = <EmptyState title="Chọn một mã để xem sổ lệnh" />
  } else if (!book) {
    body = <EmptyState title="Chưa có dữ liệu sổ lệnh" description="Sổ lệnh hiện khi thị trường có giá mua, bán." />
  } else {
    const rows = buildBookRows(book)
    const spread = getSpread(book)
    body = (
      <>
        {auction && (
          <div className="border-price-ref/40 bg-price-ref/10 mb-2 rounded-md border px-2 py-1.5 text-xs" role="status">
            <p className="font-medium">Phiên khớp lệnh định kỳ ({SESSION_LABELS[session]})</p>
            <p className="text-muted-foreground">
              Giá dự kiến khớp:{' '}
              <span className={cn('font-semibold tabular-nums', quote.indicative_price ? getPriceColor(quote.indicative_price, quote) : '')}>
                {quote.indicative_price ? formatNumber(quote.indicative_price) : '—'}
              </span>
              . Các mức chỉ để tham khảo, chưa khớp liên tục.
            </p>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-xs">
              <th className="px-2 py-1 text-right font-medium">Khối lượng</th>
              <th className="px-2 py-1 text-right font-medium">Giá</th>
              <th className="px-2 py-1 text-left font-medium">Bên</th>
            </tr>
          </thead>
          <tbody>
            {rows.asks.map((level, index) => (
              <LevelRow
                key={`ask-${rows.asks.length - index}`}
                level={level}
                side="ask"
                rank={rows.asks.length - index}
                quote={quote}
                highlighted={level !== null && level.price === highlightPrice}
                dimmed={auction}
                onPickPrice={onPickPrice}
              />
            ))}
            <tr className="border-y">
              <td colSpan={3} className="text-muted-foreground px-2 py-1 text-center text-xs" data-demo-id="orderbook-spread">
                {auction
                  ? 'Phiên định kỳ: không có chênh lệch mua bán liên tục'
                  : spread
                    ? `Chênh lệch mua bán: ${formatNumber(spread.amount)} đ (${spread.ticks} bước giá)`
                    : 'Chênh lệch mua bán: —'}
              </td>
            </tr>
            {rows.bids.map((level, index) => (
              <LevelRow
                key={`bid-${index + 1}`}
                level={level}
                side="bid"
                rank={index + 1}
                quote={quote}
                highlighted={level !== null && level.price === highlightPrice}
                dimmed={auction}
                onPickPrice={onPickPrice}
              />
            ))}
          </tbody>
        </table>
        {onPickPrice && <p className="text-muted-foreground mt-2 text-xs">Bấm vào một mức giá để điền vào lệnh.</p>}
      </>
    )
  }

  return (
    <Card className={className} data-demo-id="orderbook3" aria-label="Sổ lệnh 3 mức">
      <CardHeader>
        <CardTitle className="flex items-baseline justify-between gap-2">
          <span>Sổ lệnh 3 mức</span>
          {quote && <span className="text-muted-foreground text-xs font-normal">{quote.symbol}</span>}
        </CardTitle>
        {note && <p className="text-muted-foreground text-xs">{note}</p>}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
