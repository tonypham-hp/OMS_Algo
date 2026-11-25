// Cài đặt giao diện (Đợt 9) và hàm thuần chọn theme. Dùng chung cho ThemeProvider, trang Cài đặt và test;
// script khởi động trong index.html (src/theme/bootstrap.ts) làm đúng cùng phép tính này trước lần vẽ đầu.
import type { ThemeName } from '../config/theme.ts'

export type ThemeMode = 'light' | 'dark' | 'system'
export type PaletteName = 'default' | 'cvd'
export type Density = 'comfortable' | 'compact'
export type FontScale = 90 | 100 | 110

export interface AppearanceSettings {
  mode: ThemeMode
  /** null: theo hệ thống (prefers-contrast: more). */
  highContrast: boolean | null
  palette: PaletteName
  density: Density
  fontScale: FontScale
  /** Nhấp nháy ô giá khi giá đổi (prefers-reduced-motion luôn tắt, bất kể cài đặt). */
  flash: boolean
  /** Ẩn số tiền, bps và số tài khoản khi trình chiếu. */
  hideSensitive: boolean
}

/** Mặc định: Tối (chưa có lựa chọn đã lưu, hoặc localStorage lỗi). */
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  mode: 'dark',
  highContrast: null,
  palette: 'default',
  density: 'comfortable',
  fontScale: 100,
  flash: true,
  hideSensitive: false,
}

export interface MediaEnvironment {
  prefersDark: boolean
  prefersMoreContrast: boolean
  forcedColors: boolean
}

export interface ResolvedAppearance {
  theme: ThemeName
  palette: PaletteName
  density: Density
  fontScale: FontScale
  flash: 'on' | 'off'
  colorScheme: 'light' | 'dark'
  forcedColors: boolean
}

/** Khóa localStorage: theo tài khoản, và bản sao của lần dùng gần nhất cho script khởi động (chưa biết ai đăng nhập). */
export const APPEARANCE_KEY_PREFIX = 'oms-appearance:'
export const APPEARANCE_LAST_KEY = `${APPEARANCE_KEY_PREFIX}last`
export const appearanceKey = (username: string) => `${APPEARANCE_KEY_PREFIX}${username}`

const pick = <T>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback)

/** Đọc cài đặt đã lưu, bỏ qua trường lạ hoặc sai kiểu (dữ liệu cũ, sửa tay). */
export function parseAppearance(raw: unknown): AppearanceSettings {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    mode: pick(value.mode, ['light', 'dark', 'system'] as const, DEFAULT_APPEARANCE.mode),
    highContrast: value.highContrast === true || value.highContrast === false ? value.highContrast : null,
    palette: pick(value.palette, ['default', 'cvd'] as const, DEFAULT_APPEARANCE.palette),
    density: pick(value.density, ['comfortable', 'compact'] as const, DEFAULT_APPEARANCE.density),
    fontScale: pick(value.fontScale, [90, 100, 110] as const, DEFAULT_APPEARANCE.fontScale),
    flash: typeof value.flash === 'boolean' ? value.flash : DEFAULT_APPEARANCE.flash,
    hideSensitive: typeof value.hideSensitive === 'boolean' ? value.hideSensitive : DEFAULT_APPEARANCE.hideSensitive,
  }
}

/** Chọn theme thực tế từ cài đặt và môi trường (prefers-color-scheme, prefers-contrast, forced-colors). */
export function resolveAppearance(settings: AppearanceSettings, env: MediaEnvironment): ResolvedAppearance {
  const base = settings.mode === 'system' ? (env.prefersDark ? 'dark' : 'light') : settings.mode
  const highContrast = settings.highContrast ?? env.prefersMoreContrast
  const theme: ThemeName = highContrast ? (base === 'dark' ? 'hc-dark' : 'hc-light') : base
  return {
    theme,
    palette: settings.palette,
    density: settings.density,
    fontScale: settings.fontScale,
    flash: settings.flash ? 'on' : 'off',
    colorScheme: base,
    forcedColors: env.forcedColors,
  }
}

/** Đặt các thuộc tính data-* lên <html>: CSS (tokens.css, index.css) đọc từ đây. */
export function applyToRoot(root: HTMLElement, resolved: ResolvedAppearance) {
  root.dataset.theme = resolved.theme
  root.dataset.palette = resolved.palette
  root.dataset.density = resolved.density
  root.dataset.fontScale = String(resolved.fontScale)
  root.dataset.flash = resolved.flash
  if (resolved.forcedColors) root.dataset.forcedColors = 'active'
  else delete root.dataset.forcedColors
  root.style.colorScheme = resolved.colorScheme
}

/** Môi trường hiện tại của trình duyệt; ngoài trình duyệt (test) coi như không có ưu tiên nào. */
export function readMediaEnvironment(): MediaEnvironment {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { prefersDark: false, prefersMoreContrast: false, forcedColors: false }
  }
  return {
    prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    prefersMoreContrast: window.matchMedia('(prefers-contrast: more)').matches,
    forcedColors: window.matchMedia('(forced-colors: active)').matches,
  }
}
