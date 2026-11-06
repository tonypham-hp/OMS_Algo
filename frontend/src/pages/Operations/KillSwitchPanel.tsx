import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useReleaseKillSwitch } from '@/hooks/useOperations'
import type { KillSwitchRequest, OpsOverview, ParentOrder } from '@/types'
import { isTerminalStatus } from '@/utils/orderActions'
import { KillSwitchDialog } from './KillSwitchDialog'

const ALL = 'ALL'

interface KillSwitchPanelProps {
  orders: ParentOrder[]
  overview: OpsOverview
}

export function KillSwitchPanel({ orders, overview }: KillSwitchPanelProps) {
  const release = useReleaseKillSwitch()
  const [scope, setScope] = useState(ALL)
  const [isConfirming, setIsConfirming] = useState(false)
  const { kill_switch: killSwitch } = overview

  const request: KillSwitchRequest = scope === ALL ? { scope: 'ALL' } : { scope: 'ACCOUNT', account_no: scope }
  const scopeLabel = scope === ALL ? 'Toàn hệ thống' : `Tài khoản ${scope}`
  const affectedCount = orders.filter(
    (order) =>
      !isTerminalStatus(order.status) &&
      order.status !== 'CANCEL_PENDING' &&
      order.reason_code !== 'KILL_SWITCH' &&
      (scope === ALL || order.account_no === scope),
  ).length

  const active: Array<{ key: string; label: string; request: KillSwitchRequest }> = [
    ...(killSwitch.global ? [{ key: ALL, label: 'Toàn hệ thống', request: { scope: 'ALL' } as const }] : []),
    ...killSwitch.accounts.map((account) => ({
      key: account,
      label: `Tài khoản ${account}`,
      request: { scope: 'ACCOUNT', account_no: account } as const,
    })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-52 flex-1 flex-col gap-1.5">
          <Label htmlFor="kill_switch_scope">Phạm vi</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger id="kill_switch_scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toàn hệ thống</SelectItem>
              {overview.accounts.map((account) => (
                <SelectItem key={account} value={account}>
                  Tài khoản {account}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="destructive" onClick={() => setIsConfirming(true)}>
          Kích hoạt kill switch
        </Button>
      </div>

      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm">Kill switch đang tắt.</p>
      ) : (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-red-500/60 bg-red-500/10 p-3">
          <p className="text-sm font-medium text-red-300">Kill switch đang bật, không đặt được lệnh mới:</p>
          {active.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
              <span>{item.label}</span>
              <Button size="sm" variant="outline" disabled={release.isPending} onClick={() => release.mutate(item.request)}>
                Gỡ
              </Button>
            </div>
          ))}
          <p className="text-muted-foreground text-xs">Gỡ chỉ cho đặt lệnh mới. Lệnh đã bị dừng vẫn tạm dừng, chỉ còn hủy được.</p>
        </div>
      )}
      {release.error && (
        <p role="alert" className="text-destructive text-sm">
          {release.error.message}
        </p>
      )}

      {isConfirming && (
        <KillSwitchDialog
          request={request}
          scopeLabel={scopeLabel}
          affectedCount={affectedCount}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </div>
  )
}
