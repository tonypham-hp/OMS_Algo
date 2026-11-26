import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PriceCell } from '@/components/PriceCell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPriceColor, PRICE_COLOR, priceChipClass } from '@/config/priceColors'
import { formatNumber, formatPercent, formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMarketStore } from '@/store/market.store'
import { getDisplayPrice, isAuctionSession } from '@/utils/hose'
import { useSymbolScope } from '@/workspace/symbolScope'

const NUMBER_CELL = 'text-right tabular-nums'

/**
 * Một hàng của bảng giá. Chỉ đọc quote của mã mình (selector hẹp): tick giá của mã khác không vẽ lại hàng này,
 * và mã không đổi giá thì không vẽ lại.
 */
const PriceRow = memo(function PriceRow({
  symbol,
  selected,
  onSelect,
}: {
  symbol: string
  selected: boolean
  onSelect: (symbol: string) => void
}) {
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol))
  if (!quote) return null
  const price = getDisplayPrice(quote)
  const change = price - quote.ref_price
  const color = getPriceColor(price, quote)
  return (
    <TableRow data-state={selected ? 'selected' : undefined} className="cursor-pointer" onClick={() => onSelect(quote.symbol)}>
      <TableCell>
        <button type="button" aria-pressed={selected} className={cn('cursor-pointer font-semibold', color)}>
          {quote.symbol}
        </button>
      </TableCell>
      <TableCell className={cn(NUMBER_CELL, PRICE_COLOR.ceiling)}>{formatNumber(quote.ceiling_price)}</TableCell>
      <TableCell className={cn(NUMBER_CELL, PRICE_COLOR.ref)}>
        <span className={cn('rounded px-1', priceChipClass('ref'))}>{formatNumber(quote.ref_price)}</span>
      </TableCell>
      <TableCell className={cn(NUMBER_CELL, PRICE_COLOR.floor)}>{formatNumber(quote.floor_price)}</TableCell>
      <TableCell className={NUMBER_CELL}>
        <PriceCell quote={quote} />
      </TableCell>
      <TableCell className={cn(NUMBER_CELL, color)}>{formatSigned(change)}</TableCell>
      <TableCell className={cn(NUMBER_CELL, color)}>{formatPercent((change * 100) / quote.ref_price)}</TableCell>
      <TableCell className={NUMBER_CELL}>{formatNumber(quote.total_volume)}</TableCell>
    </TableRow>
  )
})

/** Bảng giá thu gọn (không có khung thẻ): dùng ở màn Đặt lệnh và panel Danh mục theo dõi của Bàn làm việc. */
export function PriceBoardTable() {
  const symbols = useMarketStore(useShallow((state) => state.quotes.map((quote) => quote.symbol)))
  const auction = useMarketStore((state) => isAuctionSession(state.session))
  const { symbol: selectedSymbol, setSymbol } = useSymbolScope()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã</TableHead>
          <TableHead className="text-right">Trần</TableHead>
          <TableHead className="text-right">TC</TableHead>
          <TableHead className="text-right">Sàn</TableHead>
          <TableHead className="text-right">{auction ? 'Giá dự kiến' : 'Giá khớp'}</TableHead>
          <TableHead className="text-right">+/-</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-right">Tổng KL</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {symbols.map((symbol) => (
          <PriceRow key={symbol} symbol={symbol} selected={symbol === selectedSymbol} onSelect={setSymbol} />
        ))}
      </TableBody>
    </Table>
  )
}

export function PriceBoard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bảng giá VN30</CardTitle>
      </CardHeader>
      <CardContent>
        <PriceBoardTable />
      </CardContent>
    </Card>
  )
}
