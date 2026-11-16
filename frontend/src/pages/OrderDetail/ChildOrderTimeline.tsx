import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CHILD_STATUS_STYLES } from '@/config/orderStatus'
import { SIDE_LABELS } from '@/config/strategies'
import { explainChild } from '@/explain/explain'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChildOrder, ChildOrderStatus, OrderEvent } from '@/types'
import { NUMBER_CELL, SCROLL_TABLE, STICKY_HEADER } from './tableStyles'

const ALERT_STATUSES: ReadonlySet<ChildOrderStatus> = new Set(['UNKNOWN', 'REJECTED'])
const COLUMN_COUNT = 9

interface ChildOrderTimelineProps {
  items: ChildOrder[]
  /** Nhật ký của lệnh cha, để giải thích từng lệnh con. */
  events?: OrderEvent[]
}

/**
 * Mỗi lệnh con một dòng, lệnh mới nhất ở trên. UNKNOWN, REJECTED được tô nổi bật.
 * Bấm (hoặc Enter, Space) vào một dòng để xem câu giải thích riêng của lệnh con đó.
 */
export function ChildOrderTimeline({ items, events = [] }: ChildOrderTimelineProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Chưa sinh lệnh con nào.</p>
  }

  return (
    <div className={SCROLL_TABLE}>
      <Table>
        <TableHeader className={STICKY_HEADER}>
          <TableRow>
            <TableHead className="w-6">
              <span className="sr-only">Giải thích</span>
            </TableHead>
            <TableHead className="text-right">Chu kỳ</TableHead>
            <TableHead>Chiều</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead className="text-right">Giá</TableHead>
            <TableHead className="text-right">KL</TableHead>
            <TableHead className="text-right">Đã khớp</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="text-right">Thời điểm gửi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.toReversed().map((child) => {
            const style = CHILD_STATUS_STYLES[child.status]
            const isOpen = openId === child.child_order_id
            const toggle = () => setOpenId(isOpen ? null : child.child_order_id)
            const explainId = `child-explain-${child.child_order_id}`
            return (
              <Fragment key={child.child_order_id}>
                <TableRow
                  data-child-id={child.child_order_id}
                  data-demo-id={`child-${child.child_order_id}`}
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={isOpen ? explainId : undefined}
                  aria-label={`Lệnh con chu kỳ ${child.cycle_no}, ${style.label}. Bấm để xem giải thích`}
                  onClick={toggle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggle()
                    }
                  }}
                  className={cn(
                    'cursor-pointer',
                    ALERT_STATUSES.has(child.status) && 'border-l-2 border-l-red-500 bg-red-500/15 font-medium hover:bg-red-500/20',
                    isOpen && 'bg-primary/10',
                  )}
                >
                  <TableCell className="text-muted-foreground">
                    {isOpen ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
                  </TableCell>
                  <TableCell className={NUMBER_CELL}>{child.cycle_no}</TableCell>
                  <TableCell>{SIDE_LABELS[child.side]}</TableCell>
                  <TableCell>{child.order_type}</TableCell>
                  <TableCell className={NUMBER_CELL}>{child.price === null ? '—' : formatNumber(child.price)}</TableCell>
                  <TableCell className={NUMBER_CELL}>{formatNumber(child.quantity)}</TableCell>
                  <TableCell className={NUMBER_CELL}>{formatNumber(child.filled_qty)}</TableCell>
                  <TableCell>
                    <Badge className={style.className} data-demo-id={`child-status-${child.child_order_id}`}>
                      {style.label}
                    </Badge>
                  </TableCell>
                  <TableCell className={NUMBER_CELL}>{child.sent_at ? formatDateTime(child.sent_at) : '—'}</TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={COLUMN_COUNT} className="whitespace-normal">
                      <p id={explainId} role="status" className="border-primary/60 bg-primary/5 rounded-md border-l-4 px-3 py-2 text-sm" data-demo-id="child-explain">
                        {explainChild(child, events).text}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
