import { useNavigate } from 'react-router-dom'
import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AttentionItem, AttentionKind } from '@/utils/dashboard'

const KIND_STYLES: Record<AttentionKind, { label: string; className: string }> = {
  UNKNOWN: { label: 'Chưa rõ', className: 'bg-red-500/20 text-red-300' },
  REJECTED: { label: 'Bị từ chối', className: 'bg-red-500/20 text-red-300' },
  PAUSED_SYSTEM: { label: 'Hệ thống dừng', className: 'bg-amber-500/20 text-amber-300' },
}

/** Lệnh cần chú ý; bấm một dòng (hoặc Enter khi đang chọn dòng) để mở chi tiết lệnh. */
export function AttentionTable({ items }: { items: AttentionItem[] }) {
  const navigate = useNavigate()
  return (
    <Table data-demo-id="attention-table">
      <TableHeader>
        <TableRow>
          <TableHead>Mã lệnh</TableHead>
          <TableHead>Mã CK</TableHead>
          <TableHead>Vấn đề</TableHead>
          <TableHead>Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const id = item.order.parent_order_id
          const open = () => navigate(`/so-lenh/${id}`)
          return (
            <TableRow
              key={`${id}-${item.kind}`}
              tabIndex={0}
              className="cursor-pointer"
              onClick={open}
              onKeyDown={(event) => {
                if (event.key === 'Enter') open()
              }}
            >
              <TableCell className="font-medium tabular-nums">{id}</TableCell>
              <TableCell>{item.order.symbol}</TableCell>
              <TableCell className="whitespace-normal">
                <Badge className={cn(KIND_STYLES[item.kind].className, 'mr-2')}>{KIND_STYLES[item.kind].label}</Badge>
                {item.issue}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={item.order.status} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
