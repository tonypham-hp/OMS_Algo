import { ListOrdered, Plus, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SessionLockNotice } from '@/components/SessionLockNotice'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrders, usePauseOrder, useResumeOrder } from '@/hooks/useOrders'
import { usePermission } from '@/hooks/usePermission'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { isRepriceRequired } from '@/utils/orderActions'
import { CancelOrderDialog } from './CancelOrderDialog'
import { EditOrderDialog } from './EditOrderDialog'
import { EMPTY_FILTERS, filterOrders } from './filterOrders'
import { OrderFilters } from './OrderFilters'
import { OrderTable } from './OrderTable'
import { RepriceOrderDialog } from './RepriceOrderDialog'

export default function OrderBook() {
  const orders = useOrders()
  const pauseOrder = usePauseOrder()
  const resumeOrder = useResumeOrder()
  const hasPermission = usePermission()
  const quotes = useMarketStore((state) => state.quotes)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [editing, setEditing] = useState<ParentOrder | null>(null)
  const [cancelling, setCancelling] = useState<ParentOrder | null>(null)

  const allOrders = orders.data ?? []
  const showAccount = hasPermission('multi_account') || hasPermission('operations')
  const accounts = showAccount ? [...new Set(allOrders.map((order) => order.account_no))].sort() : []
  const actionError = pauseOrder.error?.message ?? resumeOrder.error?.message
  const visibleOrders = filterOrders(allOrders, filters)
  const empty =
    allOrders.length === 0 ? (
      <EmptyState
        icon={ListOrdered}
        title="Chưa có lệnh nào"
        description="Lệnh bạn đặt sẽ hiện ở đây, kèm tiến độ khớp và trạng thái từng lệnh."
        action={
          hasPermission('place_order') && (
            <Button size="sm" asChild>
              <Link to="/dat-lenh">
                <Plus aria-hidden /> Đặt lệnh mới
              </Link>
            </Button>
          )
        }
      />
    ) : (
      <EmptyState
        icon={SearchX}
        title="Không có lệnh nào khớp bộ lọc"
        description="Thử bỏ bớt điều kiện lọc theo mã, trạng thái hoặc loại lệnh."
        action={
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Bỏ lọc
          </Button>
        }
      />
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sổ lệnh nâng cao</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <OrderFilters
          filters={filters}
          onChange={setFilters}
          symbols={quotes.map((quote) => quote.symbol)}
          accounts={accounts}
        />

        <SessionLockNotice />
        {actionError && (
          <p role="alert" className="text-destructive text-sm">
            {actionError}
          </p>
        )}
        {orders.error && (
          <ErrorState
            message={`Không tải được sổ lệnh: ${orders.error.message}`}
            onRetry={() => void orders.refetch()}
          />
        )}

        {orders.isPending ? (
          <LoadingState />
        ) : orders.error && !orders.data ? null : (
          <OrderTable
            orders={visibleOrders}
            empty={empty}
            showAccount={showAccount}
            isBusy={pauseOrder.isPending || resumeOrder.isPending}
            onEdit={setEditing}
            onCancel={setCancelling}
            onPause={(order) => pauseOrder.mutate(order.parent_order_id)}
            onResume={(order) => resumeOrder.mutate(order.parent_order_id)}
          />
        )}

        {editing &&
          (isRepriceRequired(editing.status, editing.reason_code) ? (
            <RepriceOrderDialog key={editing.parent_order_id} order={editing} onClose={() => setEditing(null)} />
          ) : (
            <EditOrderDialog key={editing.parent_order_id} order={editing} onClose={() => setEditing(null)} />
          ))}
        {cancelling && <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} />}
      </CardContent>
    </Card>
  )
}
