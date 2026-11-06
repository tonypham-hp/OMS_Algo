import { Suspense, type ReactNode } from 'react'

/** Hiện chữ chờ trong lúc tải code của trang (mỗi trang là một file JS riêng). */
export function LazyLoader({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="text-muted-foreground p-6 text-sm">Đang tải...</p>}>
      {children}
    </Suspense>
  )
}
