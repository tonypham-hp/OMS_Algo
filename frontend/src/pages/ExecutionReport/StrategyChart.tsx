import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/states'
import { FONTS, THEME } from '@/config/theme'
import { describeStrategyBps, formatFavorableBps, type StrategyBps } from '@/utils/execQuality'

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12, fontFamily: FONTS.mono }
/** Chiều cao mỗi cột và phần dành cho trục. */
const ROW_HEIGHT = 44
const AXIS_HEIGHT = 40

/** Trục đối xứng quanh 0, làm tròn lên bội 10 để vạch chia gọn. */
function getDomain(stats: StrategyBps[]): [number, number] {
  const max = Math.max(10, ...stats.map((item) => Math.abs(item.bps)))
  const bound = Math.ceil(max / 10) * 10
  return [-bound, bound]
}

/** bps có lợi trung bình theo chiến lược: trục 0 ở giữa, phải là có lợi, trái là bất lợi. */
export function StrategyChart({ stats }: { stats: StrategyBps[] }) {
  if (stats.length === 0) {
    return <EmptyState title="Chưa có lệnh khớp kèm giá arrival để so sánh." />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span className="text-price-down">← Bất lợi</span>
        <span className="text-price-up">Có lợi →</span>
      </div>
      <div className="w-full" style={{ height: stats.length * ROW_HEIGHT + AXIS_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              domain={getDomain(stats)}
              tickFormatter={(value: number) => `${value > 0 ? '+' : ''}${value}`}
              tick={AXIS_TICK}
              stroke="var(--border)"
            />
            <YAxis type="category" dataKey="label" width={72} tick={AXIS_TICK} stroke="var(--border)" />
            <ReferenceLine x={0} stroke={THEME.textMuted} />
            <Tooltip
              cursor={{ fill: 'var(--nav-active)' }}
              formatter={(value, _name, item) => [
                `${formatFavorableBps(Number(value))} (${(item.payload as StrategyBps).orders} lệnh)`,
                'So arrival',
              ]}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--foreground)' }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Bar dataKey="bps" name="bps" barSize={20} isAnimationActive={false}>
              {stats.map((item) => (
                <Cell key={item.strategy_type} fill={item.bps >= 0 ? THEME.up : THEME.down} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm">{describeStrategyBps(stats)}</p>
      <p className="text-muted-foreground text-xs">
        bps có lợi so với arrival, bình quân gia quyền theo KL khớp của các lệnh đang hiển thị trong bảng.
      </p>
    </div>
  )
}
