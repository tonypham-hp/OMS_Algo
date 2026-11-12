import { Button } from '@/components/ui/button'
import { SESSION_LABELS } from '@/config/hose'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { marketService } from '@/services/market.service'
import { useDemoStore } from '@/store/demo.store'
import { useMarketStore } from '@/store/market.store'
import type { SessionCode, SimSpeed } from '@/types'

const SPEEDS: SimSpeed[] = [1, 10, 60]

/** Màu chấm phiên: xanh lá khi khớp liên tục, vàng khi phiên định kỳ, xám khi không giao dịch. */
const SESSION_DOT: Record<SessionCode, string> = {
  PRE_OPEN: 'bg-slate-500',
  ATO: 'bg-price-ref',
  CONTINUOUS: 'bg-price-up',
  LUNCH: 'bg-slate-500',
  ATC: 'bg-price-ref',
  CLOSED: 'bg-price-down',
}

/** Phiên HOSE + giờ giả lập + nút tua nhanh. Logic giữ nguyên như đồng hồ cũ ở header. */
export function SessionStatus() {
  const seconds = useMarketStore((state) => state.sim_seconds)
  const session = useMarketStore((state) => state.session)
  const speed = useMarketStore((state) => state.speed)
  // Đang Demo: đồng hồ và giá do kịch bản điều khiển, nên ẩn nút tua và "Về đầu ngày" để không phá kịch bản.
  const demoActive = useDemoStore((state) => state.snapshot !== null)

  const clock = (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className={cn('size-2 rounded-full', SESSION_DOT[session])} aria-hidden />
      <span className="font-medium">{SESSION_LABELS[session]}</span>
      <span className="tabular-nums">{formatClock(seconds)}</span>
    </span>
  )
  if (demoActive) return <div className="flex items-center text-sm">{clock}</div>

  return (
    <div className="flex items-center gap-3 text-sm">
      {clock}
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
      {session === 'CLOSED' && (
        <Button size="xs" variant="outline" onClick={() => marketService.nextDay()}>
          Sang ngày mới
        </Button>
      )}
      <Button size="xs" variant="ghost" className="whitespace-nowrap" onClick={() => marketService.resetDay()}>
        Về đầu ngày
      </Button>
    </div>
  )
}
