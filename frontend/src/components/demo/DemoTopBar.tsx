import { Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { canUseDemo } from '@/demo/access'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'

/** Thoát Demo. Nạp controller khi cần: thanh trên không kéo phần chạy Demo vào gói chính. */
function exitDemo() {
  void import('@/demo/controller').then(({ demoController }) => demoController.exit())
}

/** Nút "▶ Demo" trên thanh trên cùng; khi đang chạy thì là nhãn vàng và nút "Thoát Demo". */
export function DemoTopBar() {
  const role = useAuthStore((state) => state.user?.role)
  const active = useDemoStore((state) => state.snapshot !== null)
  const scenarioNumber = useDemoStore((state) => state.scenarioNumber)
  const setPickerOpen = useDemoStore((state) => state.setPickerOpen)

  if (!canUseDemo(role)) return null

  if (active) {
    return (
      <span className="flex items-center gap-2">
        <span
          data-demo-id="demo-badge"
          className="bg-price-ref text-background rounded-md px-2 py-1 text-xs font-bold tracking-wide whitespace-nowrap"
        >
          ĐANG CHẠY DEMO · Scenario {scenarioNumber}
        </span>
        <Button size="sm" variant="outline" onClick={exitDemo}>
          <X aria-hidden /> Thoát Demo
        </Button>
      </span>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
      <Play aria-hidden /> Demo
    </Button>
  )
}
