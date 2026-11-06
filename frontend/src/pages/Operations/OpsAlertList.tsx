import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { OPS_ALERT_STYLES } from '@/config/opsAlerts'
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
  if (alerts.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Không có cảnh báo nào.</p>
  }

  return (
    <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
      {alerts.map((alert) => (
        <li key={alert.alert_id} data-alert-type={alert.type}>
          {alert.parent_order_id ? (
            <Link to={`/so-lenh/${alert.parent_order_id}`} className="hover:bg-accent block rounded-md border p-2">
              <AlertContent alert={alert} />
            </Link>
          ) : (
            <div className="rounded-md border p-2">
              <AlertContent alert={alert} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
