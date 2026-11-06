import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SESSION_LABELS } from '@/config/hose'
import { useOrders, usePauseOrder, useResumeOrder } from '@/hooks/useOrders'
import { usePermission } from '@/hooks/usePermission'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { isModifyCancelAllowed } from '@/utils/hose'
import { CancelOrderDialog } from './CancelOrderDialog'
import { EditOrderDialog } from './EditOrderDialog'
import { EMPTY_FILTERS, filterOrders } from './filterOrders'
import { OrderFilters } from './OrderFilters'
import { OrderTable } from './OrderTable'

export default function OrderBook() {
  const orders = useOrders()
  const pauseOrder = usePauseOrder()
  const resumeOrder = useResumeOrder()
  const hasPermission = usePermission()
  const session = useMarketStore((state) => state.session)
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

        {!isModifyCancelAllowed(session) && (
          <p role="status" className="rounded-md bg-amber-500/15 p-2 text-sm text-amber-300">
            Đang trong {SESSION_LABELS[session]}: tạm khóa Sửa và Hủy lệnh theo luật HOSE.
          </p>
        )}
        {actionError && (
          <p role="alert" className="text-destructive text-sm">
            {actionError}
          </p>
        )}
        {orders.error && (
          <p role="alert" className="text-destructive text-sm">
            Không tải được sổ lệnh: {orders.error.message}
          </p>
        )}

        {orders.isPending ? (
          <p className="text-muted-foreground text-sm">Đang tải...</p>
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

        {editing && (
          <EditOrderDialog key={editing.parent_order_id} order={editing} onClose={() => setEditing(null)} />
        )}
        {cancelling && <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} />}
      </CardContent>
    </Card>
  )
}
