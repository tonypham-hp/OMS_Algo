import { describe, expect, it } from 'vitest'
import { THEME_NAMES } from '@/config/theme'
import { checkTheme, contrastRatio } from './contrast'

// Mọi cặp token chữ/nền phải đạt 4,5:1 (sáng, tối) và 7:1 (tương phản cao); viền ô nhập 3:1.
// Ai sửa một màu làm tụt ngưỡng thì test này fail, kèm tên cặp và tỷ lệ.

describe('hàm tương phản WCAG 2.x', () => {
  it('đen/trắng 21:1, cùng màu 1:1, ví dụ đã biết', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2)
  })
})

for (const palette of ['default', 'cvd'] as const) {
  for (const theme of THEME_NAMES) {
    describe(`tương phản ${theme}${palette === 'cvd' ? ' · mù màu' : ''}`, () => {
      const results = checkTheme(theme, palette)
      it.each(results.map((result) => [`${result.fg} trên ${result.bg}`, result] as const))('%s', (_name, result) => {
        expect(result.ratio, `${result.ratio.toFixed(2)}:1 < ${result.threshold}:1`).toBeGreaterThanOrEqual(result.threshold)
      })
    })
  }
}

// tokens.css khớp theme.ts: kiểm trong scripts/check-colors.mjs (npm run lint), vì Vitest không nạp nội dung file CSS.
