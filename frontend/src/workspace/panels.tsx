/* eslint-disable react-refresh/only-export-components -- registry: bảng tra loại panel → component, không phải module component */
import type { IDockviewPanelProps } from 'dockview-react'
import type { FunctionComponent } from 'react'
import { PanelFrame } from '@/pages/Workspace/PanelFrame'
import { PANEL_KIND_ORDER, PANEL_KINDS, type PanelKind, type PanelParams } from './panelTypes'

/** Nội dung từng loại panel (Đợt 10A, bước khung: tạm là mô tả; bước sau gắn component có sẵn). */
function PanelBody({ kind }: { kind: PanelKind }) {
  return <p className="text-muted-foreground text-sm">{PANEL_KINDS[kind].description}</p>
}

function makePanel(kind: PanelKind): FunctionComponent<IDockviewPanelProps<PanelParams>> {
  function WorkspacePanel({ api }: IDockviewPanelProps<PanelParams>) {
    return (
      <PanelFrame kind={kind} panelId={api.id}>
        <PanelBody kind={kind} />
      </PanelFrame>
    )
  }
  WorkspacePanel.displayName = `WorkspacePanel(${kind})`
  return WorkspacePanel
}

/** Bảng `components` cho DockviewReact: khóa là loại panel (lưu trong bố cục JSON). */
export const PANEL_COMPONENTS: Record<PanelKind, FunctionComponent<IDockviewPanelProps<PanelParams>>> = Object.fromEntries(
  PANEL_KIND_ORDER.map((kind) => [kind, makePanel(kind)]),
) as Record<PanelKind, FunctionComponent<IDockviewPanelProps<PanelParams>>>
