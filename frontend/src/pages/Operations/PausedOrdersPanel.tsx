import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { REASON_LABELS } from '@/config/opsAlerts'
import type { OpsOverview, ParentOrder } from '@/types'
import { getReopenBlock } from '@/utils/orderActions'
import { ReopenOrderDialog } from './ReopenOrderDialog'

interface PausedOrdersPanelProps {
  orders: ParentOrder[]
  overview: OpsOverview
}

export function PausedOrdersPanel({ orders, overview }: PausedOrdersPanelProps) {
  const [reopening, setReopening] = useState<ParentOrder | null>(null)
  const paused = orders.filter((order) => order.status === 'PAUSED_SYSTEM')
  const { kill_switch: killSwitch } = overview

  if (paused.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Không có lệnh nào bị hệ thống tạm dừng.</p>
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã lệnh</TableHead>
            <TableHead>Mã</TableHead>
            <TableHead>Tài khoản</TableHead>
            <TableHead>Lý do tạm dừng</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paused.map((order) => {
            const isKillSwitched = killSwitch.global || killSwitch.accounts.includes(order.account_no)
            const block = getReopenBlock(order.reason_code, isKillSwitched, overview.is_feed_stale)
            return (
              <TableRow key={order.parent_order_id} data-paused-order={order.symbol}>
                <TableCell>
                  <Link to={`/so-lenh/${order.parent_order_id}`} className="font-mono text-xs hover:underline">
                    {order.parent_order_id}
                  </Link>
                </TableCell>
                <TableCell className="font-semibold">{order.symbol}</TableCell>
                <TableCell className="tabular-nums">{order.account_no}</TableCell>
                <TableCell className="whitespace-normal">
                  {order.reason_code ? REASON_LABELS[order.reason_code] : 'Khác'}
                </TableCell>
                <TableCell className="text-right whitespace-normal">
                  {/* Nút bị tắt không nhận sự kiện chuột, nên đặt title ở thẻ bọc ngoài để vẫn hiện được lý do. */}
                  <span title={block ?? undefined}>
                    <Button size="sm" variant="outline" disabled={block !== null} onClick={() => setReopening(order)}>
                      Mở lại
                    </Button>
                  </span>
                  {block && <p className="text-muted-foreground mt-1 text-xs">{block}</p>}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {reopening && (
        <ReopenOrderDialog key={reopening.parent_order_id} order={reopening} onClose={() => setReopening(null)} />
      )}
    </>
  )
}
