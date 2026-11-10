import { useState } from 'react'
import { SessionLockNotice } from '@/components/SessionLockNotice'
import { ErrorState, LoadingState } from '@/components/states'
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
        ) : (
          <OrderTable
            orders={filterOrders(allOrders, filters)}
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
