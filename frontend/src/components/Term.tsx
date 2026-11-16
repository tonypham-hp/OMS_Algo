import { useContext, type ReactNode } from 'react'
import { getGlossaryEntry } from '@/config/glossary'
import { cn } from '@/lib/utils'
import { TermExampleContext } from './termContext'
import { Tooltip } from './Tooltip'

interface TermProps {
  /** Mã thuật ngữ trong src/config/glossary.ts. Test quét mã nguồn kiểm tra mã này phải có trong từ điển. */
  id: string
  children: ReactNode
  className?: string
  /** false khi con bên trong đã tự nhận focus (nút sắp xếp cột): tooltip mở theo focus của nút đó. */
  focusable?: boolean
}

/**
 * Thuật ngữ có gạch chân chấm: rê chuột hoặc Tab tới để xem nghĩa, công thức, ví dụ bằng số của lệnh đang xem.
 * Esc đóng tooltip. Mã không có trong từ điển thì chỉ hiện chữ, không vỡ giao diện.
 */
export function Term({ id, children, className, focusable = true }: TermProps) {
  const example = useContext(TermExampleContext)
  const entry = getGlossaryEntry(id)
  if (!entry) return <>{children}</>
  const sample = entry.example?.(example) ?? null

  return (
    <Tooltip
      focusable={focusable}
      className={cn('cursor-help rounded-sm underline decoration-dotted decoration-1 underline-offset-4', className)}
      contentClassName="max-w-96"
      content={
        <span className="flex flex-col gap-1" data-demo-id={`term-tip-${id}`}>
          <span className="font-semibold">{entry.term}</span>
          <span>{entry.short}</span>
          {entry.formula && <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">{entry.formula}</span>}
          {sample && <span className="text-muted-foreground">Ví dụ: {sample}</span>}
        </span>
      }
    >
      <span data-term={id}>{children}</span>
    </Tooltip>
  )
}
