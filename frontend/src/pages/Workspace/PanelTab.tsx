import { Ellipsis, ExternalLink, PictureInPicture2, X } from 'lucide-react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import type { PointerEvent } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PanelParams } from '@/workspace/panelTypes'

/** Nút trong tab không được bắt đầu kéo tab hay đổi panel đang hoạt động. */
const stop = (event: PointerEvent) => event.stopPropagation()

/**
 * Tab của panel: tiêu đề, menu "⋯" (thả nổi, tách cửa sổ – khóa đến Đợt 10B) và nút đóng.
 * Kéo tab để dock trái/phải/trên/dưới hoặc gộp vào nhóm tab khác (dockview lo phần kéo thả).
 */
export function PanelTab({ api, containerApi }: IDockviewPanelHeaderProps<PanelParams>) {
  const title = api.title ?? ''
  return (
    <div className="flex h-full items-center gap-1.5 pr-1 pl-3 text-[0.8125rem]" data-ws-tab={api.id}>
      <span className="truncate">{title}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onPointerDown={stop}
            aria-label={`Tùy chọn panel ${title}`}
            className="text-muted-foreground hover:text-foreground hover:bg-surface-hover focus-visible:outline-ring rounded p-0.5"
          >
            <Ellipsis className="size-3.5" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem
            onSelect={() => {
              const panel = containerApi.getPanel(api.id)
              if (panel) containerApi.addFloatingGroup(panel)
            }}
          >
            <PictureInPicture2 aria-hidden />
            Thả nổi
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <ExternalLink aria-hidden />
            Tách cửa sổ (Đợt 10B)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => api.close()}>
            <X aria-hidden />
            Đóng panel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button
        type="button"
        onPointerDown={stop}
        onClick={() => api.close()}
        aria-label={`Đóng panel ${title}`}
        title="Đóng"
        className="text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded p-0.5"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
