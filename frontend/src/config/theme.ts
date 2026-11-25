/**
 * Design tokens của giao diện: NGUỒN DUY NHẤT của mọi giá trị màu (Đợt 9).
 * - `PALETTES`: giá trị từng token theo theme (sáng, tối, tương phản cao tối, tương phản cao sáng).
 * - `CVD_OVERRIDES`: bảng màu cho người mù màu đỏ – lục (xanh lam – cam), đè lên theme đang dùng.
 * - `renderTokensCss()` sinh src/styles/tokens.css (chạy `npm run tokens`); test kiểm file đó khớp với đây.
 * Component không dùng mã màu trực tiếp: dùng lớp Tailwind (text-price-up, bg-surface…) hoặc `readToken()`.
 * Quy ước màu bảng giá VN (trần tím, tăng xanh lá, tham chiếu vàng, giảm đỏ, sàn xanh lam) là thông lệ thị trường,
 * không phải quy định của Sở. Tỷ lệ tương phản từng cặp chữ/nền được kiểm trong src/theme/contrast.test.ts.
 */

export type ThemeName = 'light' | 'dark' | 'hc-dark' | 'hc-light'
export const THEME_NAMES: readonly ThemeName[] = ['light', 'dark', 'hc-dark', 'hc-light']

export const TOKEN_NAMES = [
  // Bề mặt, chữ
  'bg',
  'surface',
  'surface-panel',
  'surface-2',
  'surface-hover',
  'nav-active',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'accent',
  'accent-fg',
  'focus-ring',
  'danger',
  'warning',
  'success',
  'overlay',
  // Giá (quy ước VN)
  'price-ceiling',
  'price-up',
  'price-ref',
  'price-down',
  'price-floor',
  'price-flash-up-bg',
  'price-flash-down-bg',
  'price-ref-chip-bg',
  // Sổ lệnh 3 mức: nền nhạt phía mua / phía bán (tương phản cao: bằng nền thẻ)
  'book-bid-bg',
  'book-ask-bg',
  // Lệnh
  'buy',
  'buy-fg',
  'sell',
  'sell-fg',
  // Trạng thái (nhãn lệnh, cảnh báo…): chữ và nền
  'status-neutral-fg',
  'status-neutral-bg',
  'status-info-fg',
  'status-info-bg',
  'status-progress-fg',
  'status-progress-bg',
  'status-success-fg',
  'status-success-bg',
  'status-warning-fg',
  'status-warning-bg',
  'status-danger-fg',
  'status-danger-bg',
  // Biểu đồ (không dùng màu giá vì đã mang nghĩa tăng, giảm)
  'chart-actual',
  'chart-plan',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]
export type Palette = Record<TokenName, string>

/** Trộn màu `fg` vào nền `bg` với tỷ lệ `amount` (0..1), trả về hex. Dùng cho nền nhãn trạng thái. */
export function mixHex(fg: string, bg: string, amount: number): string {
  const channel = (hex: string, start: number) => parseInt(hex.slice(start, start + 2), 16)
  const mix = (start: number) =>
    Math.round(channel(fg, start) * amount + channel(bg, start) * (1 - amount))
      .toString(16)
      .padStart(2, '0')
  return `#${mix(1)}${mix(3)}${mix(5)}`.toUpperCase()
}

/** Màu chữ trạng thái; nền là chữ trộn `amount` vào bề mặt thẻ. */
function statusTokens(
  surface: string,
  amount: number,
  fg: Record<'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger', string>,
) {
  const result = {} as Record<string, string>
  for (const [name, color] of Object.entries(fg)) {
    result[`status-${name}-fg`] = color
    result[`status-${name}-bg`] = mixHex(color, surface, amount)
  }
  return result as Pick<Palette, Extract<TokenName, `status-${string}`>>
}

const DARK_SURFACE = '#111A2B'
const LIGHT_SURFACE = '#FFFFFF'
const HC_DARK_SURFACE = '#0A0A0A'
const HC_LIGHT_SURFACE = '#FFFFFF'

export const PALETTES: Record<ThemeName, Palette> = {
  dark: {
    bg: '#0B1220',
    surface: DARK_SURFACE,
    'surface-panel': '#0D1626',
    'surface-2': '#131D31',
    // Hàng bảng đang rê, đang chọn: #16243D làm đỏ giảm tụt dưới 4,5:1, nên dùng nền tối hơn.
    'surface-hover': '#131D31',
    'nav-active': '#16243D',
    border: '#1E2B44',
    'border-strong': '#5B6B86',
    text: '#E6EDF7',
    'text-muted': '#9FB0C9',
    accent: '#818CF8',
    'accent-fg': '#0B1220',
    'focus-ring': '#818CF8',
    danger: '#F6465D',
    warning: '#F0B90B',
    success: '#0ECB81',
    overlay: '#0000008C',
    'price-ceiling': '#FF25FF',
    'price-up': '#0ECB81',
    'price-ref': '#F0B90B',
    'price-down': '#F6465D',
    'price-floor': '#1EB5D8',
    'price-flash-up-bg': '#13251F',
    'price-flash-down-bg': '#26141E',
    'price-ref-chip-bg': '#111A2B',
    'book-bid-bg': mixHex('#0ECB81', DARK_SURFACE, 0.05),
    'book-ask-bg': mixHex('#F6465D', DARK_SURFACE, 0.05),
    buy: '#0ECB81',
    'buy-fg': '#04121F',
    sell: '#F6465D',
    'sell-fg': '#04121F',
    ...statusTokens(DARK_SURFACE, 0.16, {
      neutral: '#B6C2D4',
      info: '#7DD3FC',
      progress: '#A5B4FC',
      success: '#0ECB81',
      warning: '#F0B90B',
      danger: '#FF6B7D',
    }),
    'chart-actual': '#3987E5',
    'chart-plan': '#D95926',
  },
  light: {
    bg: '#F8FAFC',
    surface: LIGHT_SURFACE,
    'surface-panel': '#F1F5F9',
    'surface-2': '#F1F5F9',
    'surface-hover': '#F1F5F9',
    'nav-active': '#E0E7FF',
    border: '#E2E8F0',
    'border-strong': '#7C8BA1',
    text: '#0F172A',
    'text-muted': '#475569',
    accent: '#4338CA',
    'accent-fg': '#FFFFFF',
    'focus-ring': '#4338CA',
    danger: '#B91C1C',
    warning: '#854D0E',
    success: '#15803D',
    overlay: '#0F172A66',
    'price-ceiling': '#A21CAF',
    'price-up': '#15803D',
    'price-ref': '#854D0E',
    'price-down': '#B91C1C',
    'price-floor': '#0369A1',
    'price-flash-up-bg': '#F0FDF4',
    'price-flash-down-bg': '#FFF5F5',
    // Giá tham chiếu chữ đậm trên chip vàng nhạt để vẫn "thấy vàng" trên nền sáng.
    'price-ref-chip-bg': '#FEF9C3',
    'book-bid-bg': mixHex('#15803D', LIGHT_SURFACE, 0.05),
    'book-ask-bg': mixHex('#B91C1C', LIGHT_SURFACE, 0.05),
    buy: '#15803D',
    'buy-fg': '#FFFFFF',
    sell: '#B91C1C',
    'sell-fg': '#FFFFFF',
    ...statusTokens(LIGHT_SURFACE, 0.07, {
      neutral: '#334155',
      info: '#0369A1',
      progress: '#4338CA',
      success: '#15803D',
      warning: '#854D0E',
      danger: '#B91C1C',
    }),
    'chart-actual': '#1D4ED8',
    'chart-plan': '#C2410C',
  },
  'hc-dark': {
    bg: '#000000',
    surface: HC_DARK_SURFACE,
    'surface-panel': '#000000',
    'surface-2': '#141414',
    'surface-hover': '#141414',
    'nav-active': '#1F1F1F',
    border: '#737373',
    'border-strong': '#A3A3A3',
    text: '#FFFFFF',
    'text-muted': '#D4D4D8',
    accent: '#A5B4FC',
    'accent-fg': '#000000',
    'focus-ring': '#FFFFFF',
    danger: '#FF7A8A',
    warning: '#F0B90B',
    success: '#0ECB81',
    overlay: '#000000B3',
    'price-ceiling': '#E879F9',
    'price-up': '#0ECB81',
    'price-ref': '#F0B90B',
    'price-down': '#FF7A8A',
    'price-floor': '#1EB5D8',
    // Tương phản cao: nhấp nháy chỉ hiện mũi tên, nền giữ nguyên để chữ luôn ≥ 7:1.
    'price-flash-up-bg': HC_DARK_SURFACE,
    'price-flash-down-bg': HC_DARK_SURFACE,
    'price-ref-chip-bg': HC_DARK_SURFACE,
    'book-bid-bg': HC_DARK_SURFACE,
    'book-ask-bg': HC_DARK_SURFACE,
    buy: '#0ECB81',
    'buy-fg': '#000000',
    sell: '#FF7A8A',
    'sell-fg': '#000000',
    ...statusTokens(HC_DARK_SURFACE, 0.1, {
      neutral: '#E5E5E5',
      info: '#7DD3FC',
      progress: '#C7D2FE',
      success: '#0ECB81',
      warning: '#F0B90B',
      danger: '#FF8A98',
    }),
    'chart-actual': '#7DB4FF',
    'chart-plan': '#FF9A5C',
  },
  'hc-light': {
    bg: '#FFFFFF',
    surface: HC_LIGHT_SURFACE,
    'surface-panel': '#FFFFFF',
    'surface-2': '#FFFFFF',
    'surface-hover': '#FFFFFF',
    'nav-active': '#E0E7FF',
    border: '#52525B',
    'border-strong': '#3F3F46',
    text: '#000000',
    'text-muted': '#27272A',
    accent: '#3730A3',
    'accent-fg': '#FFFFFF',
    'focus-ring': '#000000',
    danger: '#991B1B',
    warning: '#713F12',
    success: '#166534',
    overlay: '#00000080',
    'price-ceiling': '#86198F',
    'price-up': '#166534',
    'price-ref': '#713F12',
    'price-down': '#991B1B',
    'price-floor': '#075985',
    'price-flash-up-bg': HC_LIGHT_SURFACE,
    'price-flash-down-bg': HC_LIGHT_SURFACE,
    'price-ref-chip-bg': '#FEF3C7',
    'book-bid-bg': HC_LIGHT_SURFACE,
    'book-ask-bg': HC_LIGHT_SURFACE,
    buy: '#166534',
    'buy-fg': '#FFFFFF',
    sell: '#991B1B',
    'sell-fg': '#FFFFFF',
    ...statusTokens(HC_LIGHT_SURFACE, 0, {
      neutral: '#27272A',
      info: '#075985',
      progress: '#3730A3',
      success: '#166534',
      warning: '#713F12',
      danger: '#991B1B',
    }),
    'chart-actual': '#1E3A8A',
    'chart-plan': '#9A3412',
  },
}

/**
 * Bảng màu mù màu đỏ – lục (`data-palette="cvd"`): tăng xanh lam, giảm cam; áp cả nút Mua/Bán và nhãn trạng thái
 * thành công/lỗi. Trần, tham chiếu, sàn giữ nguyên (đã có ký hiệu T/S riêng, không chỉ dựa vào màu).
 */
export const CVD_OVERRIDES: Record<ThemeName, Partial<Palette>> = {
  dark: cvd('#60A5FA', '#FB923C', '#04121F', DARK_SURFACE, 0.16, 0.05),
  light: cvd('#1D4ED8', '#C2410C', '#FFFFFF', LIGHT_SURFACE, 0.07, 0.05),
  'hc-dark': cvd('#93C5FD', '#FDBA74', '#000000', HC_DARK_SURFACE, 0.1, 0),
  'hc-light': cvd('#1E3A8A', '#9A3412', '#FFFFFF', HC_LIGHT_SURFACE, 0, 0),
}

function cvd(up: string, down: string, fg: string, surface: string, amount: number, bookTint: number): Partial<Palette> {
  return {
    'price-up': up,
    'price-down': down,
    buy: up,
    'buy-fg': fg,
    sell: down,
    'sell-fg': fg,
    success: up,
    danger: down,
    'status-success-fg': up,
    'status-success-bg': mixHex(up, surface, amount),
    'status-danger-fg': down,
    'status-danger-bg': mixHex(down, surface, amount),
    'book-bid-bg': mixHex(up, surface, bookTint),
    'book-ask-bg': mixHex(down, surface, bookTint),
  }
}

/** Bảng màu đang áp dụng (theme + bảng màu), dùng trong test và tài liệu. */
export function paletteOf(theme: ThemeName, palette: 'default' | 'cvd' = 'default'): Palette {
  return palette === 'cvd' ? { ...PALETTES[theme], ...CVD_OVERRIDES[theme] } : PALETTES[theme]
}

const THEME_SELECTORS: Record<ThemeName, string> = {
  light: ':root',
  dark: ':root[data-theme="dark"]',
  'hc-dark': ':root[data-theme="hc-dark"]',
  'hc-light': ':root[data-theme="hc-light"]',
}

const COLOR_SCHEME: Record<ThemeName, 'light' | 'dark'> = { light: 'light', dark: 'dark', 'hc-dark': 'dark', 'hc-light': 'light' }

/** Nội dung src/styles/tokens.css, sinh từ `PALETTES` và `CVD_OVERRIDES`. */
export function renderTokensCss(): string {
  const block = (selector: string, values: Partial<Palette>, scheme?: string) =>
    [
      `${selector} {`,
      ...(scheme ? [`  color-scheme: ${scheme};`] : []),
      ...Object.entries(values).map(([name, value]) => `  --${name}: ${value};`),
      '}',
    ].join('\n')
  const parts = [
    '/* SINH TỰ ĐỘNG từ src/config/theme.ts (npm run tokens). Không sửa tay: sửa theme.ts rồi chạy lại. */',
    '/* :root là theme sáng; data-theme đặt trên <html> bởi script khởi động (index.html) và ThemeProvider. */',
    ...THEME_NAMES.map((theme) => block(THEME_SELECTORS[theme], PALETTES[theme], COLOR_SCHEME[theme])),
    ...THEME_NAMES.map((theme) =>
      block(`${theme === 'light' ? ':root' : THEME_SELECTORS[theme]}[data-palette="cvd"]`, CVD_OVERRIDES[theme]),
    ),
  ]
  return `${parts.join('\n\n')}\n`
}

/** Đọc giá trị một token tại thời điểm chạy (biểu đồ, canvas). Ngoài trình duyệt thì lấy theme tối. */
export function readToken(name: TokenName): string {
  if (typeof document === 'undefined') return PALETTES.dark[name]
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  return value || PALETTES.dark[name]
}

export const FONTS = {
  sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

/** Kích thước khung ứng dụng (px). */
export const LAYOUT = {
  sidebarWidth: 232,
  sidebarCollapsedWidth: 64,
  topBarHeight: 56,
  /** Bảng "Điều kiện kiểm tra" của Chế độ Demo, bên phải. */
  demoChecksWidth: 300,
} as const
