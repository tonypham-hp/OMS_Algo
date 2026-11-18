import { CircleCheck, RefreshCw, SearchX, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FilterSelect } from '@/components/FilterSelect'
import { toOptions } from '@/components/filterOptions'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Term } from '@/components/Term'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AUTO_RESOLVED_TYPES,
  OVERFILL_LABEL,
  RECON_STATUS_LABELS,
  RECON_TYPE_LABELS,
  RECON_TYPE_TERMS,
  RECON_TYPES,
} from '@/config/reconcile'
import { useReconciliation, useRunReconciliation } from '@/hooks/useHistory'
import { usePermission } from '@/hooks/usePermission'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import type { ReconRow, ReconRowStatus } from '@/types'
import { defaultDateRange, resolveDateRange, type DateRangeValue } from '@/utils/dateRange'
import { ALL } from '@/utils/execQuality'
import { paginate } from '@/utils/history'
import { getReconSummary, type ReconStep } from '@/utils/reconcile'
import { ReconDecisionDialog } from './ReconDecisionDialog'
import { ChildId, DateRangeFilter, Pagination } from './shared'

const STATUS_STYLES: Record<ReconRowStatus, string> = {
  OPEN: 'bg-red-500/15 text-red-300',
  PENDING_APPROVAL: 'bg-amber-500/15 text-amber-300',
  RESOLVED: 'bg-emerald-500/15 text-emerald-300',
}
const TYPE_OPTIONS = RECON_TYPES.map((type) => ({ value: type as string, label: `${type} · ${RECON_TYPE_LABELS[type]}` }))
const STATUS_OPTIONS = toOptions(RECON_STATUS_LABELS)

function Kpi({ label, value, note, isAlert = false, demoId }: { label: ReactNode; value: number; note: string; isAlert?: boolean; demoId: string }) {
  return (
    <div data-demo-id={demoId} className={cn('bg-card flex flex-col gap-1 rounded-lg border p-4', isAlert && 'border-red-400/70')}>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={cn('text-3xl font-semibold tabular-nums', isAlert && 'text-red-300')}>{formatNumber(value)}</p>
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  )
}

function TypeCell({ row }: { row: ReconRow }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <Term id={RECON_TYPE_TERMS[row.type]}>
        <Badge variant={row.critical ? 'destructive' : 'outline'} className="font-mono">
          {row.type}
        </Badge>
      </Term>
      <span className={cn('text-xs', row.critical ? 'font-semibold text-red-300' : 'text-muted-foreground')}>
        {row.critical ? OVERFILL_LABEL : RECON_TYPE_LABELS[row.type]}
      </span>
    </span>
  )
}

interface Decision {
  row: ReconRow
  step: ReconStep
}

/** Nút xử lý của vận hành: Mở → Đánh dấu; Chờ duyệt → Duyệt, Từ chối (người khác người đánh dấu). */
function RowActions({ row, username, onDecide }: { row: ReconRow; username: string | undefined; onDecide: (decision: Decision) => void }) {
  if (AUTO_RESOLVED_TYPES.has(row.type)) return <span className="text-muted-foreground text-xs">Hệ thống đã xử lý</span>
  if (row.status === 'OPEN') {
    return (
      <Button size="sm" variant="outline" onClick={() => onDecide({ row, step: 'RESOLVE_REQUESTED' })}>
        Đánh dấu đã xử lý
      </Button>
    )
  }
  if (row.status === 'PENDING_APPROVAL') {
    if (row.requested_by === username) return <span className="text-muted-foreground text-xs">Chờ người vận hành khác duyệt</span>
    return (
      <span className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => onDecide({ row, step: 'RESOLVED' })}>
          Duyệt
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDecide({ row, step: 'RESOLVE_REJECTED' })}>
          Từ chối
        </Button>
      </span>
    )
  }
  return <span className="text-muted-foreground text-xs">Duyệt bởi {row.approved_by}</span>
}

/** Tab 3: so OMS với Core theo từng lệnh con. DEALER chỉ xem; OPS đánh dấu đã xử lý theo maker-checker. */
export function ReconTab({ tradingDate }: { tradingDate: string }) {
  const hasPermission = usePermission()
  const canResolve = hasPermission('reconcile_resolve')
  const username = useAuthStore((state) => state.user?.username)
  const [params, setParams] = useSearchParams()
  const [rangeValue, setRangeValue] = useState<DateRangeValue>(defaultDateRange('FIVE_SESSIONS'))
  const [typeFilter, setTypeFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [page, setPage] = useState(1)
  const [decision, setDecision] = useState<Decision | null>(null)
  const range = resolveDateRange(rangeValue, tradingDate)
  const recon = useReconciliation(range)
  const run = useRunReconciliation()

  // Mở từ Ctrl+K "Đối soát ngay" (?run=1): chạy một lần rồi bỏ cờ khỏi URL.
  const autoRun = useRef(params.get('run') === '1')
  useEffect(() => {
    if (!autoRun.current) return
    autoRun.current = false
    run.mutate(range)
    setParams((current) => {
      current.delete('run')
      return current
    }, { replace: true })
  }, [range, run, setParams])

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  if (recon.isPending) return <LoadingState label="Đang đối soát..." />
  if (recon.isError) return <ErrorState message={`Không tải được đối soát: ${recon.error.message}`} onRetry={() => void recon.refetch()} />

  const data = recon.data
  const summary = getReconSummary(data)
  const rows = data.rows.filter((row) => (typeFilter === ALL || row.type === typeFilter) && (statusFilter === ALL || row.status === statusFilter))
  const current = paginate(rows, page)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter idPrefix="recon" value={rangeValue} onChange={resetPage(setRangeValue)} tradingDate={tradingDate} />
          <FilterSelect id="recon-type" label="Loại" value={typeFilter} options={TYPE_OPTIONS} onChange={resetPage(setTypeFilter)} className="w-64" />
          <FilterSelect id="recon-status" label="Trạng thái" value={statusFilter} options={STATUS_OPTIONS} onChange={resetPage(setStatusFilter)} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button data-demo-id="recon-run" disabled={run.isPending} onClick={() => run.mutate(range)}>
            <RefreshCw aria-hidden className={cn(run.isPending && 'animate-spin')} /> {run.isPending ? 'Đang đối soát...' : 'Đối soát ngay'}
          </Button>
          <p className="text-muted-foreground text-xs tabular-nums" data-demo-id="recon-last-run">
            {data.last_run_at
              ? `Lần chạy gần nhất: ${formatDateTime(data.last_run_at)} bởi ${data.last_run_by}`
              : 'Chưa chạy đối soát thủ công trong phiên này'}
          </p>
        </div>
      </div>
      {run.error && (
        <p role="alert" className="text-destructive text-sm">
          {run.error.message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi demoId="recon-kpi-checked" label="Lệnh con đã so" value={summary.checked} note="Tạo trong khoảng ngày, cộng lệnh con chưa kết thúc." />
        <Kpi demoId="recon-kpi-matched" label="Khớp đúng" value={summary.matched} note="OMS và Core ghi cùng trạng thái, cùng KL khớp." />
        <Kpi
          demoId="recon-kpi-open"
          label="Chênh lệch đang mở"
          value={summary.open}
          note={summary.critical > 0 ? `Có ${summary.critical} lỗi nghiêm trọng (OVERFILL).` : 'Gồm cả dòng chờ duyệt.'}
          isAlert={summary.open > 0}
        />
        <Kpi demoId="recon-kpi-resolved" label="Đã xử lý" value={summary.resolved} note="Hệ thống tự xử lý hoặc đã được duyệt." />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>
              Chênh lệch <Term id="reconciliation">đối soát</Term>
            </h2>
          </CardTitle>
          <CardDescription>
            {canResolve
              ? 'Đánh dấu đã xử lý phải có ghi chú, và cần một người vận hành khác duyệt.'
              : 'Chỉ xem. Vận hành xử lý các dòng đang mở.'}
          </CardDescription>
          {summary.critical > 0 && (
            <CardAction>
              <Badge variant="destructive">
                <TriangleAlert aria-hidden /> {OVERFILL_LABEL}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows.length === 0 ? (
            data.rows.length === 0 ? (
              <EmptyState icon={CircleCheck} title="OMS và Core khớp hoàn toàn trong khoảng này." description="Bơm lỗi ở màn Giám sát hệ thống để tạo chênh lệch thử." />
            ) : (
              <EmptyState
                icon={SearchX}
                title="Không có dòng nào khớp bộ lọc."
                action={
                  <Button variant="outline" size="sm" onClick={() => { setTypeFilter(ALL); setStatusFilter(ALL) }}>
                    Bỏ lọc
                  </Button>
                }
              />
            )
          ) : (
            <>
              <Table data-demo-id="recon-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời điểm phát hiện</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Lệnh cha</TableHead>
                    <TableHead>Lệnh con</TableHead>
                    <TableHead>Giá trị OMS</TableHead>
                    <TableHead>Giá trị Core</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ghi chú</TableHead>
                    {canResolve && <TableHead>Xử lý</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.rows.map((row) => (
                    <TableRow key={row.id} data-demo-id={`recon-row-${row.type}`} data-recon-id={row.id} className={cn(row.critical && 'bg-red-500/10')}>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(row.detected_at)}</TableCell>
                      <TableCell>
                        <TypeCell row={row} />
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        <Link className="hover:underline" to={`/so-lenh/${row.parent_order_id}`}>
                          {row.parent_order_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground"><ChildId id={row.child_order_id} /></TableCell>
                      <TableCell className="max-w-48 whitespace-normal">{row.oms_value}</TableCell>
                      <TableCell className="max-w-48 whitespace-normal">{row.core_value}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_STYLES[row.status]}>{RECON_STATUS_LABELS[row.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-56 text-xs whitespace-normal">
                        {row.note ?? '—'}
                        {row.status === 'PENDING_APPROVAL' && row.requested_by && <span className="block">Đánh dấu bởi {row.requested_by}</span>}
                      </TableCell>
                      {canResolve && (
                        <TableCell>
                          <RowActions row={row} username={username} onDecide={setDecision} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={current} onPage={setPage} label="Phân trang chênh lệch đối soát" />
            </>
          )}
        </CardContent>
      </Card>
      {decision && <ReconDecisionDialog row={decision.row} step={decision.step} range={range} onClose={() => setDecision(null)} />}
    </div>
  )
}
