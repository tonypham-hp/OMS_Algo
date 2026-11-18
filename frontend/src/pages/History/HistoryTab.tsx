import { Download, SearchX } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilterSelect } from '@/components/FilterSelect'
import { toOptions } from '@/components/filterOptions'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { EmptyState } from '@/components/states'
import { Term } from '@/components/Term'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from '@/components/ui/table'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { usePermission } from '@/hooks/usePermission'
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { HistoryData, Side } from '@/types'
import { downloadCsv } from '@/utils/csv'
import { resolveDateRange } from '@/utils/dateRange'
import { favorableClass, formatDiffPct, formatQualityPrice, NO_VALUE } from '@/utils/execQuality'
import {
  buildHistoryCsv,
  buildHistoryRows,
  DEFAULT_HISTORY_FILTERS,
  filterHistoryRows,
  formatCompletionRate,
  getHistoryFilename,
  getHistoryTotals,
  nextSort,
  HISTORY_COLUMNS,
  HISTORY_STATUS_LABELS,
  paginate,
  sortHistoryRows,
  type HistoryFilters,
  type HistoryRow,
  type HistorySortKey,
} from '@/utils/history'
import { DateRangeFilter, Pagination, SortableHead } from './shared'

const SIDE_OPTIONS = (Object.keys(SIDE_LABELS) as Side[]).map((side) => ({ value: side as string, label: SIDE_LABELS[side] }))
const STATUS_OPTIONS = toOptions(HISTORY_STATUS_LABELS)
const COLUMN_TERMS: Partial<Record<HistorySortKey, string>> = { vsArrivalPct: 'slippage', sessions: 'persistence-mode' }
const NUMBER = 'text-right tabular-nums'

function renderCell(row: HistoryRow, key: HistorySortKey): ReactNode {
  const { order } = row
  switch (key) {
    case 'date':
      return row.firstDate === row.date ? formatDate(row.date) : `${formatDate(row.firstDate)} – ${formatDate(row.date)}`
    case 'parent_order_id':
      return order.parent_order_id
    case 'symbol':
      return order.symbol
    case 'side':
      return SIDE_LABELS[order.side]
    case 'strategy_type':
      return STRATEGIES[order.strategy_type].label
    case 'template':
      return row.templateName ?? NO_VALUE
    case 'total_qty':
      return formatNumber(order.total_qty)
    case 'filledQty':
      return formatNumber(row.filledQty)
    case 'avgPrice':
      return formatQualityPrice(row.avgPrice)
    case 'vsArrivalPct':
      return <span className={favorableClass(row.arrivalFavorable)}>{formatDiffPct(row.vsArrivalPct)}</span>
    case 'status':
      return (
        <span className="flex flex-col gap-0.5">
          <OrderStatusBadge status={order.status} />
          {row.isLive && <span className="text-muted-foreground text-xs">Đang chạy nhiều phiên</span>}
        </span>
      )
    case 'sessions':
      return formatNumber(row.sessions)
  }
}

/** Tab 1: lệnh đã kết thúc và lệnh nhiều phiên đang chạy, theo ngày. */
export function HistoryTab({ data }: { data: HistoryData }) {
  const navigate = useNavigate()
  const hasPermission = usePermission()
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS)
  const [sort, setSort] = useState<{ key: HistorySortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' })
  const [page, setPage] = useState(1)

  const allRows = useMemo(() => buildHistoryRows(data), [data])
  const rows = useMemo(
    () => sortHistoryRows(filterHistoryRows(allRows, filters, data.trading_date), sort.key, sort.direction),
    [allRows, filters, data.trading_date, sort],
  )
  const current = paginate(rows, page)
  const totals = getHistoryTotals(rows)
  const range = resolveDateRange(filters.range, data.trading_date)

  const unique = (values: string[]) => [...new Set(values)].sort()
  const plain = (values: string[]) => values.map((value) => ({ value, label: value }))
  const historyOrders = allRows.map((row) => row.order)
  const showAccount = hasPermission('multi_account') || hasPermission('operations')
  const update = (patch: Partial<HistoryFilters>) => {
    setFilters((value) => ({ ...value, ...patch }))
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter idPrefix="history" value={filters.range} onChange={(value) => update({ range: value })} tradingDate={data.trading_date} />
          <FilterSelect id="history-symbol" label="Mã CK" value={filters.symbol} options={plain(unique(historyOrders.map((order) => order.symbol)))} onChange={(value) => update({ symbol: value })} />
          <FilterSelect
            id="history-strategy"
            label="Chiến lược"
            value={filters.strategy_type}
            options={unique(historyOrders.map((order) => order.strategy_type)).map((type) => ({ value: type, label: STRATEGIES[type as keyof typeof STRATEGIES].label }))}
            onChange={(value) => update({ strategy_type: value })}
          />
          <FilterSelect id="history-side" label="Chiều" value={filters.side} options={SIDE_OPTIONS} onChange={(value) => update({ side: value })} className="w-32" />
          <FilterSelect id="history-status" label="Trạng thái" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => update({ status: value as HistoryFilters['status'] })} className="w-48" />
          {showAccount && (
            <FilterSelect id="history-account" label="Tài khoản" value={filters.account_no} options={plain(unique(historyOrders.map((order) => order.account_no)))} onChange={(value) => update({ account_no: value })} />
          )}
          <Button variant="ghost" onClick={() => update(DEFAULT_HISTORY_FILTERS)}>
            Bỏ lọc
          </Button>
        </div>
        <Button variant="outline" disabled={rows.length === 0} onClick={() => downloadCsv(getHistoryFilename(range), buildHistoryCsv(rows))}>
          <Download aria-hidden /> Xuất CSV
        </Button>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>Lịch sử lệnh</h2>
          </CardTitle>
          <CardDescription>
            Lệnh đã hoàn tất, đã hủy, hết hạn, và lệnh <Term id="persistence-mode">nhiều phiên</Term> còn chạy. Bấm một dòng để mở chi tiết lệnh.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Không có lệnh nào trong khoảng ngày và bộ lọc này."
              description="Thử chọn 5 phiên hoặc bỏ bớt điều kiện lọc."
              action={
                <Button variant="outline" size="sm" onClick={() => update(DEFAULT_HISTORY_FILTERS)}>
                  Bỏ lọc
                </Button>
              }
            />
          ) : (
            <>
              <Table data-demo-id="history-table">
                <TableHeader>
                  <TableRow>
                    {HISTORY_COLUMNS.map((column) => {
                      const termId = COLUMN_TERMS[column.key]
                      return (
                        <SortableHead
                          key={column.key}
                          label={column.label}
                          numeric={column.numeric}
                          active={sort.key === column.key}
                          direction={sort.direction}
                          onSort={() => setSort((value) => nextSort(value, column.key))}
                        >
                          {termId
                            ? (button) => (
                                <Term id={termId} focusable={false}>
                                  {button}
                                </Term>
                              )
                            : undefined}
                        </SortableHead>
                      )
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.rows.map((row) => {
                    const id = row.order.parent_order_id
                    const open = () => navigate(`/so-lenh/${id}`)
                    return (
                      <TableRow
                        key={id}
                        data-demo-id={`history-row-${id}`}
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={open}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') open()
                        }}
                      >
                        {HISTORY_COLUMNS.map((column) => (
                          <TableCell key={column.key} className={cn(column.numeric && NUMBER, column.key === 'parent_order_id' && 'font-medium tabular-nums', column.key === 'date' && 'tabular-nums whitespace-nowrap')}>
                            {renderCell(row, column.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter data-demo-id="history-totals">
                  <TableRow>
                    <TableCell colSpan={6} className="font-medium">
                      Tổng theo bộ lọc: {formatNumber(totals.count)} lệnh
                    </TableCell>
                    <TableCell className={NUMBER}>{formatNumber(rows.reduce((sum, row) => sum + row.order.total_qty, 0))}</TableCell>
                    <TableCell className={NUMBER}>{formatNumber(totals.filledQty)}</TableCell>
                    <TableCell colSpan={4} className="text-muted-foreground text-right">
                      Tỷ lệ hoàn tất {formatCompletionRate(totals.completionRate)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <Pagination page={current} onPage={setPage} label="Phân trang lịch sử lệnh" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
