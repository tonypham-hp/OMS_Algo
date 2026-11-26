// Điều hướng bàn phím theo mẫu Grid của WAI-ARIA (Đợt 10A). Hàm thuần: vị trí hiện tại + phím → vị trí mới.

export interface GridPosition {
  row: number
  col: number
}

export interface GridSize {
  rows: number
  /** Số ô của từng hàng (hàng có thể khác nhau, ví dụ hàng "trống" gộp cột). */
  colsInRow: (row: number) => number
}

/** Số hàng nhảy khi bấm PageUp / PageDown. */
export const GRID_PAGE_SIZE = 10

export const GRID_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'])

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/**
 * Vị trí mới sau một phím (null: phím không thuộc điều hướng lưới, hoặc lưới rỗng).
 * - ↑ ↓ ← →: sang ô kề bên, dừng ở mép (không vòng lại).
 * - Home / End: đầu / cuối hàng; Ctrl+Home / Ctrl+End: ô đầu / ô cuối của cả lưới.
 * - PageUp / PageDown: lên / xuống GRID_PAGE_SIZE hàng.
 * Sang hàng ngắn hơn thì cột bị kéo về ô cuối của hàng đó.
 */
export function moveInGrid(position: GridPosition, key: string, size: GridSize, ctrl = false): GridPosition | null {
  if (size.rows === 0 || !GRID_KEYS.has(key)) return null
  const lastRow = size.rows - 1
  const fit = (row: number, col: number): GridPosition => {
    const r = clamp(row, 0, lastRow)
    return { row: r, col: clamp(col, 0, Math.max(0, size.colsInRow(r) - 1)) }
  }
  const { row, col } = position
  switch (key) {
    case 'ArrowUp':
      return fit(row - 1, col)
    case 'ArrowDown':
      return fit(row + 1, col)
    case 'ArrowLeft':
      return fit(row, col - 1)
    case 'ArrowRight':
      return fit(row, col + 1)
    case 'Home':
      return ctrl ? fit(0, 0) : fit(row, 0)
    case 'End':
      return ctrl ? fit(lastRow, size.colsInRow(lastRow) - 1) : fit(row, size.colsInRow(row) - 1)
    case 'PageUp':
      return fit(row - GRID_PAGE_SIZE, col)
    case 'PageDown':
      return fit(row + GRID_PAGE_SIZE, col)
    default:
      return null
  }
}
