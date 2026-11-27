/* eslint-disable react-refresh/only-export-components -- gồm store nhỏ + hàm mở cửa sổ đi kèm component của nó */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { PortalContainerContext } from '@/components/ui/portalContainer'
import { LinkGroupBadge } from '@/pages/Workspace/PanelTab'
import type { LinkGroup, PanelParams } from '@/workspace/panelTypes'
import { PanelScope, TicketBody, type TicketHost } from '@/workspace/panels'
import { copyStyles, mirrorDocument } from '@/workspace/windowMirror'
import { useWindowsStore } from '@/workspace/windows'

// Phiếu lệnh mini nổi trên cùng (Đợt 10B) bằng Document Picture-in-Picture (Chrome/Edge 116+). Trình duyệt không có API
// thì KHÔNG hiện nút (không giả lập bằng cửa sổ thường). Phiếu mini là OrderTicket sẵn có trong cây React của cửa sổ chính
// (portal vào cửa sổ PiP): cùng kiểm tra luật (orderResolver / validateOrder), cùng bước Xác nhận, cùng giữ bản nháp.

interface DocumentPictureInPicture {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>
}

const pip = (): DocumentPictureInPicture | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture

export function supportsMiniTicket(): boolean {
  return pip() !== undefined
}

const MINI_ID = 'mini-ticket'
const MINI_SIZE = { width: 400, height: 640 }

interface MiniTicketState {
  window: Window | null
  /** Nhóm liên kết của phiếu mini (theo panel đã mở nó; "Không nhóm" thì Nhóm 1). */
  group: Exclude<LinkGroup, 'none'>
  set: (next: Partial<Pick<MiniTicketState, 'window' | 'group'>>) => void
}

export const useMiniTicketStore = create<MiniTicketState>()((set) => ({ window: null, group: '1', set: (next) => set(next) }))

/**
 * Mở phiếu mini nổi trên cùng. PHẢI gọi trực tiếp trong xử lý cú bấm (trình duyệt đòi thao tác người dùng).
 * Đã mở thì chỉ đổi nhóm và đưa cửa sổ lên trước.
 */
export function openMiniTicket(group: LinkGroup) {
  const api = pip()
  const target: Exclude<LinkGroup, 'none'> = group === 'none' ? '1' : group
  const current = useMiniTicketStore.getState().window
  if (current && !current.closed) {
    useMiniTicketStore.getState().set({ group: target })
    current.focus()
    return
  }
  if (!api) return
  void api.requestWindow(MINI_SIZE).then((miniWindow) => {
    miniWindow.document.title = 'ALGO OMS · Phiếu lệnh mini'
    copyStyles(document, miniWindow.document)
    miniWindow.document.body.style.margin = '0'
    useMiniTicketStore.getState().set({ window: miniWindow, group: target })
    useWindowsStore.getState().addWindow({ id: MINI_ID, kind: 'mini-ticket', window: miniWindow })
  })
}

/** Phiếu trong cửa sổ mini: TicketBody sẵn có với "chủ" riêng (khóa mã giữ trong state của phiếu mini). */
function MiniTicket({ group }: { group: Exclude<LinkGroup, 'none'> }) {
  const [params, setParams] = useState<PanelParams>({ group })
  const effective = useMemo<PanelParams>(() => ({ ...params, group }), [params, group])
  const host = useMemo<TicketHost>(
    () => ({ id: MINI_ID, isVisible: true, updateParameters: (next) => setParams(next as PanelParams) }),
    [],
  )
  return (
    <div className="bg-surface text-text flex min-h-full flex-col gap-2 p-3" data-testid="mini-ticket">
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <LinkGroupBadge group={group} /> Phiếu lệnh mini · nổi trên cùng · gửi lệnh vẫn qua bước Xác nhận
      </p>
      <PanelScope panelApi={host} params={effective}>
        <TicketBody panelApi={host} params={effective} mini />
      </PanelScope>
    </div>
  )
}

/**
 * Vẽ phiếu mini vào cửa sổ PiP khi đang mở; phản chiếu theme/style; đóng cửa sổ khi rời Bàn làm việc.
 * Đặt một lần trong trang Bàn làm việc.
 */
export function MiniTicketHost() {
  const miniWindow = useMiniTicketStore((state) => state.window)
  const group = useMiniTicketStore((state) => state.group)

  useEffect(() => {
    if (!miniWindow) return
    const stopMirror = mirrorDocument(document, miniWindow.document)
    const onClose = () => {
      stopMirror()
      useWindowsStore.getState().removeWindow(MINI_ID)
      useMiniTicketStore.getState().set({ window: null })
    }
    miniWindow.addEventListener('pagehide', onClose)
    return () => {
      miniWindow.removeEventListener('pagehide', onClose)
      stopMirror()
    }
  }, [miniWindow])

  // Rời Bàn làm việc: đóng phiếu mini.
  useEffect(
    () => () => {
      const current = useMiniTicketStore.getState().window
      if (current && !current.closed) current.close()
    },
    [],
  )

  if (!miniWindow || miniWindow.closed) return null
  return createPortal(
    <PortalContainerContext.Provider value={miniWindow.document.body}>
      <MiniTicket group={group} />
    </PortalContainerContext.Provider>,
    miniWindow.document.body,
  )
}
