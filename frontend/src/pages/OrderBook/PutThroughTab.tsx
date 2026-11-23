import { Handshake, Plus } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SIDE_LABELS } from '@/config/strategies'
import { usePutThroughAction, usePutThroughs } from '@/hooks/usePutThrough'
import { formatDateTime, formatNumber } from '@/lib/format'
import { putThroughStatusStyle } from '@/utils/putThrough'
import { PutThroughDialog } from './PutThroughDialog'

/**
 * Tab "Thỏa thuận" của Sổ lệnh: lệnh thỏa thuận và trạng thái. Bên đối ứng là mô phỏng: người xem bấm thay
 * "Đối ứng xác nhận" / "Đối ứng từ chối". Chỉ hủy được khi chưa khớp.
 */
export function PutThroughTab() {
  const deals = usePutThroughs()
  const action = usePutThroughAction()
  const [creating, setCreating] = useState(false)
  const list = [...(deals.data?.deals ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Lệnh thỏa thuận đi thẳng tới bên đối ứng, không qua sổ lệnh khớp lệnh: không làm đổi sổ lệnh 3 mức và không tính vào VWAP
          khớp lệnh của báo cáo.
        </p>
        <Button size="sm" onClick={() => setCreating(true)} data-demo-id="put-through-new">
          <Plus aria-hidden /> Tạo lệnh thỏa thuận
        </Button>
      </div>
      {action.error && (
        <p role="alert" className="text-destructive text-sm">
          {action.error.message}
        </p>
      )}
      {deals.isPending ? (
        <LoadingState />
      ) : deals.error ? (
        <ErrorState message={`Không tải được lệnh thỏa thuận: ${deals.error.message}`} onRetry={() => void deals.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Handshake} title="Chưa có lệnh thỏa thuận" description="Lệnh thỏa thuận bạn gửi sẽ hiện ở đây cùng trạng thái xác nhận." />
      ) : (
        <div className="overflow-x-auto">
          <Table data-demo-id="put-through-table">
            <TableHeader>
              <TableRow>
                <TableHead>Mã lệnh</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Tài khoản</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Chiều</TableHead>
                <TableHead className="text-right">KL</TableHead>
                <TableHead className="text-right">Giá</TableHead>
                <TableHead>Đối ứng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((deal) => {
                const style = putThroughStatusStyle(deal.status)
                const pending = deal.status === 'PENDING_CONFIRM'
                const busy = action.isPending
                return (
                  <TableRow key={deal.deal_id} data-demo-id={`put-through-row-${deal.deal_id}`}>
                    <TableCell className="font-mono text-xs">{deal.deal_id}</TableCell>
                    <TableCell className="tabular-nums">{formatDateTime(deal.matched_at ?? deal.created_at)}</TableCell>
                    <TableCell>{deal.account_no}</TableCell>
                    <TableCell className="font-semibold">{deal.symbol}</TableCell>
                    <TableCell>{SIDE_LABELS[deal.side]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(deal.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(deal.price)}</TableCell>
                    <TableCell>{deal.counterparty_account}</TableCell>
                    <TableCell>
                      <Badge className={style.className}>{style.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {pending && (
                          <>
                            <Button size="xs" variant="outline" disabled={busy} onClick={() => action.mutate({ id: deal.deal_id, action: 'confirm' })}>
                              Đối ứng xác nhận
                            </Button>
                            <Button size="xs" variant="ghost" disabled={busy} onClick={() => action.mutate({ id: deal.deal_id, action: 'reject' })}>
                              Đối ứng từ chối
                            </Button>
                          </>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={busy || !pending}
                          title={deal.status === 'MATCHED' ? 'Lệnh thỏa thuận đã khớp: không sửa, không hủy được' : undefined}
                          onClick={() => action.mutate({ id: deal.deal_id, action: 'cancel' })}
                        >
                          Hủy
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="text-muted-foreground mt-2 text-xs">"Đối ứng xác nhận / từ chối" mô phỏng thao tác của bên đối ứng.</p>
        </div>
      )}
      {creating && <PutThroughDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
