import type { DockviewPanelApi } from 'dockview-react'
import { useEffect, useState, type RefObject } from 'react'

/** Panel đang ở cửa sổ tách (dockview popout) hay không; cập nhật khi tách ra / đưa về. */
export function useInPopout(api: Pick<DockviewPanelApi, 'location' | 'onDidLocationChange'>): boolean {
  const [inPopout, setInPopout] = useState(api.location.type === 'popout')
  useEffect(() => {
    const subscription = api.onDidLocationChange((event) => setInPopout(event.location.type === 'popout'))
    return () => subscription.dispose()
  }, [api])
  return inPopout
}

/** Đóng cửa sổ tách chứa panel: dockview tự đưa panel về vị trí cũ trong bàn làm việc. */
export function closePopoutOf(api: Pick<DockviewPanelApi, 'location'>) {
  if (api.location.type === 'popout') api.location.getWindow().close()
}

/**
 * document đang chứa phần tử (cửa sổ chính, cửa sổ tách hay cửa sổ phiếu mini). dockview chuyển DOM của panel sang
 * cửa sổ khác mà React không vẽ lại, nên đọc lại `ownerDocument` mỗi khi panel đổi vị trí.
 * Overlay (Dialog, menu, ô chọn, tooltip) dùng `body` của document này làm nơi gắn portal.
 */
export function useOwnerDocument(ref: RefObject<HTMLElement | null>, api?: Pick<DockviewPanelApi, 'onDidLocationChange'>): Document | null {
  const [owner, setOwner] = useState<Document | null>(null)
  useEffect(() => {
    const read = () => setOwner(ref.current?.ownerDocument ?? null)
    read()
    if (!api) return
    // Sự kiện đổi vị trí tới sau khi DOM đã chuyển xong; đọc lại ở khung hình kế tiếp cho chắc.
    const subscription = api.onDidLocationChange(() => {
      read()
      requestAnimationFrame(read)
    })
    return () => subscription.dispose()
  }, [ref, api])
  return owner
}
