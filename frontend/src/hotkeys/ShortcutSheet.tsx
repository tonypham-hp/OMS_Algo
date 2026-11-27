import { useHotkeys } from 'react-hotkeys-hook'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PortalContainerContext } from '@/components/ui/portalContainer'
import { useUiStore } from '@/store/ui.store'
import { SHORTCUT_GROUPS, SHORTCUTS } from './shortcuts'
import { useHotkeyOptions } from './useHotkeyOptions'

/** Một phím hiển thị (dùng ở bảng phím tắt, Ctrl+K, tooltip). */
export function Kbd({ children }: { children: string }) {
  return <kbd className="bg-surface-2 border-border text-foreground rounded border px-1.5 py-px font-mono text-[11px] whitespace-nowrap">{children}</kbd>
}

/**
 * Bảng phím tắt: mở bằng "?" hoặc "/" ở mọi màn (không mở khi đang gõ trong ô nhập), hoặc từ Ctrl+K.
 * Liệt kê theo nhóm; ghi rõ phím chỉ mở phiếu, không gửi lệnh.
 */
export function ShortcutSheet() {
  const open = useUiStore((state) => state.shortcutsOpen)
  const setOpen = useUiStore((state) => state.setShortcutsOpen)
  const container = useUiStore((state) => state.shortcutsContainer)
  const options = useHotkeyOptions('global')
  // "?" là Shift + "/" trên bàn phím Mỹ: khớp cả hai cho chắc chắn, và cả "/" đơn.
  useHotkeys('shift+slash, slash', () => setOpen(true), options)
  useHotkeys('?', () => setOpen(true), { ...options, useKey: true })

  return (
    <PortalContainerContext.Provider value={container}>
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="shortcut-sheet">
        <DialogHeader>
          <DialogTitle>Phím tắt</DialogTitle>
          <DialogDescription>
            Không phím nào gửi lệnh: B và S chỉ mở phiếu, gửi lệnh vẫn qua bước Xác nhận. Phím tắt không chạy khi đang gõ trong
            ô nhập, khi có hộp thoại mở hoặc khi đang chạy Demo; tắt được trong Cài đặt › Giao diện.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-label={group}>
              <h3 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
                {group}
                {group !== 'Chung' && <span className="font-normal normal-case"> · ở Bàn làm việc</span>}
              </h3>
              <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
                {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <div key={shortcut.id} className="contents">
                    <dt>
                      <Kbd>{shortcut.label}</Kbd>
                    </dt>
                    <dd>{shortcut.description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </PortalContainerContext.Provider>
  )
}
