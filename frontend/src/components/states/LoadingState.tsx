import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  label?: string
  className?: string
}

/** Đang tải dữ liệu. `role="status"` để trình đọc màn hình báo khi xuất hiện. */
export function LoadingState({ label = 'Đang tải...', className }: LoadingStateProps) {
  return (
    <p role="status" className={cn('text-muted-foreground flex items-center gap-2 text-sm', className)}>
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </p>
  )
}
