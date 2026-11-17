import { describe, expect, it } from 'vitest'
import { THEME } from './theme'

/** Độ sáng tương đối theo WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r, g, b] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

/** Màu chữ có độ mờ (vd text-muted-foreground/80) trộn lên nền. */
function blend(foreground: string, background: string, alpha: number): string {
  const channel = (hex: string, start: number) => parseInt(hex.slice(start, start + 2), 16)
  const mix = (start: number) =>
    Math.round(channel(foreground, start) * alpha + channel(background, start) * (1 - alpha))
      .toString(16)
      .padStart(2, '0')
  return `#${mix(1)}${mix(3)}${mix(5)}`
}

/** Các nền có chữ đặt lên: trang, thanh bên, thẻ, mục đang chọn / hàng hover. */
const BACKGROUNDS = {
  background: THEME.background,
  sidebar: THEME.sidebar,
  card: THEME.card,
  navActive: THEME.navActive,
} as const

const MIN_TEXT_CONTRAST = 4.5

describe('Tương phản chữ tối thiểu 4.5:1 (WCAG AA)', () => {
  for (const [name, background] of Object.entries(BACKGROUNDS)) {
    it(`chữ chính trên nền ${name}`, () => {
      expect(contrast(THEME.text, background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    })

    it(`chữ phụ ${THEME.textMuted} trên nền ${name}`, () => {
      expect(contrast(THEME.textMuted, background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    })

    it(`chữ phụ mờ 80% (độ mờ thấp nhất được dùng cho chữ) trên nền ${name}`, () => {
      expect(contrast(blend(THEME.textMuted, background, 0.8), background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    })

    it(`màu tăng, giảm, tham chiếu, trần, sàn trên nền ${name}`, () => {
      for (const color of [THEME.up, THEME.down, THEME.ref, THEME.ceiling, THEME.floor, THEME.accent]) {
        expect(contrast(color, background), color).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      }
    })
  }

  it('chữ trên nút chính (onAccent trên accent)', () => {
    expect(contrast(THEME.onAccent, THEME.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
  })

  it('chữ phụ mờ 60% không đạt: không dùng cho chữ', () => {
    expect(contrast(blend(THEME.textMuted, THEME.card, 0.6), THEME.card)).toBeLessThan(MIN_TEXT_CONTRAST)
  })
})
