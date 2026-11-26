import { ListOrdered, Plus, SearchX } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { SessionLockNotice } from '@/components/SessionLockNotice'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useOrders, usePauseOrder, useResumeOrder } from '@/hooks/useOrders'
import { usePermission } from '@/hooks/usePermission'
import { useMarketStore } from '@/store/market.store'
import type { ParentOrder } from '@/types'
import { isRepriceRequired, isRunningStatus } from '@/utils/orderActions'
import { CancelOrderDialog } from './CancelOrderDialog'
import { EditOrderDialog } from './EditOrderDialog'
import { ALL, EMPTY_FILTERS, filterOrders, type OrderFilterValues } from './filterOrders'
import { OrderFilters } from './OrderFilters'
import { OrderTable } from './OrderTable'
import { RepriceOrderDialog } from './RepriceOrderDialog'

export interface OrderBlotterProps {
  /** Chỉ lệnh thuật toán đang chạy (panel "Thuật toán đang chạy" của Bàn làm việc). */
  runningOnly?: boolean
  /**
   * Lọc theo mã của nhóm liên kết (Bàn làm việc). Đổi mã ở ô lọc thì đổi mã của cả nhóm;
   * chọn "Tất cả" thì thôi lọc theo nhóm (`onFollowSymbolChange(null)`).
   */
  followSymbol?: string | null
  onFollowSymbolChange?: (symbol: string | null) => void
  onOpenOrder?: (orderId: string) => void
  selectedOrderId?: string | null
}

/**
 * Danh sách lệnh cha: bộ lọc, bảng, hộp Sửa/Hủy/Tạm dừng. Dùng ở tab "Lệnh" của Sổ lệnh và ở panel Sổ lệnh,
 * Thuật toán đang chạy của Bàn làm việc.
 */
export function OrderBlotter({
  runningOnly = false,
  followSymbol = null,
  onFollowSymbolChange,
  onOpenOrder,
  selectedOrderId = null,
}: OrderBlotterProps) {
  const orders = useOrders()
  const pauseOrder = usePauseOrder()
  const resumeOrder = useResumeOrder()
  const hasPermission = usePermission()
  // Chỉ cần danh sách mã cho bộ lọc: không theo dõi cả bảng giá, để nhịp giá không vẽ lại toàn bộ Sổ lệnh.
  const symbols = useMarketStore(useShallow((state) => state.quotes.map((quote) => quote.symbol)))
  const { mutate: pause } = pauseOrder
  const { mutate: resume } = resumeOrder
  // Hàm ổn định giữa các lần vẽ để các dòng (memo) không bị vẽ lại vô ích.
  const onPause = useCallback((order: ParentOrder) => pause(order.parent_order_id), [pause])
  const onResume = useCallback((order: ParentOrder) => resume(order.parent_order_id), [resume])
  const [ownFilters, setFilters] = useState(EMPTY_FILTERS)
  const [editing, setEditing] = useState<ParentOrder | null>(null)
  const [cancelling, setCancelling] = useState<ParentOrder | null>(null)

  const filters: OrderFilterValues = followSymbol ? { ...ownFilters, symbol: followSymbol } : ownFilters
  const changeFilters = (next: OrderFilterValues) => {
    if (followSymbol && next.symbol !== followSymbol) {
      onFollowSymbolChange?.(next.symbol === ALL ? null : next.symbol)
    }
    setFilters({ ...next, symbol: followSymbol && next.symbol !== ALL ? ALL : next.symbol })
  }

  const allOrders = (orders.data ?? []).filter((order) => !runningOnly || isRunningStatus(order.status))
  const showAccount = hasPermission('multi_account') || hasPermission('operations')
  const accounts = showAccount ? [...new Set(allOrders.map((order) => order.account_no))].sort() : []
  const actionError = pauseOrder.error?.message ?? resumeOrder.error?.message
  const visibleOrders = filterOrders(allOrders, filters)
  const empty =
    allOrders.length === 0 ? (
      <EmptyState
        icon={ListOrdered}
        title={runningOnly ? 'Không có lệnh thuật toán nào đang chạy' : 'Chưa có lệnh nào'}
        description="Lệnh bạn đặt sẽ hiện ở đây, kèm tiến độ khớp và trạng thái từng lệnh."
        action={
          hasPermission('place_order') &&
          !onOpenOrder && (
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
        description={followSymbol ? `Đang lọc theo mã ${followSymbol} của nhóm liên kết.` : 'Thử bỏ bớt điều kiện lọc theo mã, trạng thái hoặc loại lệnh.'}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              if (followSymbol) onFollowSymbolChange?.(null)
            }}
          >
            Bỏ lọc
          </Button>
        }
      />
    )

  return (
    <div className="flex flex-col gap-4">
      <OrderFilters filters={filters} onChange={changeFilters} symbols={symbols} accounts={accounts} />

      <SessionLockNotice />
      {actionError && (
        <p role="alert" className="text-destructive text-sm">
          {actionError}
        </p>
      )}
      {orders.error && (
        <ErrorState message={`Không tải được sổ lệnh: ${orders.error.message}`} onRetry={() => void orders.refetch()} />
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
          onPause={onPause}
          onResume={onResume}
          onOpenOrder={onOpenOrder}
          selectedOrderId={selectedOrderId}
        />
      )}

      {editing &&
        (isRepriceRequired(editing.status, editing.reason_code) ? (
          <RepriceOrderDialog key={editing.parent_order_id} order={editing} onClose={() => setEditing(null)} />
        ) : (
          <EditOrderDialog key={editing.parent_order_id} order={editing} onClose={() => setEditing(null)} />
        ))}
      {cancelling && <CancelOrderDialog order={cancelling} onClose={() => setCancelling(null)} />}
    </div>
  )
}
