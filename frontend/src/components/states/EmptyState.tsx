import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  /** Nút hoặc liên kết gợi ý bước tiếp theo. */
  action?: ReactNode
  className?: string
}

/** Không có dữ liệu để hiển thị. */
export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 py-8 text-center', className)}>
      <Icon className="text-muted-foreground/70 size-6" aria-hidden />
      <p className="text-muted-foreground text-sm">{title}</p>
      {description && <p className="text-muted-foreground/80 text-xs">{description}</p>}
      {action}
    </div>
  )
}
