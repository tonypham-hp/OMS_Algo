import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max: number
  label: string
}

/** Thanh tiến độ khớp, kèm phần trăm ở bên phải. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.floor((value * 100) / max)) : 0

  return (
    <div className="flex min-w-28 items-center gap-2">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
      >
        <div
          className={cn('h-full rounded-full transition-all', percent >= 100 ? 'bg-green-500' : 'bg-sky-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">{percent}%</span>
    </div>
  )
}
