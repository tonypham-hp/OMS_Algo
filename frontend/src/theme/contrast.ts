// Tương phản màu theo WCAG 2.x (hàm thuần, tự viết). Dùng cho test và tài liệu docs/theme.md.
import { paletteOf, type Palette, type ThemeName, type TokenName } from '../config/theme.ts'

/** Độ sáng tương đối (relative luminance) của màu hex #RRGGBB. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Tỷ lệ tương phản (1..21) giữa hai màu. */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

/** Ngưỡng chữ thường: 4,5:1 (AA); theme tương phản cao: 7:1 (AAA). Viền ô nhập: 3:1. */
export function textThreshold(theme: ThemeName): number {
  return theme === 'hc-dark' || theme === 'hc-light' ? 7 : 4.5
}
export const NON_TEXT_THRESHOLD = 3

export interface ContrastPair {
  fg: TokenName
  bg: TokenName
  /** 'text': chữ; 'ui': viền, đường kẻ của điều khiển. */
  kind: 'text' | 'ui'
}

const SURFACES: TokenName[] = ['bg', 'surface', 'surface-panel', 'surface-2', 'surface-hover', 'book-bid-bg', 'book-ask-bg']
const TEXTS: TokenName[] = ['text', 'text-muted', 'accent', 'danger', 'warning', 'success']
const PRICES: TokenName[] = ['price-ceiling', 'price-up', 'price-ref', 'price-down', 'price-floor']
const STATUSES = ['neutral', 'info', 'progress', 'success', 'warning', 'danger'] as const

/** Mọi cặp chữ/nền có thể xuất hiện trên giao diện. Thêm token mới thì thêm cặp ở đây. */
export const CONTRAST_PAIRS: ContrastPair[] = [
  ...[...TEXTS, ...PRICES].flatMap((fg) => SURFACES.map((bg) => ({ fg, bg, kind: 'text' as const }))),
  // Ô giá nhấp nháy: giá đổi chiều nhưng vẫn có thể dưới tham chiếu, nên mọi màu giá đều có thể nằm trên cả hai nền.
  ...PRICES.flatMap((fg) => (['price-flash-up-bg', 'price-flash-down-bg'] as TokenName[]).map((bg) => ({ fg, bg, kind: 'text' as const }))),
  { fg: 'price-ref', bg: 'price-ref-chip-bg', kind: 'text' },
  ...(['text', 'text-muted', 'accent'] as TokenName[]).map((fg) => ({ fg, bg: 'nav-active' as TokenName, kind: 'text' as const })),
  { fg: 'accent-fg', bg: 'accent', kind: 'text' },
  { fg: 'buy-fg', bg: 'buy', kind: 'text' },
  { fg: 'sell-fg', bg: 'sell', kind: 'text' },
  ...STATUSES.flatMap((name) => [
    { fg: `status-${name}-fg` as TokenName, bg: `status-${name}-bg` as TokenName, kind: 'text' as const },
    { fg: `status-${name}-fg` as TokenName, bg: 'surface' as TokenName, kind: 'text' as const },
    // Thông báo, hàng cảnh báo: chữ thường trên nền trạng thái.
    { fg: 'text' as TokenName, bg: `status-${name}-bg` as TokenName, kind: 'text' as const },
  ]),
  ...(['bg', 'surface'] as TokenName[]).map((bg) => ({ fg: 'border-strong' as TokenName, bg, kind: 'ui' as const })),
  ...(['bg', 'surface'] as TokenName[]).map((bg) => ({ fg: 'focus-ring' as TokenName, bg, kind: 'ui' as const })),
]

export interface ContrastResult extends ContrastPair {
  theme: ThemeName
  palette: 'default' | 'cvd'
  ratio: number
  threshold: number
  passed: boolean
}

/** Kiểm mọi cặp của một theme (và bảng màu). */
export function checkTheme(theme: ThemeName, palette: 'default' | 'cvd' = 'default'): ContrastResult[] {
  const colors: Palette = paletteOf(theme, palette)
  // Nền 'transparent' (chip tham chiếu ở theme tối): chữ nằm thẳng trên bề mặt, đã có trong các cặp bề mặt.
  return CONTRAST_PAIRS.filter((pair) => colors[pair.bg] !== 'transparent').map((pair) => {
    const ratio = contrastRatio(colors[pair.fg], colors[pair.bg])
    const threshold = pair.kind === 'ui' ? NON_TEXT_THRESHOLD : textThreshold(theme)
    return { ...pair, theme, palette, ratio, threshold, passed: ratio >= threshold }
  })
}
