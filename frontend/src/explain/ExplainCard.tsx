import { Lightbulb } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useReconcileChild } from '@/hooks/useOperations'
import { useResumeOrder } from '@/hooks/useOrders'
import { RepriceOrderDialog } from '@/pages/OrderBook/RepriceOrderDialog'
import { ReopenOrderDialog } from '@/pages/Operations/ReopenOrderDialog'
import { useAuthStore } from '@/store/auth.store'
import type { OrderDetailData, ParentOrder } from '@/types'
import { explainOrder } from './explain'
import type { ExplainAction } from './types'
import { useExplainMarket } from './useExplainMarket'

interface ExplainCardProps {
  order: ParentOrder
  /** Chưa tải xong chi tiết thì giải thích theo trạng thái lệnh cha. */
  detail: OrderDetailData | undefined
  /** "Xem nhật ký": cuộn tới event liên quan. */
  onShowEvent: (eventId: string) => void
}

/** Thẻ "Vì sao lệnh này…" ở đầu Chi tiết lệnh: câu giải thích sinh theo quy tắc, nút hành động, nguồn dữ kiện. */
export function ExplainCard({ order, detail, onShowEvent }: ExplainCardProps) {
  const role = useAuthStore((state) => state.user?.role ?? 'CUSTOMER')
  const market = useExplainMarket(order.symbol)
  const navigate = useNavigate()
  const resume = useResumeOrder()
  const reconcile = useReconcileChild()
  const [dialog, setDialog] = useState<ExplainAction | null>(null)

  const explanation = useMemo(
    () =>
      explainOrder(order, detail?.children ?? [], detail?.events ?? [], market, role, {
        parameters: detail?.parameters,
        executions: detail?.executions,
        snapshot: detail?.snapshot,
        window: detail?.market,
      }),
    [order, detail, market, role],
  )

  const run = (action: ExplainAction) => {
    switch (action.kind) {
      case 'REPRICE':
      case 'REOPEN':
        setDialog(action)
        return
      case 'SCROLL_LOG':
        if (action.event_id) onShowEvent(action.event_id)
        return
      case 'RESUME':
        resume.mutate(order.parent_order_id)
        return
      case 'RECONCILE':
        if (action.child_order_id) reconcile.mutate(action.child_order_id)
        return
      case 'OPEN_OPS':
        navigate('/van-hanh')
        return
    }
  }
  const error = resume.error?.message ?? reconcile.error?.message

  return (
    <section
      aria-labelledby="explain-title"
      data-demo-id="explain-card"
      data-explain-code={explanation.code}
      className="border-primary/60 bg-primary/5 flex flex-col gap-2 rounded-md border border-l-4 p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-80 gap-2">
          <Lightbulb className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 id="explain-title" className="font-medium">
              {explanation.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed" data-demo-id="explain-text">
              {explanation.text}
            </p>
          </div>
        </div>
        {explanation.actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {explanation.actions.map((action) => (
              // Nút bị tắt không nhận sự kiện chuột, nên đặt title ở thẻ bọc ngoài để vẫn hiện được lý do.
              <span key={action.kind} title={action.reason}>
                <Button
                  size="sm"
                  variant={action.kind === 'REPRICE' || action.kind === 'RESUME' ? 'default' : 'outline'}
                  disabled={!action.enabled || resume.isPending || reconcile.isPending}
                  onClick={() => run(action)}
                >
                  {action.label}
                </Button>
              </span>
            ))}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">Dựa trên: {explanation.sources.join(' · ')}</p>
      {dialog?.kind === 'REPRICE' && <RepriceOrderDialog order={order} suggested={dialog.prices} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'REOPEN' && <ReopenOrderDialog order={order} onClose={() => setDialog(null)} />}
    </section>
  )
}
