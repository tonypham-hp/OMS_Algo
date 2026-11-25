import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppearanceStore } from '@/store/appearance.store'

/** Nút Sáng/Tối trên thanh trên. Icon là chế độ sẽ chuyển sang; tên đọc nói rõ hành động. */
export function ThemeToggle() {
  const dark = useAppearanceStore((state) => state.resolved.colorScheme === 'dark')
  const toggleMode = useAppearanceStore((state) => state.toggleMode)
  const label = dark ? 'Đổi sang giao diện sáng' : 'Đổi sang giao diện tối'
  return (
    <Button size="icon-sm" variant="ghost" aria-label={label} title={label} data-testid="theme-toggle" onClick={toggleMode}>
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  )
}
