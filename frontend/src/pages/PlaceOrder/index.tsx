import { OrderBook3 } from '@/components/OrderBook3'
import { useMarketStore } from '@/store/market.store'
import { useUiStore } from '@/store/ui.store'
import { OrderTicket } from './OrderTicket'
import { PriceBoard } from './PriceBoard'

/** Sổ lệnh của mã đang chọn; bấm một mức thì điền giá vào ticket. */
function SelectedOrderBook() {
  const selectedSymbol = useUiStore((state) => state.selectedSymbol)
  const pickPrice = useUiStore((state) => state.pickPrice)
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === selectedSymbol))
  const session = useMarketStore((state) => state.session)
  const loading = useMarketStore((state) => state.received_at === 0)
  return <OrderBook3 quote={quote} session={session} loading={loading} onPickPrice={pickPrice} />
}

/**
 * Bố cục: bảng giá | sổ lệnh | ticket trên màn rộng (≥1536px).
 * Màn 1366–1440px: sổ lệnh nằm ngay trên ticket trong cột phải, để bảng giá không bị bóp hẹp.
 */
export default function PlaceOrder() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_280px_400px]">
      <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <PriceBoard />
      </div>
      <div className="lg:col-start-2 lg:row-start-1">
        <SelectedOrderBook />
      </div>
      <div className="lg:col-start-2 lg:row-start-2 2xl:col-start-3 2xl:row-span-2 2xl:row-start-1">
        <OrderTicket />
      </div>
    </div>
  )
}
