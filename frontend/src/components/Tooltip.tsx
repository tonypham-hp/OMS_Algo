import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Khoảng cách giữa tooltip và phần tử, và lề tối thiểu với mép màn hình. */
const GAP = 6
const EDGE = 8

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  /** Cho phần tử nhận focus bằng Tab (mặc định có). Tắt khi con bên trong đã tự nhận focus (nút, liên kết). */
  focusable?: boolean
  className?: string
  /** Lớp của khung tooltip, ví dụ để nới chiều rộng. */
  contentClassName?: string
  /** Tên dễ đọc của phần tử, cho trình đọc màn hình khi con bên trong không có chữ. */
  label?: string
}

/**
 * Tooltip tự viết, không dùng thư viện: rê chuột hoặc focus để mở, Esc hoặc rời đi để đóng.
 * Tooltip nằm trong portal ở body để không bị cắt bởi bảng cuộn, và tự lật lên trên khi thiếu chỗ phía dưới.
 */
export function Tooltip({ content, children, focusable = true, className, contentClassName, label }: TooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => setOpen(true), [])
  const hide = useCallback(() => {
    setOpen(false)
    setPosition(null)
  }, [])

  /** Đặt tooltip dưới phần tử, thiếu chỗ thì lật lên trên; luôn nằm trong màn hình. */
  const place = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect()
    const tip = tipRef.current?.getBoundingClientRect()
    if (!trigger || !tip) return
    const below = trigger.bottom + GAP
    const top = below + tip.height + EDGE > window.innerHeight ? Math.max(trigger.top - GAP - tip.height, EDGE) : below
    const centered = trigger.left + trigger.width / 2 - tip.width / 2
    const left = Math.min(Math.max(centered, EDGE), window.innerWidth - tip.width - EDGE)
    setPosition((previous) => (previous?.top === top && previous.left === left ? previous : { top, left }))
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Chỉ đóng tooltip, không để Esc đóng luôn hộp thoại phía sau.
        event.stopPropagation()
        hide()
      }
    }
    // Tab tới phần tử ngoài màn hình làm trang cuộn: đặt lại vị trí thay vì đóng, để tooltip vẫn đọc được.
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, hide, place])

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex', className)}
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={open ? id : undefined}
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={cn(
              'bg-popover text-popover-foreground border-border-strong pointer-events-none fixed z-[60] max-w-80 rounded-md border px-3 py-2 text-xs leading-relaxed shadow-lg',
              contentClassName,
            )}
            style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: 'hidden' }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}
