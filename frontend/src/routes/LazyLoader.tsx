import { Suspense, type ReactNode } from 'react'
import { LoadingState } from '@/components/states'

/** Hiện chữ chờ trong lúc tải code của trang (mỗi trang là một file JS riêng). */
export function LazyLoader({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingState className="p-6" />}>
      {children}
    </Suspense>
  )
}
