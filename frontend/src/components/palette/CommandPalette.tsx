import { BookOpen, History, LayoutGrid, ListOrdered, Search, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { canUseDemo } from '@/demo/access'
import { useOrders } from '@/hooks/useOrders'
import { useOrderRules } from '@/hooks/useSystemConfig'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { useMarketStore } from '@/store/market.store'
import { useUiStore } from '@/store/ui.store'
import { pushRecent, readRecent, type RecentItem } from '@/utils/recentItems'
import { buildSearchIndex, search, type SearchGroup, type SearchItem, type SearchTarget } from '@/utils/search'
import { getVisibleTemplates } from '@/utils/strategyTemplates'

const GROUP_ICONS: Record<SearchGroup, LucideIcon> = {
  ORDER: ListOrdered,
  SYMBOL: TrendingUp,
  SCREEN: LayoutGrid,
  ACTION: Zap,
  TERM: BookOpen,
}

interface Section {
  key: string
  label: string
  items: Array<SearchItem | RecentItem>
}

/** Sau khi chuyển màn, đợi phần tử xuất hiện (màn tải lười) rồi cuộn tới. Bỏ cuộc sau khoảng 2 giây. */
function scrollWhenReady(demoId: string, attempts = 20) {
  const element = document.querySelector<HTMLElement>(`[data-demo-id="${CSS.escape(demoId)}"]`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  if (attempts > 0) window.setTimeout(() => scrollWhenReady(demoId, attempts - 1), 100)
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const orders = useOrders().data
  const enabled = useOrderRules().data?.enabledStrategies
  const quotes = useMarketStore((state) => state.quotes)
  const setSelectedSymbol = useUiStore((state) => state.setSelectedSymbol)
  const setPickerOpen = useDemoStore((state) => state.setPickerOpen)
  const demoActive = useDemoStore((state) => state.snapshot !== null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recent] = useState(() => readRecent())

  const index = useMemo(
    () =>
      user
        ? buildSearchIndex({
            user,
            orders: orders ?? [],
            symbols: quotes.map((quote) => quote.symbol),
            templates: getVisibleTemplates(user.role, enabled),
            canDemo: canUseDemo(user.role) && !demoActive,
          })
        : [],
    [user, orders, quotes, enabled, demoActive],
  )

  const sections: Section[] = useMemo(() => {
    if (query.trim() === '') {
      // Mục gần đây phải còn trong chỉ mục hiện tại: đổi vai trò thì không thấy mục của vai trò khác.
      const byId = new Map(index.map((item) => [item.id, item]))
      const items = recent.map((item) => byId.get(item.id)).filter((item): item is SearchItem => item !== undefined)
      return items.length > 0 ? [{ key: 'RECENT', label: 'Mở gần đây', items }] : []
    }
    return search(index, query).map((section) => ({ key: section.group, label: section.label, items: section.items }))
  }, [index, query, recent])

  const flat = sections.flatMap((section) => section.items)
  const activeIndex = flat.length === 0 ? -1 : Math.min(active, flat.length - 1)
  const optionId = (item: SearchItem | RecentItem) => `palette-${item.id.replace(/[^a-zA-Z0-9-]/g, '-')}`

  function open(item: SearchItem | RecentItem) {
    pushRecent(item)
    onClose()
    const target: SearchTarget = item.target
    if (target.kind === 'demo') {
      setPickerOpen(true)
      return
    }
    if (target.symbol) setSelectedSymbol(target.symbol)
    navigate(target.path)
    if (target.scrollTo) scrollWhenReady(target.scrollTo)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (flat.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = (activeIndex + step + flat.length) % flat.length
      setActive(next)
      document.getElementById(optionId(flat[next]))?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (activeIndex >= 0) open(flat[activeIndex])
    }
  }

  // Vị trí đầu của mỗi nhóm trong danh sách phẳng, để ↑ ↓ đi xuyên qua các nhóm.
  const offsets = sections.map((_, sectionIndex) => sections.slice(0, sectionIndex).reduce((sum, item) => sum + item.items.length, 0))
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Tìm lệnh, mã, màn hình, thuật ngữ… (gõ không dấu cũng được)"
          aria-label="Tìm nhanh"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(flat[activeIndex]) : undefined}
          className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
          data-demo-id="palette-input"
        />
      </div>
      <div id="palette-list" role="listbox" aria-label="Kết quả" className="max-h-[min(60vh,28rem)] overflow-y-auto p-2" data-demo-id="palette-results">
        {sections.length === 0 && (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            {query.trim() === '' ? 'Gõ để tìm. ↑ ↓ để chọn, Enter để mở, Esc để đóng.' : 'Không tìm thấy kết quả phù hợp.'}
          </p>
        )}
        {sections.map((section, sectionIndex) => (
          <div key={section.key} role="group" aria-label={section.label} className="mb-2">
            <p className="text-muted-foreground px-2 pt-1 pb-1 text-[11px] font-medium tracking-wider uppercase" aria-hidden>
              {section.label}
            </p>
            {section.items.map((item, itemIndex) => {
              const itemPosition = offsets[sectionIndex] + itemIndex
              const isActive = itemPosition === activeIndex
              const Icon = section.key === 'RECENT' ? History : GROUP_ICONS[item.group]
              return (
                <div
                  key={`${section.key}-${item.id}`}
                  id={optionId(item)}
                  role="option"
                  aria-selected={isActive}
                  onMouseMove={() => setActive(itemPosition)}
                  onClick={() => open(item)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5', isActive && 'bg-nav-active text-foreground')}
                >
                  <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{item.title}</span>
                    {item.subtitle && <span className="text-muted-foreground truncate text-xs">{item.subtitle}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground flex gap-3 border-t px-3 py-2 text-[11px]">
        <span>↑ ↓ chọn</span>
        <span>Enter mở</span>
        <span>Esc đóng</span>
      </p>
    </div>
  )
}

/** Hộp tìm nhanh giữa màn hình, nền mờ phía sau. Mở bằng Ctrl+K / Cmd+K hoặc nút trên thanh trên cùng. */
export function CommandPalette() {
  const open = useUiStore((state) => state.paletteOpen)
  const setOpen = useUiStore((state) => state.setPaletteOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        aria-describedby="palette-help"
      >
        <DialogTitle className="sr-only">Tìm nhanh</DialogTitle>
        <DialogDescription id="palette-help" className="sr-only">
          Gõ mã lệnh, mã chứng khoán, tên màn hình hoặc thuật ngữ. Dùng phím mũi tên để chọn, Enter để mở, Esc để đóng.
        </DialogDescription>
        {/* Mỗi lần mở dựng lại thân hộp: câu tìm rỗng và đọc lại danh sách mở gần đây. */}
        {open && <PaletteBody onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}
