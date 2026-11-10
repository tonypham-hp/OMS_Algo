import { ErrorState, LoadingState } from '@/components/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useOpsOverview } from '@/hooks/useOperations'
import { useOrders } from '@/hooks/useOrders'
import { FaultInjectionPanel } from './FaultInjectionPanel'
import { KillSwitchPanel } from './KillSwitchPanel'
import { OpsAlertList } from './OpsAlertList'
import { OpsStatCards } from './OpsStatCards'
import { PausedOrdersPanel } from './PausedOrdersPanel'

export default function Operations() {
  const overview = useOpsOverview()
  const orders = useOrders()
  const allOrders = orders.data ?? []
  const error = overview.error ?? orders.error

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Màn vận hành</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {overview.isPending && <LoadingState />}
          {error && <ErrorState message={`Không tải được dữ liệu vận hành: ${error.message}`} />}
          {overview.data && <OpsStatCards overview={overview.data} />}
        </CardContent>
      </Card>

      {overview.data && (
        <>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <h2>Cảnh báo ({overview.data.alerts.length})</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OpsAlertList alerts={overview.data.alerts} />
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <h2>Kill switch</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <KillSwitchPanel orders={allOrders} overview={overview.data} />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Lệnh hệ thống tạm dừng</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PausedOrdersPanel orders={allOrders} overview={overview.data} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Bơm lỗi demo</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FaultInjectionPanel orders={allOrders} overview={overview.data} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
