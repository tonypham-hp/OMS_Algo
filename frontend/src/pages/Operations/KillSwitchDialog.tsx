import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActivateKillSwitch } from '@/hooks/useOperations'
import { formatNumber } from '@/lib/format'
import type { KillSwitchRequest } from '@/types'

const CONFIRM_WORD = 'DUNG'

interface KillSwitchDialogProps {
  request: KillSwitchRequest
  scopeLabel: string
  affectedCount: number
  onClose: () => void
}

/** Xác nhận 2 bước: bước 1 xem phạm vi ảnh hưởng, bước 2 phải gõ đúng từ xác nhận mới bấm được. */
export function KillSwitchDialog({ request, scopeLabel, affectedCount, onClose }: KillSwitchDialogProps) {
  const activate = useActivateKillSwitch()
  const [step, setStep] = useState<1 | 2>(1)
  const [word, setWord] = useState('')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kích hoạt kill switch ({step}/2)</DialogTitle>
          <DialogDescription>
            Phạm vi: {scopeLabel}. Có {formatNumber(affectedCount)} lệnh chưa kết thúc sẽ chuyển sang hệ thống tạm dừng.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <ul className="list-inside list-disc text-sm">
              <li>Hủy ngay mọi lệnh con chưa khớp, kể cả trong ATO, ATC. Child chưa rõ trạng thái giữ nguyên chờ đối soát.</li>
              <li>Không đặt được lệnh mới trong phạm vi này cho tới khi gỡ kill switch.</li>
              <li>Gỡ kill switch không làm lệnh tự chạy lại: vận hành phải mở lại từng lệnh và ghi lý do.</li>
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Quay lại
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Tiếp tục
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kill_switch_confirm">Gõ {CONFIRM_WORD} để xác nhận</Label>
              <Input
                id="kill_switch_confirm"
                autoComplete="off"
                value={word}
                onChange={(event) => setWord(event.target.value)}
              />
            </div>
            {activate.error && (
              <p role="alert" className="text-destructive text-sm">
                {activate.error.message}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={activate.isPending} onClick={onClose}>
                Quay lại
              </Button>
              <Button
                variant="destructive"
                disabled={word !== CONFIRM_WORD || activate.isPending}
                onClick={() => activate.mutate(request, { onSuccess: onClose })}
              >
                {activate.isPending ? 'Đang dừng...' : 'Xác nhận dừng'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
