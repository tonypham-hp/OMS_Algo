import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '@/config/chartColors'
import { formatNumber } from '@/lib/format'
import { useMarketStore } from '@/store/market.store'
import type { OrderDetailData, ParentOrder } from '@/types'
import { buildOrderProgress, formatTimeTick, getTimeTicks } from './orderProgress'

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12, style: { fontVariantNumeric: 'tabular-nums' } }

interface OrderProgressChartProps {
  order: ParentOrder
  detail: OrderDetailData
}

export function OrderProgressChart({ order, detail }: OrderProgressChartProps) {
  const tradingDate = useMarketStore((state) => state.trading_date)
  const simSeconds = useMarketStore((state) => state.sim_seconds)
  const progress = buildOrderProgress({ ...detail, order, tradingDate, simSeconds })
  const { rows, hasPlan, plannedQty, startingQty, hasFills } = progress

  if (!hasPlan && !hasFills) {
    return <p className="text-muted-foreground py-8 text-center text-sm">Chưa có khớp lệnh để vẽ biểu đồ.</p>
  }

  const min = rows[0].time
  const max = rows[rows.length - 1].time
  const span = max - min

  return (
    <div className="flex flex-col gap-2">
      <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
        <div className="flex gap-1">
          <dt>Thực tế:</dt>
          <dd className="text-foreground">{formatNumber(order.executed_qty)} CP</dd>
        </div>
        {hasPlan && (
          <div className="flex gap-1">
            <dt>Kế hoạch đến hiện tại:</dt>
            <dd className="text-foreground">
              {plannedQty === null ? 'Chưa tới khung giờ' : `${formatNumber(plannedQty)} CP`}
            </dd>
          </div>
        )}
        {startingQty > 0 && (
          <div className="flex gap-1">
            <dt>Đã khớp trước khung giờ này:</dt>
            <dd className="text-foreground">{formatNumber(startingQty)} CP</dd>
          </div>
        )}
      </dl>
      {/* Chiều cao đã gồm cả dải nhãn trục và chú giải. */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="time"
              type="number"
              domain={[min, max]}
              ticks={getTimeTicks(min, max)}
              tickFormatter={(time: number) => formatTimeTick(time, span)}
              tick={AXIS_TICK}
              stroke="var(--border)"
            />
            <YAxis
              domain={[0, order.total_qty]}
              tickFormatter={(qty: number) => formatNumber(qty)}
              tick={AXIS_TICK}
              stroke="var(--border)"
              width={64}
            />
            <Tooltip
              labelFormatter={(time) => formatTimeTick(Number(time), Math.max(span, 5 * 60_000))}
              formatter={(qty) => `${formatNumber(Number(qty))} CP`}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--foreground)' }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            {hasPlan && (
              <Legend
                formatter={(name) => <span className="text-foreground text-xs">{name}</span>}
                wrapperStyle={{ fontSize: 12 }}
              />
            )}
            {hasPlan && (
              <Line
                dataKey="plan"
                name="Kế hoạch"
                type="stepAfter"
                stroke={CHART_COLORS.plan}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="actual"
              name="Thực tế"
              type="stepAfter"
              stroke={CHART_COLORS.actual}
              strokeWidth={2}
              // Mới có một điểm thì không có đoạn thẳng nào để vẽ, phải hiện chấm mới thấy được.
              dot={rows.length === 1}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
