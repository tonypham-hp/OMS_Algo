import { useRef, type ReactNode } from 'react'
import { useGridKeyboard } from '@/hooks/useGridKeyboard'
import { PANEL_KINDS, type PanelKind } from '@/workspace/panelTypes'

/** Panel dạng danh sách: bảng/danh sách bên trong đi bằng mũi tên theo mẫu Grid (một điểm dừng Tab mỗi bảng). */
const GRID_PANELS: ReadonlySet<PanelKind> = new Set(['watchlist', 'blotter', 'algos', 'depth', 'notifications'])

/** Panel dạng bảng có điều hướng lưới; panel khác (phiếu lệnh, chi tiết) giữ cách dùng bàn phím sẵn có. */
function GridArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useGridKeyboard(ref)
  return <div ref={ref}>{children}</div>
}

/**
 * Khung chung của mọi panel: vùng có tên (aria-label) để trình đọc màn hình và Alt+1..9 tìm tới,
 * cuộn riêng trong panel, data-demo-id riêng theo loại panel (không trùng id của component bên trong).
 */
export function PanelFrame({ kind, panelId, children }: { kind: PanelKind; panelId: string; children: ReactNode }) {
  return (
    <section
      aria-label={PANEL_KINDS[kind].title}
      data-ws-panel={panelId}
      data-ws-kind={kind}
      data-demo-id={PANEL_KINDS[kind].demoId}
      tabIndex={-1}
      className="bg-surface text-text h-full overflow-auto p-2"
    >
      {GRID_PANELS.has(kind) ? <GridArea>{children}</GridArea> : children}
    </section>
  )
}
