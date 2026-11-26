import { useEffect, type RefObject } from 'react'
import { isEditableTarget } from '@/utils/hotkey'
import { GRID_KEYS, moveInGrid } from './gridNavigation'

const INTERACTIVE = 'button:not([disabled]), a[href], [role="button"], input:not([type="hidden"]), [role="checkbox"]'
/** Lưới trong vùng: bảng (thead + tbody) hoặc danh sách đánh dấu data-grid-list. */
const GRID_SELECTOR = 'table, [data-grid-list]'

function rowsOf(grid: HTMLElement): HTMLElement[] {
  if (grid.tagName === 'TABLE') return Array.from(grid.querySelectorAll<HTMLElement>(':scope > thead > tr, :scope > tbody > tr'))
  return Array.from(grid.querySelectorAll<HTMLElement>(':scope > li'))
}

function cellsOf(row: HTMLElement): HTMLElement[] {
  if (row.tagName === 'TR') return Array.from(row.querySelectorAll<HTMLElement>(':scope > th, :scope > td'))
  return [row]
}

/** Phần tử nhận focus của một ô: điều khiển duy nhất trong ô (nút, liên kết), không thì chính ô. */
function focusTargetOf(cell: HTMLElement): HTMLElement {
  const controls = cell.querySelectorAll<HTMLElement>(INTERACTIVE)
  return controls.length === 1 ? controls[0] : cell
}

/**
 * Bảng trong panel thành một điểm dừng Tab (roving tabindex), đi trong bảng bằng mũi tên, Home/End,
 * Ctrl+Home/End, PageUp/PageDown; Enter / Space kích hoạt nút của ô (hoặc hàng). Theo mẫu Grid của WAI-ARIA.
 * Bảng cập nhật liên tục (giá, tiến độ) nên tabindex được đặt lại khi nội dung đổi.
 */
export function useGridKeyboard(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    /** Phần tử đang giữ tabindex=0 của từng lưới (giữ qua các lần bảng vẽ lại). */
    const current = new WeakMap<HTMLElement, HTMLElement>()

    const apply = () => {
      for (const grid of container.querySelectorAll<HTMLElement>(GRID_SELECTOR)) {
        // role=grid cho bảng thường; bảng có hàng là nút (sổ lệnh 3 mức: bấm mức giá) giữ vai trò sẵn có, chỉ thêm phím mũi tên.
        const rowsAreButtons = grid.querySelector(':scope > tbody > tr[role]') !== null
        if (grid.tagName === 'TABLE' && !rowsAreButtons && grid.getAttribute('role') !== 'grid') grid.setAttribute('role', 'grid')
        const targets = rowsOf(grid).flatMap((row) => cellsOf(row).map(focusTargetOf))
        if (targets.length === 0) continue
        const keep = current.get(grid)
        const active = keep && targets.includes(keep) ? keep : targets[0]
        current.set(grid, active)
        for (const target of targets) target.tabIndex = target === active ? 0 : -1
        // Mọi điều khiển khác trong lưới (ô có nhiều nút): chỉ tới được bằng mũi tên trong ô, không bằng Tab.
        for (const control of grid.querySelectorAll<HTMLElement>(INTERACTIVE)) if (!targets.includes(control)) control.tabIndex = -1
      }
    }

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(apply)
    }
    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(container, { childList: true, subtree: true })

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement
      const grid = target.closest<HTMLElement>(GRID_SELECTOR)
      if (!grid || !container.contains(grid)) return
      const previous = current.get(grid)
      if (previous && previous !== target) previous.tabIndex = -1
      if (target.tabIndex === -1) target.tabIndex = 0
      current.set(grid, target)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (isEditableTarget(target)) return
      const grid = target.closest<HTMLElement>(GRID_SELECTOR)
      if (!grid || !container.contains(grid)) return
      const rows = rowsOf(grid)
      const rowIndex = rows.findIndex((row) => row.contains(target))
      if (rowIndex < 0) return
      const cells = cellsOf(rows[rowIndex])
      const colIndex = Math.max(0, cells.findIndex((cell) => cell.contains(target)))

      if (event.key === 'Enter' || event.key === ' ') {
        // Đang ở ô (không phải nút): kích hoạt nút của ô, không có thì hàng (ví dụ chọn mã trên bảng giá).
        if (target.matches(INTERACTIVE)) return
        const control = cells[colIndex].querySelector<HTMLElement>(INTERACTIVE)
        event.preventDefault()
        ;(control ?? rows[rowIndex]).click()
        return
      }
      if (!GRID_KEYS.has(event.key)) return
      const next = moveInGrid({ row: rowIndex, col: colIndex }, event.key, { rows: rows.length, colsInRow: (row) => cellsOf(rows[row]).length }, event.ctrlKey || event.metaKey)
      if (!next) return
      event.preventDefault()
      const cell = cellsOf(rows[next.row])[next.col]
      const focusTarget = focusTargetOf(cell)
      focusTarget.tabIndex = 0
      focusTarget.focus()
      focusTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    container.addEventListener('focusin', onFocusIn)
    container.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      container.removeEventListener('focusin', onFocusIn)
      container.removeEventListener('keydown', onKeyDown)
    }
  }, [containerRef])
}
