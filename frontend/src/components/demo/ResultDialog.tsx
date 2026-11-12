import { CircleCheck, CircleX, Download, ListRestart, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { demoController } from '@/demo/controller'
import { buildResultCsv, formatSimElapsed, getResultFilename } from '@/demo/resultCsv'
import { useDemoStore } from '@/store/demo.store'
import { downloadCsv } from '@/utils/csv'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

/** Hộp kết quả khi kịch bản chạy xong: số bước, điều kiện đạt / tổng, thời gian giả lập, điều kiện không đạt. */
export function ResultDialog() {
  const result = useDemoStore((state) => state.result)
  const snapshot = useDemoStore((state) => state.snapshot)
  const number = useDemoStore((state) => state.scenarioNumber)
  const close = () => useDemoStore.setState({ result: null })

  if (!result || !snapshot) return null
  const allPassed = result.failed.length === 0

  const rerun = () => {
    const runner = demoController.getRunner()
    close()
    runner?.reset()
    runner?.play()
  }
  const pickAnother = () => {
    close()
    useDemoStore.getState().setPickerOpen(true)
  }
  const exportCsv = () => {
    const general = snapshot.checks.filter((check) => check.stepIndex === null)
    downloadCsv(getResultFilename(number), buildResultCsv(result, general))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-xl" data-demo-id="demo-result">
        <DialogHeader>
          <DialogTitle>
            Kết quả · Scenario {number}: {result.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {allPassed ? (
              <>
                <CircleCheck className="text-price-up size-4" aria-hidden /> Mọi điều kiện kiểm tra đều ĐẠT.
              </>
            ) : (
              <>
                <CircleX className="text-price-down size-4" aria-hidden /> Có {result.failed.length} điều kiện KHÔNG ĐẠT.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-3 gap-3">
          <Stat label="Số bước" value={`${result.executed} / ${result.steps}`} />
          <Stat label="Điều kiện đạt" value={`${result.checksPassed} / ${result.checksTotal}`} />
          <Stat label="Thời gian giả lập" value={formatSimElapsed(result.simElapsedSeconds)} />
        </dl>
        {!allPassed && (
          <div>
            <h3 className="mb-1 text-sm font-medium">Điều kiện không đạt</h3>
            <ul className="text-price-down flex max-h-40 list-disc flex-col gap-1 overflow-y-auto pl-5 text-sm">
              {result.failed.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  {item.step === null ? 'Quy tắc chung' : `Bước ${item.step}`}: {item.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2 sm:justify-start">
          <Button onClick={rerun}>
            <RotateCcw aria-hidden /> Chạy lại
          </Button>
          <Button variant="outline" onClick={pickAnother}>
            <ListRestart aria-hidden /> Kịch bản khác
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download aria-hidden /> Xuất kết quả
          </Button>
          <Button variant="ghost" className="sm:ml-auto" onClick={() => demoController.exit()}>
            <X aria-hidden /> Thoát Demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
