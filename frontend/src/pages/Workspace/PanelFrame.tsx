import type { ReactNode } from 'react'
import { PANEL_KINDS, type PanelKind } from '@/workspace/panelTypes'

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
      {children}
    </section>
  )
}
