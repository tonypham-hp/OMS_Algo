import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Trình duyệt chặn cửa sổ bật lên khi tách panel: panel đã được đưa về bàn làm việc; hướng dẫn cho phép popup.
 */
export function PopupBlockedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="popup-blocked">
        <DialogHeader>
          <DialogTitle>Trình duyệt đang chặn cửa sổ bật lên</DialogTitle>
          <DialogDescription>Panel chưa được tách và vẫn nằm ở bàn làm việc. Để tách panel ra cửa sổ riêng:</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Bấm biểu tượng chặn cửa sổ bật lên ở cuối thanh địa chỉ (bên phải).</li>
          <li>
            Chọn <span className="font-medium">"Luôn cho phép cửa sổ bật lên và chuyển hướng"</span> từ trang này, rồi bấm Xong.
          </li>
          <li>Mở lại menu "⋯" của panel và chọn "Tách ra cửa sổ riêng".</li>
        </ol>
        <p className="text-muted-foreground text-xs">
          Ứng dụng chỉ mở cửa sổ khi bạn bấm, không tự mở. Trên máy cơ quan, quyền này có thể do quản trị viên đặt.
        </p>
        <DialogFooter>
          <Button onClick={onClose}>Đã hiểu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
