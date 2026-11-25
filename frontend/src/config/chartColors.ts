// Màu của biểu đồ (Recharts): tham chiếu biến CSS của theme, nên đổi sáng/tối/tương phản cao/mù màu là SVG đổi màu
// ngay, không cần vẽ lại hay tải lại trang. Giá trị thật ở src/config/theme.ts (token chart-*, price-*), đã kiểm tương phản.
// Đường thực tế/kế hoạch không dùng màu giá (xanh lá, đỏ...) vì các màu đó đã mang nghĩa tăng, giảm.
export const CHART_COLORS = {
  actual: 'var(--chart-actual)',
  plan: 'var(--chart-plan)',
  favorable: 'var(--price-up)',
  unfavorable: 'var(--price-down)',
  axis: 'var(--text-muted)',
  grid: 'var(--border)',
  cursor: 'var(--surface-hover)',
  tooltipBg: 'var(--surface)',
  tooltipText: 'var(--text)',
} as const
