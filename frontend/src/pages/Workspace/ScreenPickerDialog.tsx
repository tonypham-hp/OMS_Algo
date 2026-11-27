import { Monitor } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { pickDefaultScreen, screenLabel, type ScreenInfo } from '@/workspace/screens'

interface ScreenPickerDialogProps {
  /** null: đóng hộp. */
  screens: { screens: ScreenInfo[]; current: ScreenInfo } | null
  panelTitle: string
  onPick: (screen: ScreenInfo, index: number) => void
  onClose: () => void
}

/**
 * Chọn màn hình để đặt cửa sổ tách (Window Management API đã cho quyền). Cửa sổ mở khi bấm "Mở" – đó là thao tác của
 * người dùng nên trình duyệt không chặn.
 */
export function ScreenPickerDialog({ screens, panelTitle, onPick, onClose }: ScreenPickerDialogProps) {
  const fallback = screens ? screens.screens.indexOf(pickDefaultScreen(screens.screens, screens.current)) : 0
  const [chosen, setChosen] = useState<number | null>(null)
  const selected = chosen ?? Math.max(0, fallback)
  return (
    <Dialog open={screens !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="screen-picker">
        <DialogHeader>
          <DialogTitle>Mở "{panelTitle}" trên màn hình khác</DialogTitle>
          <DialogDescription>Chọn màn hình đặt cửa sổ. Lựa chọn được nhớ trong bố cục để lần sau mở lại đúng chỗ.</DialogDescription>
        </DialogHeader>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Màn hình</legend>
          {screens?.screens.map((screen, index) => (
            <label
              key={`${screen.availLeft}-${screen.availTop}-${index}`}
              className={cn('hover:bg-surface-hover flex cursor-pointer items-center gap-3 rounded-md border p-2 text-sm', selected === index && 'border-primary ring-primary ring-1')}
            >
              <input type="radio" name="screen" checked={selected === index} onChange={() => setChosen(index)} className="accent-primary size-4" />
              <Monitor className="text-muted-foreground size-4" aria-hidden />
              <span>{screenLabel(screen, index)}</span>
              {screens.current === screen && <span className="text-muted-foreground ml-auto text-xs">đang mở bàn làm việc</span>}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => screens && onPick(screens.screens[selected], selected)}>Mở</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
