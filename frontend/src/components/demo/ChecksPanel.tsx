import { ChevronRight, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LAYOUT } from '@/config/theme'
import type { CheckStatus, CheckView } from '@/demo/runner'
import { cn } from '@/lib/utils'
import { useDemoStore } from '@/store/demo.store'

const STATUS_STYLES: Record<CheckStatus, { label: string; className: string }> = {
  pass: { label: 'ĐẠT', className: 'bg-green-500/20 text-green-300' },
  fail: { label: 'KHÔNG ĐẠT', className: 'bg-red-500/20 text-red-300' },
  pending: { label: 'CHỜ', className: 'bg-muted text-muted-foreground' },
}

function CheckRow({ check }: { check: CheckView }) {
  const style = STATUS_STYLES[check.status]
  return (
    <li className="flex items-start gap-2 py-1.5 text-sm" data-check-status={check.status}>
      <span className={cn('mt-0.5 shrink-0 rounded px-1.5 py-px text-[10px] font-bold', style.className)}>{style.label}</span>
      <span className={cn('leading-snug', check.status === 'pending' && 'text-muted-foreground')}>{check.label}</span>
    </li>
  )
}

/** Bảng bên phải "Điều kiện kiểm tra": điều kiện của từng bước và quy tắc chung, cập nhật sau mỗi bước. */
export function ChecksPanel() {
  const snapshot = useDemoStore((state) => state.snapshot)
  const open = useDemoStore((state) => state.checksOpen)
  const setOpen = useDemoStore((state) => state.setChecksOpen)
  if (!snapshot) return null

  const passed = snapshot.checks.filter((check) => check.status === 'pass').length
  const stepChecks = snapshot.checks.filter((check) => check.stepIndex !== null)
  const generalChecks = snapshot.checks.filter((check) => check.stepIndex === null)

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed right-2 z-30"
        style={{ top: LAYOUT.topBarHeight + 8 }}
        onClick={() => setOpen(true)}
      >
        <ListChecks aria-hidden /> Điều kiện {passed}/{snapshot.checks.length}
      </Button>
    )
  }

  return (
    <aside
      aria-label="Điều kiện kiểm tra"
      className="bg-sidebar border-sidebar-border fixed right-0 bottom-0 z-30 flex flex-col border-l"
      style={{ top: LAYOUT.topBarHeight, width: LAYOUT.demoChecksWidth }}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <h2 className="font-semibold">Điều kiện kiểm tra</h2>
        <span className="text-muted-foreground text-xs tabular-nums">
          {passed}/{snapshot.checks.length} đạt
        </span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Thu gọn bảng điều kiện" onClick={() => setOpen(false)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <h3 className="text-muted-foreground pt-1 text-[11px] font-medium tracking-wider uppercase">Theo từng bước</h3>
        <ul>
          {stepChecks.map((check) => (
            <CheckRow key={check.key} check={check} />
          ))}
        </ul>
        <h3 className="text-muted-foreground pt-3 text-[11px] font-medium tracking-wider uppercase">Quy tắc lõi (mọi bước)</h3>
        <ul>
          {generalChecks.map((check) => (
            <CheckRow key={check.key} check={check} />
          ))}
        </ul>
      </div>
    </aside>
  )
}
