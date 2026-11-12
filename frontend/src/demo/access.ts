import type { Role } from '@/types'

/**
 * Ai thấy nút "▶ Demo": vận hành luôn thấy; các vai trò khác chỉ khi bật VITE_DEMO_MODE=true
 * (ví dụ máy trình bày cho sếp, đăng nhập bằng tài khoản khách hàng).
 */
export function canUseDemo(role: Role | undefined, demoMode: string | undefined = import.meta.env.VITE_DEMO_MODE) {
  if (!role) return false
  return role === 'OPS' || demoMode === 'true'
}
