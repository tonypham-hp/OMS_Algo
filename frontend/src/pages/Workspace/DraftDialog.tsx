import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DraftDialogProps {
  /** Mã của phiếu đang có bản nháp. */
  from: string
  /** Mã mới của nhóm liên kết. null: đóng hộp. */
  to: string | null
  onKeep: () => void
  onSwitch: () => void
}

/**
 * Nhóm liên kết vừa đổi mã trong khi Phiếu lệnh đang nhập dở: hỏi trước, không xóa trắng bản nháp.
 * Đóng hộp (Esc, bấm ra ngoài) = giữ bản nháp.
 */
export function DraftDialog({ from, to, onKeep, onSwitch }: DraftDialogProps) {
  return (
    <Dialog open={to !== null} onOpenChange={(open) => !open && onKeep()}>
      <DialogContent data-testid="draft-dialog">
        <DialogHeader>
          <DialogTitle>Phiếu lệnh đang có bản nháp</DialogTitle>
          <DialogDescription>
            Nhóm liên kết vừa chuyển sang mã <span className="text-foreground font-semibold">{to}</span>, nhưng phiếu lệnh của mã{' '}
            <span className="text-foreground font-semibold">{from}</span> còn dữ liệu chưa gửi.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeep} autoFocus>
            Giữ bản nháp cho {from}
          </Button>
          <Button onClick={onSwitch}>Chuyển sang {to} (bỏ bản nháp)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
