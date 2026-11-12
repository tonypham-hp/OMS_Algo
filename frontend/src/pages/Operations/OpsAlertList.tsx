import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OPS_ALERT_STYLES } from '@/config/opsAlerts'
import { useReconcileChild } from '@/hooks/useOperations'
import { formatDateTime } from '@/lib/format'
import type { OpsAlert } from '@/types'

function AlertContent({ alert }: { alert: OpsAlert }) {
  const style = OPS_ALERT_STYLES[alert.type]
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className={style.className}>{style.label}</Badge>
        <span className="text-muted-foreground text-xs tabular-nums">{formatDateTime(alert.time)}</span>
      </div>
      <p className="mt-1 text-sm">{alert.message}</p>
    </>
  )
}

/** Cảnh báo đang tồn tại, mới nhất ở trên. Bấm vào cảnh báo của một lệnh để mở Chi tiết lệnh. */
export function OpsAlertList({ alerts }: { alerts: OpsAlert[] }) {
  const reconcile = useReconcileChild()

  if (alerts.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Không có cảnh báo nào.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {reconcile.error && (
        <p role="alert" className="text-destructive text-sm">
          {reconcile.error.message}
        </p>
      )}
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto" data-demo-id="ops-alerts">
        {alerts.map((alert) => (
          <li key={alert.alert_id} data-alert-type={alert.type} className="flex items-stretch gap-2">
            {alert.parent_order_id ? (
              <Link
                to={`/so-lenh/${alert.parent_order_id}`}
                className="hover:bg-accent block min-w-0 flex-1 rounded-md border p-2"
              >
                <AlertContent alert={alert} />
              </Link>
            ) : (
              <div className="min-w-0 flex-1 rounded-md border p-2">
                <AlertContent alert={alert} />
              </div>
            )}
            {/* Nút đặt ngoài Link: lồng nút trong thẻ a là HTML sai và bấm nút sẽ mở luôn trang chi tiết. */}
            {alert.type === 'CHILD_UNKNOWN' && alert.child_order_id && (
              <Button
                size="sm"
                variant="outline"
                className="h-auto self-stretch"
                disabled={reconcile.isPending}
                onClick={() => reconcile.mutate(alert.child_order_id as string)}
              >
                Đối soát ngay
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
