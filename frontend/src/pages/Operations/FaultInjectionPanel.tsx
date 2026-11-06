import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { useInjectFault, type FaultCommand } from '@/hooks/useOperations'
import type { OpsOverview, ParentOrder, PendingFaultType } from '@/types'
import { isRunningStatus } from '@/utils/orderActions'

const PENDING_LABELS: Record<PendingFaultType, string> = {
  REJECT: 'Core từ chối',
  LOST_ACK: 'Mất ACK',
}

interface FaultInjectionPanelProps {
  orders: ParentOrder[]
  overview: OpsOverview
}

export function FaultInjectionPanel({ orders, overview }: FaultInjectionPanelProps) {
  const inject = useInjectFault()
  const [pickedId, setPickedId] = useState('')
  const [done, setDone] = useState<string | null>(null)

  const running = orders.filter((order) => isRunningStatus(order.status))
  // Lệnh đã chọn có thể vừa kết thúc hoặc bị tạm dừng: khi đó tự chuyển sang lệnh đang chạy đầu tiên.
  const targetId = running.some((order) => order.parent_order_id === pickedId)
    ? pickedId
    : (running[0]?.parent_order_id ?? '')

  const run = (command: FaultCommand, message: string) => {
    setDone(null)
    inject.mutate(command, { onSuccess: () => setDone(message) })
  }

  const scenarios = [
    {
      code: 'TC-E2E-130',
      title: 'Core từ chối lệnh con tiếp theo',
      expected: 'Child REJECTED. Từ chối 2 lần liên tiếp thì Parent PAUSED_SYSTEM.',
      button: 'Bơm lỗi',
      needsOrder: true,
      run: () => run({ type: 'reject', parentOrderId: targetId }, `Đã bơm: Core sẽ từ chối lệnh con tiếp theo của ${targetId}.`),
    },
    {
      code: 'TC-E2E-141',
      title: 'Mất ACK từ Core',
      expected: 'Child UNKNOWN, khoảng 5 giây sau đối soát ra trạng thái thật, không gửi trùng.',
      button: 'Bơm lỗi',
      needsOrder: true,
      run: () => run({ type: 'lost-ack', parentOrderId: targetId }, `Đã bơm: lệnh con tiếp theo của ${targetId} sẽ mất ACK.`),
    },
    {
      code: 'TC-E2E-150',
      title: 'Báo khớp trùng',
      expected: 'Bỏ qua bản lặp, KL không tăng, ghi nhật ký.',
      button: 'Bơm lỗi',
      needsOrder: true,
      run: () => run({ type: 'duplicate-fill', parentOrderId: targetId }, `Đã gửi lại báo khớp cuối của ${targetId}: bản lặp bị bỏ qua.`),
    },
    {
      code: 'TC-E2E-180',
      title: 'Dữ liệu giá trễ',
      expected: 'Các lệnh đang chạy PAUSED_SYSTEM, có giá mới thì chạy lại.',
      button: overview.feed_fault_active ? 'Có giá mới' : 'Làm trễ giá',
      needsOrder: false,
      run: () =>
        overview.feed_fault_active
          ? run({ type: 'market-data', stale: false }, 'Đã có giá mới: các lệnh sẽ tự chạy lại ở nhịp kế tiếp.')
          : run({ type: 'market-data', stale: true }, 'Đã ngừng cập nhật giá: sau 5 giây giả lập sẽ tính là trễ.'),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-xl flex-col gap-1.5">
        <Label htmlFor="fault_target">Lệnh áp dụng (TC-E2E-130, 141, 150)</Label>
        <Select value={targetId} onValueChange={setPickedId} disabled={running.length === 0}>
          <SelectTrigger id="fault_target" className="w-full">
            <SelectValue placeholder="Không có lệnh đang chạy" />
          </SelectTrigger>
          <SelectContent>
            {running.map((order) => (
              <SelectItem key={order.parent_order_id} value={order.parent_order_id}>
                {order.parent_order_id} · {order.symbol} · {SIDE_LABELS[order.side]} · {STRATEGIES[order.strategy_type].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Kịch bản</TableHead>
            <TableHead>Kết quả mong đợi</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scenarios.map((scenario) => (
            <TableRow key={scenario.code} data-scenario={scenario.code}>
              <TableCell className="font-mono text-xs">{scenario.code}</TableCell>
              <TableCell>{scenario.title}</TableCell>
              <TableCell className="text-muted-foreground whitespace-normal">{scenario.expected}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={inject.isPending || (scenario.needsOrder && targetId === '')}
                  onClick={scenario.run}
                >
                  {scenario.button}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {overview.pending_faults.length > 0 && (
        <div role="status" className="text-sm">
          <p className="font-medium">Đang chờ lệnh con tiếp theo được gửi:</p>
          <ul className="text-muted-foreground mt-1 list-inside list-disc">
            {overview.pending_faults.map((fault, index) => (
              <li key={`${fault.parent_order_id}-${fault.type}-${index}`}>
                {PENDING_LABELS[fault.type]}: {fault.parent_order_id}
              </li>
            ))}
          </ul>
        </div>
      )}
      {done && !inject.error && (
        <p role="status" className="text-sm text-sky-300">
          {done}
        </p>
      )}
      {inject.error && (
        <p role="alert" className="text-destructive text-sm">
          {inject.error.message}
        </p>
      )}
    </div>
  )
}
