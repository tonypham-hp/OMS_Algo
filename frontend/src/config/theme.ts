/**
 * Design tokens của giao diện. Biến CSS trong src/index.css (khối .dark) dùng đúng các giá trị này;
 * file này dành cho chỗ cần mã màu trực tiếp (biểu đồ, style inline).
 */
export const THEME = {
  background: '#0b1220',
  sidebar: '#0d1626',
  card: '#111a2b',
  border: '#1e2b44',
  borderStrong: '#2a3a58',
  navActive: '#16243d',
  text: '#e6edf7',
  textMuted: '#9fb0c9',
  accent: '#38bdf8',
  onAccent: '#04121f',
  up: '#4ade80',
  down: '#f87171',
  ref: '#facc15',
  ceiling: '#c084fc',
  floor: '#38bdf8',
} as const

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
