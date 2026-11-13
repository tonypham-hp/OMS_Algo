import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { cn } from '@/lib/utils'
import {
  favorableClass,
  formatDiffPct,
  formatParticipation,
  formatQualityPrice,
  REPORT_COLUMNS,
  type ExecQualityRow,
  type ReportSortKey,
  type SortDirection,
} from '@/utils/execQuality'

export interface ReportSort {
  key: ReportSortKey
  direction: SortDirection
}

interface ReportTableProps {
  rows: ExecQualityRow[]
  sort: ReportSort
  onSort: (key: ReportSortKey) => void
}

function renderCell(row: ExecQualityRow, key: ReportSortKey): ReactNode {
  switch (key) {
    case 'parent_order_id':
      return row.order.parent_order_id
    case 'symbol':
      return row.order.symbol
    case 'side':
      // Không tô màu chiều: xanh, đỏ trong bảng này dành cho có lợi, bất lợi.
      return SIDE_LABELS[row.order.side]
    case 'strategy_type':
      return (
        <span className="flex flex-col">
          <span>{STRATEGIES[row.order.strategy_type].label}</span>
          {row.templateName && (
            <span className="text-muted-foreground text-xs" data-demo-id="report-template">
              Mẫu: {row.templateName}
            </span>
          )}
        </span>
      )
    case 'avgPrice':
    case 'arrivalPrice':
    case 'vwap':
      return formatQualityPrice(row[key])
    case 'vsArrivalPct':
      return <span className={favorableClass(row.arrivalFavorable)}>{formatDiffPct(row.vsArrivalPct)}</span>
    case 'vsVwapPct':
      return <span className={favorableClass(row.vwapFavorable)}>{formatDiffPct(row.vsVwapPct)}</span>
    case 'participation':
      return formatParticipation(row.participation)
  }
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
  return direction === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />
}

/** Bảng chi tiết: bấm tiêu đề cột để sắp xếp, bấm dòng (hoặc Enter) để mở chi tiết lệnh. */
export function ReportTable({ rows, sort, onSort }: ReportTableProps) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            {REPORT_COLUMNS.map((column) => {
              const active = sort.key === column.key
              return (
                <TableHead
                  key={column.key}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={cn(column.numeric && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className={cn(
                      'hover:text-foreground inline-flex items-center gap-1',
                      column.numeric && 'flex-row-reverse',
                      active && 'text-foreground',
                    )}
                  >
                    {column.label}
                    <SortIcon active={active} direction={sort.direction} />
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = row.order.parent_order_id
            const open = () => navigate(`/so-lenh/${id}`)
            return (
              <TableRow
                key={id}
                tabIndex={0}
                className="cursor-pointer"
                onClick={open}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') open()
                }}
              >
                {REPORT_COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.numeric && 'text-right tabular-nums',
                      column.key === 'parent_order_id' && 'font-medium tabular-nums',
                    )}
                  >
                    {renderCell(row, column.key)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">
        <span className="text-price-up">Xanh</span>: có lợi (mua thấp hơn, bán cao hơn mốc so sánh).{' '}
        <span className="text-price-down">Đỏ</span>: bất lợi. —: chưa có khớp hoặc chưa đủ dữ liệu thị trường.
      </p>
    </div>
  )
}
