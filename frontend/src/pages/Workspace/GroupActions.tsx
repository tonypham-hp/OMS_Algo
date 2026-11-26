import { Plus } from 'lucide-react'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { addWorkspacePanel } from '@/workspace/presets'
import { PANEL_KIND_ORDER, PANEL_KINDS } from '@/workspace/panelTypes'

/** Nút "+ Thêm panel" bên phải thanh tab của mỗi nhóm: thêm panel mới vào nhóm đó (một loại mở được nhiều lần). */
export function GroupActions({ containerApi, group }: IDockviewHeaderActionsProps) {
  return (
    <div className="flex h-full items-center px-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Thêm panel vào nhóm này"
            title="Thêm panel"
            data-testid="ws-add-panel"
            className="text-muted-foreground hover:text-foreground hover:bg-surface-hover flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Thêm panel</DropdownMenuLabel>
          {PANEL_KIND_ORDER.map((kind) => (
            <DropdownMenuItem key={kind} onSelect={() => addWorkspacePanel(containerApi, kind, { referenceGroup: group })}>
              <span className="flex flex-col">
                <span>{PANEL_KINDS[kind].title}</span>
                <span className="text-muted-foreground text-xs">{PANEL_KINDS[kind].description}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
