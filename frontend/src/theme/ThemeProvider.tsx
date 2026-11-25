import { useEffect, type ReactNode } from 'react'
import { useAppearanceStore } from '@/store/appearance.store'
import { useAuthStore } from '@/store/auth.store'
import { applyToRoot, readMediaEnvironment } from './appearance'

const QUERIES = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)', '(forced-colors: active)']

/**
 * Áp cài đặt giao diện lên <html> (data-theme, data-palette…) và giữ cho khớp:
 * đổi tài khoản → nạp cài đặt của tài khoản đó; hệ điều hành đổi sáng/tối, tương phản, màu cưỡng bức → tính lại.
 * Lần vẽ đầu đã đúng nhờ script khởi động trong index.html; ở đây chỉ cập nhật về sau.
 */
export function ThemeProvider({ children }: { children?: ReactNode }) {
  const username = useAuthStore((state) => state.user?.username ?? null)
  const loadFor = useAppearanceStore((state) => state.loadFor)
  const setEnv = useAppearanceStore((state) => state.setEnv)
  const resolved = useAppearanceStore((state) => state.resolved)

  useEffect(() => loadFor(username), [username, loadFor])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const lists = QUERIES.map((query) => window.matchMedia(query))
    const onChange = () => setEnv(readMediaEnvironment())
    for (const list of lists) list.addEventListener('change', onChange)
    return () => {
      for (const list of lists) list.removeEventListener('change', onChange)
    }
  }, [setEnv])

  useEffect(() => applyToRoot(document.documentElement, resolved), [resolved])

  return children
}
