import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  /** Câu báo lỗi tiếng Việt, thường gồm ngữ cảnh + message của API. */
  message: ReactNode
  /** Có thì hiện nút "Thử lại". */
  onRetry?: () => void
  className?: string
}

/** Lỗi khi tải hoặc thao tác. `role="alert"` để trình đọc màn hình báo ngay. */
export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('text-destructive flex flex-wrap items-center gap-2 text-sm', className)}>
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>{message}</span>
      {onRetry && (
        <Button size="xs" variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  )
}
