import { describe, expect, it } from 'vitest'
import { GRID_PAGE_SIZE, moveInGrid, type GridSize } from './gridNavigation'

/** Bảng 25 hàng × 4 cột, hàng 3 chỉ có 1 ô (ví dụ dòng "trống" gộp cột). */
const size: GridSize = { rows: 25, colsInRow: (row) => (row === 3 ? 1 : 4) }

describe('điều hướng lưới (mẫu Grid WAI-ARIA)', () => {
  it('mũi tên sang ô kề bên, dừng ở mép, không vòng lại', () => {
    expect(moveInGrid({ row: 1, col: 1 }, 'ArrowDown', size)).toEqual({ row: 2, col: 1 })
    expect(moveInGrid({ row: 1, col: 1 }, 'ArrowRight', size)).toEqual({ row: 1, col: 2 })
    expect(moveInGrid({ row: 0, col: 0 }, 'ArrowUp', size)).toEqual({ row: 0, col: 0 })
    expect(moveInGrid({ row: 0, col: 0 }, 'ArrowLeft', size)).toEqual({ row: 0, col: 0 })
    expect(moveInGrid({ row: 24, col: 3 }, 'ArrowDown', size)).toEqual({ row: 24, col: 3 })
  })

  it('Home / End: đầu / cuối hàng; Ctrl+Home / Ctrl+End: đầu / cuối lưới', () => {
    expect(moveInGrid({ row: 5, col: 2 }, 'Home', size)).toEqual({ row: 5, col: 0 })
    expect(moveInGrid({ row: 5, col: 0 }, 'End', size)).toEqual({ row: 5, col: 3 })
    expect(moveInGrid({ row: 5, col: 2 }, 'Home', size, true)).toEqual({ row: 0, col: 0 })
    expect(moveInGrid({ row: 5, col: 2 }, 'End', size, true)).toEqual({ row: 24, col: 3 })
  })

  it('PageUp / PageDown nhảy nhiều hàng, dừng ở hàng đầu / cuối', () => {
    expect(moveInGrid({ row: 0, col: 1 }, 'PageDown', size)).toEqual({ row: GRID_PAGE_SIZE, col: 1 })
    expect(moveInGrid({ row: 20, col: 1 }, 'PageDown', size)).toEqual({ row: 24, col: 1 })
    expect(moveInGrid({ row: 4, col: 1 }, 'PageUp', size)).toEqual({ row: 0, col: 1 })
  })

  it('sang hàng ngắn hơn thì cột về ô cuối của hàng đó', () => {
    expect(moveInGrid({ row: 2, col: 3 }, 'ArrowDown', size)).toEqual({ row: 3, col: 0 })
  })

  it('phím khác hoặc lưới rỗng: không di chuyển', () => {
    expect(moveInGrid({ row: 0, col: 0 }, 'b', size)).toBeNull()
    expect(moveInGrid({ row: 0, col: 0 }, 'ArrowDown', { rows: 0, colsInRow: () => 0 })).toBeNull()
  })
})
