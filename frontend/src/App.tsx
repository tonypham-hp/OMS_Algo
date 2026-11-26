import { QueryClientProvider } from '@tanstack/react-query'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { queryClient } from '@/lib/queryClient'
import { AppRoutes } from '@/routes'
import { ThemeProvider } from '@/theme/ThemeProvider'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* Phím tắt: scope "global" luôn bật; Bàn làm việc bật thêm scope "workspace" khi đang mở. */}
        <HotkeysProvider initiallyActiveScopes={['global']}>
          <AppRoutes />
        </HotkeysProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
