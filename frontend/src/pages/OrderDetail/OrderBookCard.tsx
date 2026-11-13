import type { ReactNode } from 'react'
import { OrderBook3 } from '@/components/OrderBook3'
import { useMarketStore } from '@/store/market.store'
import type { OrderBookDepth } from '@/types'

interface OrderBookCardProps {
  symbol: string
  /** Mức được viền nhấn (mức HUNT đang quét). */
  highlightPrice?: number | null
  /** Sổ lệnh thay cho sổ lệnh trực tiếp (ảnh chụp khi xem lại). */
  depth?: OrderBookDepth
  note?: ReactNode
  className?: string
}

/** Sổ lệnh 3 mức (chỉ đọc) của mã thuộc lệnh đang xem. */
export function OrderBookCard({ symbol, highlightPrice, depth, note, className }: OrderBookCardProps) {
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol))
  const session = useMarketStore((state) => state.session)
  const loading = useMarketStore((state) => state.received_at === 0)
  return (
    <OrderBook3
      quote={quote}
      session={session}
      depth={depth}
      highlightPrice={highlightPrice}
      loading={loading}
      note={note}
      className={className}
    />
  )
}
