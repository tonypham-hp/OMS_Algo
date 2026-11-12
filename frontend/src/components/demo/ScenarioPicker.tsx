import { useLocation } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { demoController } from '@/demo/controller'
import { SCENARIOS } from '@/demo/scenarios'
import { useDemoStore } from '@/store/demo.store'

/** Hộp chọn 6 kịch bản: tên, tóm tắt, mã TC liên quan, số bước. */
export function ScenarioPicker() {
  const open = useDemoStore((state) => state.pickerOpen)
  const setOpen = useDemoStore((state) => state.setPickerOpen)
  const { pathname } = useLocation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chọn kịch bản Demo</DialogTitle>
          <DialogDescription>
            App tự chạy từng bước trên dữ liệu riêng, có chú thích và điều kiện kiểm tra. Thoát Demo thì dữ liệu của bạn
            trở về nguyên như cũ.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {SCENARIOS.map((scenario) => (
            <li key={scenario.id}>
              <button
                type="button"
                onClick={() => demoController.start(scenario.id, pathname)}
                className="hover:border-primary hover:bg-nav-active/60 flex w-full flex-col gap-1 rounded-lg border p-3 text-left"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    Scenario {scenario.number} · {scenario.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">{scenario.steps.length} bước</span>
                </span>
                <span className="text-muted-foreground text-sm">{scenario.summary}</span>
                <span className="text-muted-foreground/80 font-mono text-xs">{scenario.tcRefs.join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
