import { Button } from '@/components/ui/button'
import { SESSION_LABELS } from '@/config/hose'
import { formatClock } from '@/lib/format'
import { marketService } from '@/services/market.service'
import { useMarketStore } from '@/store/market.store'
import type { SimSpeed } from '@/types'

const SPEEDS: SimSpeed[] = [1, 10, 60]

/** Đồng hồ phiên giả lập và các nút tua nhanh. */
export function SessionClock() {
  const seconds = useMarketStore((state) => state.sim_seconds)
  const session = useMarketStore((state) => state.session)
  const speed = useMarketStore((state) => state.speed)

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium whitespace-nowrap">{SESSION_LABELS[session]}</span>
      <span className="font-mono tabular-nums">{formatClock(seconds)}</span>
      <div className="flex gap-1" role="group" aria-label="Tốc độ giả lập">
        {SPEEDS.map((item) => (
          <Button
            key={item}
            size="xs"
            variant={item === speed ? 'default' : 'outline'}
            aria-pressed={item === speed}
            onClick={() => marketService.setSpeed(item)}
          >
            x{item}
          </Button>
        ))}
      </div>
      <Button size="xs" variant="ghost" onClick={() => marketService.resetDay()}>
        Về đầu ngày
      </Button>
    </div>
  )
}
