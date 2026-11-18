import { Download, Lock, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterSelect } from '@/components/FilterSelect'
import { EmptyState } from '@/components/states'
import { Term } from '@/components/Term'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { REASON_TEXT } from '@/explain/reasonText'
import { formatDateTime } from '@/lib/format'
import { EVENT_ACTION_LABELS, formatEventChange } from '@/pages/OrderDetail/eventFormat'
import type { HistoryData } from '@/types'
import {
  AUDIT_ACTIONS,
  buildAuditCsv,
  DEFAULT_AUDIT_FILTERS,
  filterAuditEvents,
  formatAuditActor,
  formatAuditChannel,
  getAuditActors,
  getAuditFilename,
  type AuditFilters,
} from '@/utils/audit'
import { downloadCsv } from '@/utils/csv'
import { paginate } from '@/utils/history'
import { DateRangeFilter, Pagination } from './shared'

const ACTION_OPTIONS = AUDIT_ACTIONS.map((action) => ({ value: action, label: `${action} · ${EVENT_ACTION_LABELS[action]}` }))

/** Tab 2: toàn bộ OrderEvent, chỉ đọc. Khách hàng chỉ thấy lệnh của mình, người khác hiện là "Người dùng khác". */
export function AuditTab({ data }: { data: HistoryData }) {
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_AUDIT_FILTERS)
  const [page, setPage] = useState(1)
  const events = useMemo(() => filterAuditEvents(data.events, filters, data.trading_date), [data, filters])
  const current = paginate(events, page)
  const actors = getAuditActors(data.events).map((actor) => ({ value: actor, label: formatAuditActor(actor) }))
  const update = (patch: Partial<AuditFilters>) => {
    setFilters((value) => ({ ...value, ...patch }))
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter idPrefix="audit" value={filters.range} onChange={(value) => update({ range: value })} tradingDate={data.trading_date} />
          <FilterSelect id="audit-action" label="Hành động" value={filters.action} options={ACTION_OPTIONS} onChange={(value) => update({ action: value as AuditFilters['action'] })} className="w-56" />
          <FilterSelect id="audit-actor" label="Người thực hiện" value={filters.actor} options={actors} onChange={(value) => update({ actor: value })} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-order">Mã lệnh</Label>
            <Input id="audit-order" className="w-44" placeholder="Lệnh cha hoặc lệnh con" autoComplete="off" value={filters.orderId} onChange={(event) => update({ orderId: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-query">Tìm (không dấu)</Label>
            <Input id="audit-query" type="search" className="w-52" placeholder="vd: doi soat, khop trung" autoComplete="off" value={filters.query} onChange={(event) => update({ query: event.target.value })} />
          </div>
          <Button variant="ghost" onClick={() => update(DEFAULT_AUDIT_FILTERS)}>
            Bỏ lọc
          </Button>
        </div>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <h2>
              <Term id="audit-log">Nhật ký kiểm toán</Term>
            </h2>
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden /> Chỉ đọc: mọi thay đổi trạng thái lệnh được ghi lại, không sửa hay xóa được. Mới nhất ở trên.
          </CardDescription>
          <CardAction>
            <Button variant="outline" disabled={events.length === 0} onClick={() => downloadCsv(getAuditFilename(data.trading_date), buildAuditCsv(events))}>
              <Download aria-hidden /> Xuất CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {events.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Không có sự kiện nào khớp bộ lọc."
              description="Thử chọn 5 phiên, bỏ lọc hành động hoặc tìm bằng từ khác."
              action={
                <Button variant="outline" size="sm" onClick={() => update(DEFAULT_AUDIT_FILTERS)}>
                  Bỏ lọc
                </Button>
              }
            />
          ) : (
            <>
              <Table data-demo-id="audit-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Mã lệnh cha</TableHead>
                    <TableHead>Mã lệnh con</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Người thực hiện · Kênh</TableHead>
                    <TableHead>Giá trị cũ → mới</TableHead>
                    <TableHead>Mã lý do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.rows.map((event) => (
                    <TableRow key={event.event_id} data-demo-id={`audit-row-${event.event_id}`}>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(event.event_time)}</TableCell>
                      <TableCell className="font-medium tabular-nums">
                        <Link className="hover:underline" to={`/so-lenh/${event.parent_order_id}`}>
                          {event.parent_order_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-32 text-xs break-all whitespace-normal tabular-nums">{event.child_order_id ?? '—'}</TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span>{EVENT_ACTION_LABELS[event.action]}</span>
                          <span className="text-muted-foreground font-mono text-[11px]">{event.action}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col">
                          <span>{formatAuditActor(event.user_id)}</span>
                          <span className="text-muted-foreground text-xs">{formatAuditChannel(event.channel)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal">{formatEventChange(event)}</TableCell>
                      <TableCell className="max-w-56 whitespace-normal">
                        {event.reason_code ? (
                          <span className="flex flex-col">
                            <span className="font-mono text-[11px]">{event.reason_code}</span>
                            <span className="text-muted-foreground text-xs">{REASON_TEXT[event.reason_code]}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={current} onPage={setPage} label="Phân trang nhật ký kiểm toán" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
