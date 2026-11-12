import { GripHorizontal, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { LAYOUT } from '@/config/theme'
import { demoController } from '@/demo/controller'
import { placeController } from '@/demo/position'
import { DEMO_SPEEDS } from '@/demo/runner'
import { formatClock } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useDemoStore } from '@/store/demo.store'

/**
 * Khung điều khiển nổi ở giữa đáy màn hình: bước hiện tại, chú thích, phát / tạm dừng, bước tiếp, làm lại, tốc độ.
 * Kéo bằng thanh tiêu đề; thả gần góc thì bám góc.
 */
export function DemoController() {
  const snapshot = useDemoStore((state) => state.snapshot)
  const number = useDemoStore((state) => state.scenarioNumber)
  const title = useDemoStore((state) => state.scenarioTitle)
  const position = useDemoStore((state) => state.position)
  const setPosition = useDemoStore((state) => state.setPosition)
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  if (!snapshot) return null
  const runner = demoController.getRunner()
  const { executed, total, status, speed } = snapshot
  const caption =
    snapshot.currentStep?.caption ??
    (status === 'idle' ? 'Bấm Phát (hoặc phím Space) để bắt đầu.' : 'Đang chuẩn bị bước đầu tiên…')
  const percent = total > 0 ? Math.round((executed * 100) / total) : 0
  const playing = status === 'playing'

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = panel.current?.getBoundingClientRect()
    if (!rect) return
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = panel.current?.getBoundingClientRect()
    if (!drag.current || !rect) return
    setPosition({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const rect = panel.current?.getBoundingClientRect()
    if (!drag.current || !rect) return
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    setPosition(
      placeController(
        { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
        LAYOUT.topBarHeight,
      ),
    )
  }

  return (
    <section
      ref={panel}
      role="region"
      aria-label="Điều khiển Demo"
      data-demo-id="demo-controller"
      className="bg-card fixed z-40 w-[min(640px,calc(100vw-32px))] rounded-xl border-2 border-price-ref/60 shadow-2xl"
      style={position ? { left: position.x, top: position.y } : { left: '50%', bottom: 16, transform: 'translateX(-50%)' }}
    >
      <div
        className="flex cursor-grab touch-none items-center gap-2 border-b px-4 py-2 select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Kéo để di chuyển, thả gần góc để bám góc"
      >
        <GripHorizontal className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate text-sm font-semibold">
          Scenario {number} · {title}
        </span>
        <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
          Bước {executed} / {total} · {formatClock(snapshot.simNowSeconds)}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <div
          role="progressbar"
          aria-label="Tiến độ kịch bản"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="bg-muted h-1.5 overflow-hidden rounded-full"
        >
          <div className="bg-price-ref h-full rounded-full transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p aria-live="polite" className="min-h-12 text-base leading-snug">
          {caption}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => (playing ? runner?.pause() : runner?.play())}
            disabled={status === 'finished'}
            aria-keyshortcuts="Space"
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            {playing ? 'Tạm dừng' : 'Phát'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => runner?.next()} disabled={status === 'finished'} aria-keyshortcuts="ArrowRight">
            <SkipForward aria-hidden /> Bước tiếp
          </Button>
          <Button size="sm" variant="outline" onClick={() => runner?.reset()}>
            <RotateCcw aria-hidden /> Làm lại
          </Button>
          <div className="ml-auto flex gap-1" role="group" aria-label="Tốc độ Demo">
            {DEMO_SPEEDS.map((item) => (
              <Button
                key={item}
                size="xs"
                variant={item === speed ? 'default' : 'outline'}
                aria-pressed={item === speed}
                onClick={() => runner?.setSpeed(item)}
              >
                x{item}
              </Button>
            ))}
          </div>
        </div>
        <p className={cn('text-muted-foreground text-xs')}>Space: phát / tạm dừng · →: bước tiếp · Esc: thoát Demo</p>
      </div>
    </section>
  )
}
