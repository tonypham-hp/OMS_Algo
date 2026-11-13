import { History, Pause, Radar } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SIDE_LABELS } from '@/config/strategies'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { HuntSweepPlan, OrderDetailData, ParentOrder } from '@/types'
import { deriveHuntSweepView, findSweepPlan, HUNT_STEP_LABELS, type HuntStepState } from '@/utils/huntSweep'
import { OrderBookCard } from './OrderBookCard'

/** Khoảng cách giữa hai bước khi xem lại. */
export const REPLAY_STEP_MS = 700

const STATE_STYLES: Record<HuntStepState, string> = {
  FILLED: 'bg-price-up/15 text-price-up',
  WORKING: 'bg-price-ref/15 text-price-ref',
  UNUSED: 'bg-muted text-muted-foreground',
  OUT_OF_LIMIT: 'bg-price-down/15 text-price-down',
  CANCELLED: 'bg-muted text-muted-foreground',
}

interface HuntSweepPanelProps {
  order: ParentOrder
  detail: OrderDetailData
  /** Bản gọn (hộp thông báo sau khi đặt lệnh): không kèm sổ lệnh, không có nút xem lại. */
  compact?: boolean
}

function paramOf(detail: OrderDetailData, code: string) {
  return detail.parameters.find((parameter) => parameter.parameter_code === code)?.parameter_value
}

/** Phát lại các bước quét theo thời gian: trả về bước đang phát (null khi không phát) và nút điều khiển. */
function useReplay(stepCount: number) {
  const [index, setIndex] = useState<number | null>(null)
  useEffect(() => {
    if (index === null) return
    const timer = setTimeout(() => setIndex(index + 1 < stepCount ? index + 1 : null), REPLAY_STEP_MS)
    return () => clearTimeout(timer)
  }, [index, stepCount])
  return {
    index,
    playing: index !== null,
    toggle: () => setIndex((current) => (current === null ? 0 : null)),
  }
}

function SweepSummary({ plan, avgPrice, filledQty }: { plan: HuntSweepPlan; avgPrice: number | null; filledQty: number }) {
  const limitLabel = plan.side === 'BUY' ? 'Giá tối đa' : 'Giá tối thiểu'
  return (
    <dl className="bg-muted/40 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md p-2 text-xs sm:grid-cols-4">
      <div>
        <dt className="text-muted-foreground">Cần {SIDE_LABELS[plan.side].toLowerCase()}</dt>
        <dd className="font-medium tabular-nums">{formatNumber(plan.qty)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{limitLabel}</dt>
        <dd className="font-medium tabular-nums">{plan.limit_price === null ? 'Không giới hạn' : formatNumber(plan.limit_price)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Đã khớp khi quét</dt>
        <dd className="font-medium tabular-nums">{formatNumber(filledQty)}</dd>
      </div>
      <div data-demo-id="hunt-avg">
        <dt className="text-muted-foreground">{avgPrice === null ? 'Giá BQ dự kiến' : 'Giá bình quân'}</dt>
        <dd className="font-semibold tabular-nums">
          {avgPrice !== null ? formatNumber(avgPrice) : plan.avg_price !== null ? formatNumber(plan.avg_price) : '—'}
        </dd>
      </div>
    </dl>
  )
}

/**
 * Khung "HUNT quét từng mức": từng mức đã quét (lấy bao nhiêu, còn thiếu bao nhiêu), trạng thái từng bước,
 * giá bình quân và phần còn lại. Mức đang bị quét được viền nhấn trên sổ lệnh bên cạnh; "Xem lại" phát lại các bước.
 */
export function HuntSweepPanel({ order, detail, compact = false }: HuntSweepPanelProps) {
  const plan = findSweepPlan(detail.events)
  const replay = useReplay(plan?.steps.length ?? 0)

  let content
  let highlightPrice: number | null = null
  if (!plan) {
    const huntPrice = paramOf(detail, 'hunt_price')
    const sweeps = Number(paramOf(detail, 'max_levels') ?? 0) > 0
    content = (
      <EmptyState
        icon={Radar}
        title={huntPrice ? `Chưa đến giá săn ${formatNumber(Number(huntPrice))}` : 'Chưa đến giá săn'}
        description={
          sweeps
            ? 'Khi giá khớp về mức săn, HUNT quét lần lượt từng mức của sổ lệnh và hiện từng bước ở đây.'
            : 'Lệnh không đặt "Số mức quét tối đa": khi tới giá săn sẽ vào một lệnh tại giá giới hạn, không quét nhiều mức.'
        }
      />
    )
  } else {
    const view = deriveHuntSweepView(plan, detail.children, detail.executions)
    highlightPrice = replay.index !== null ? plan.steps[replay.index].price : view.activePrice
    content = (
      <div className="flex flex-col gap-3">
        <SweepSummary plan={plan} avgPrice={view.avgPrice} filledQty={view.filledQty} />
        <ol className="flex flex-col gap-1.5" aria-label="Các bước quét">
          {view.steps.map((item) => {
            const reached = replay.index === null || item.index <= replay.index
            const current = replay.index === item.index || (replay.index === null && item.step.price === view.activePrice)
            return (
              <li
                key={item.step.price}
                data-demo-id={`hunt-step-${item.index + 1}`}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-sm transition-opacity',
                  current && 'border-primary bg-primary/5',
                  !reached && 'opacity-30',
                )}
                aria-current={current ? 'step' : undefined}
              >
                <span className="tabular-nums">
                  <span className="text-muted-foreground mr-1.5 text-xs">{item.index + 1}.</span>
                  {item.text}
                </span>
                <Badge className={cn('shrink-0', STATE_STYLES[item.state])}>{HUNT_STEP_LABELS[item.state]}</Badge>
              </li>
            )
          })}
          {view.remainder && (
            <li
              data-demo-id="hunt-remainder"
              className={cn(
                'text-muted-foreground flex items-center justify-between gap-3 rounded-md border border-dashed px-2.5 py-1.5 text-sm',
                replay.playing && 'opacity-30',
              )}
            >
              <span className="tabular-nums">{view.remainder.text}</span>
              <Badge className="bg-muted text-muted-foreground shrink-0">
                {view.remainder.policy === 'WAIT' ? 'Chờ' : 'Hủy'}
              </Badge>
            </li>
          )}
        </ol>
        {!compact && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={replay.toggle} data-demo-id="hunt-replay">
              {replay.playing ? <Pause aria-hidden /> : <History aria-hidden />}
              {replay.playing ? 'Dừng xem lại' : 'Xem lại'}
            </Button>
            {replay.playing && (
              <span className="text-muted-foreground text-xs" role="status">
                Đang phát lại bước {(replay.index ?? 0) + 1}/{plan.steps.length}, sổ lệnh là ảnh chụp lúc quét.
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const panel = (
    <Card data-demo-id="hunt-sweep" className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>HUNT quét từng mức</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )

  if (compact) return panel
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {panel}
      <OrderBookCard
        symbol={order.symbol}
        highlightPrice={highlightPrice}
        depth={replay.playing && plan?.book ? plan.book : undefined}
        note={replay.playing ? 'Ảnh chụp sổ lệnh lúc HUNT quét' : undefined}
      />
    </div>
  )
}
