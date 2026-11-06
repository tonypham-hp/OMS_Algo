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
import { getPriceColor, PRICE_COLOR } from '@/config/priceColors'
import { formatNumber, formatPercent, formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useMarketStore } from '@/store/market.store'
import { useUiStore } from '@/store/ui.store'

const NUMBER_CELL = 'text-right tabular-nums'

export function PriceBoard() {
  const quotes = useMarketStore((state) => state.quotes)
  const selectedSymbol = useUiStore((state) => state.selectedSymbol)
  const setSelectedSymbol = useUiStore((state) => state.setSelectedSymbol)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bảng giá VN30</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead className="text-right">Trần</TableHead>
              <TableHead className="text-right">TC</TableHead>
              <TableHead className="text-right">Sàn</TableHead>
              <TableHead className="text-right">Giá khớp</TableHead>
              <TableHead className="text-right">+/-</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Tổng KL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => {
              const change = quote.last_price - quote.ref_price
              const color = getPriceColor(quote.last_price, quote)
              const isSelected = quote.symbol === selectedSymbol
              return (
                <TableRow
                  key={quote.symbol}
                  data-state={isSelected ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => setSelectedSymbol(quote.symbol)}
                >
                  <TableCell>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      className={cn('cursor-pointer font-semibold', color)}
                    >
                      {quote.symbol}
                    </button>
                  </TableCell>
                  <TableCell className={cn(NUMBER_CELL, PRICE_COLOR.ceiling)}>
                    {formatNumber(quote.ceiling_price)}
                  </TableCell>
                  <TableCell className={cn(NUMBER_CELL, PRICE_COLOR.ref)}>
                    {formatNumber(quote.ref_price)}
                  </TableCell>
                  <TableCell className={cn(NUMBER_CELL, PRICE_COLOR.floor)}>
                    {formatNumber(quote.floor_price)}
                  </TableCell>
                  <TableCell className={NUMBER_CELL}>
                    <PriceCell quote={quote} />
                  </TableCell>
                  <TableCell className={cn(NUMBER_CELL, color)}>{formatSigned(change)}</TableCell>
                  <TableCell className={cn(NUMBER_CELL, color)}>
                    {formatPercent((change * 100) / quote.ref_price)}
                  </TableCell>
                  <TableCell className={NUMBER_CELL}>{formatNumber(quote.total_volume)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
