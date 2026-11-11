import { Download, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useExecutionReport } from '@/hooks/useExecutionReport'
import { usePermission } from '@/hooks/usePermission'
import type { ExecutionReportData, StrategyType } from '@/types'
import { downloadCsv } from '@/utils/csv'
import {
  buildReportRows,
  DEFAULT_REPORT_FILTERS,
  filterReportRows,
  getReportKpis,
  getStrategyBps,
  sortReportRows,
  type ReportSortKey,
} from '@/utils/execQuality'
import { buildReportCsv, getReportFilename } from '@/utils/reportCsv'
import { ReportFilters } from './ReportFilters'
import { ReportKpis } from './ReportKpis'
import { ReportTable, type ReportSort } from './ReportTable'
import { StrategyChart } from './StrategyChart'

const DEFAULT_SORT: ReportSort = { key: 'parent_order_id', direction: 'desc' }

function ReportBody({ data }: { data: ExecutionReportData }) {
  const hasPermission = usePermission()
  const [filters, setFilters] = useState(DEFAULT_REPORT_FILTERS)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const allRows = useMemo(() => buildReportRows(data), [data])
  const rows = useMemo(
    () => sortReportRows(filterReportRows(allRows, filters, data.trading_date), sort.key, sort.direction),
    [allRows, filters, data.trading_date, sort],
  )

  const unique = <T extends string>(values: T[]) => [...new Set(values)].sort()
  const showAccount = hasPermission('multi_account') || hasPermission('operations')
  const accounts = showAccount ? unique(data.orders.map((order) => order.account_no)) : []
  const symbols = unique(data.orders.map((order) => order.symbol))
  const strategies = unique(data.orders.map((order) => order.strategy_type)) as StrategyType[]

  const toggleSort = (key: ReportSortKey) =>
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    )

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <ReportFilters filters={filters} onChange={setFilters} symbols={symbols} strategies={strategies} accounts={accounts} />
        <Button
          variant="outline"
          disabled={rows.length === 0}
          onClick={() => downloadCsv(getReportFilename(data.trading_date), buildReportCsv(rows))}
        >
          <Download aria-hidden /> Xuất Excel
        </Button>
      </div>
      <ReportKpis kpis={getReportKpis(rows)} />
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>Chi tiết theo lệnh</h2>
          </CardTitle>
          <CardDescription>{rows.length} lệnh. Bấm một dòng để mở chi tiết lệnh.</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length > 0 ? (
            <ReportTable rows={rows} sort={sort} onSort={toggleSort} />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Không có lệnh nào khớp bộ lọc."
              description="Thử chọn 5 phiên, hoặc gồm cả lệnh đang chạy."
              action={
                <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_REPORT_FILTERS)}>
                  Bỏ lọc
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>So với arrival theo chiến lược</h2>
          </CardTitle>
          <CardDescription>Phải là có lợi, trái là bất lợi. Đơn vị: điểm cơ bản (bps).</CardDescription>
        </CardHeader>
        <CardContent>
          <StrategyChart stats={getStrategyBps(rows)} />
        </CardContent>
      </Card>
    </>
  )
}

/** Báo cáo hiệu quả thực hiện: so giá BQ với arrival và VWAP thị trường, tỷ lệ tham gia. */
export default function ExecutionReport() {
  const report = useExecutionReport()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Hiệu quả thực hiện lệnh</h1>
        <p className="text-muted-foreground text-sm">
          So giá khớp bình quân của từng lệnh với giá lúc kích hoạt (arrival) và VWAP toàn thị trường trong cùng khoảng
          thời gian.
        </p>
      </div>
      {report.isPending ? (
        <LoadingState label="Đang tải báo cáo..." />
      ) : report.isError ? (
        <ErrorState message={`Không tải được báo cáo: ${report.error.message}`} onRetry={() => void report.refetch()} />
      ) : (
        <ReportBody data={report.data} />
      )}
    </div>
  )
}
