import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useDemoStore } from '@/store/demo.store'

/** Chờ phần tử xuất hiện tối đa bấy nhiêu ms (màn vừa mở, dữ liệu đang tải). */
const WAIT_FOR_TARGET_MS = 3000

/** Escape giá trị cho bộ chọn thuộc tính CSS (mã lệnh chỉ có chữ, số, gạch ngang nhưng vẫn phòng xa). */
const escapeValue = (value: string) => value.replace(/["\\]/g, '\\$&')

/**
 * Tô sáng phần tử của bước hiện tại: viền vàng 2px, nền vàng nhạt, tự cuộn tới. Phần còn lại của màn không bị che.
 * Dùng một rule CSS theo [data-demo-id] thay vì gắn class: React vẽ lại phần tử (đổi trạng thái, dữ liệu mới)
 * cũng không làm mất tô sáng.
 */
export function DemoHighlight() {
  const highlight = useDemoStore((state) => state.snapshot?.highlight ?? null)
  const executed = useDemoStore((state) => state.snapshot?.executed ?? 0)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!highlight) return
    const selector = `[data-demo-id="${escapeValue(highlight)}"]`
    const scrollTo = () => {
      const element = document.querySelector(selector)
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return element !== null
    }
    if (scrollTo()) return
    const observer = new MutationObserver(() => {
      if (scrollTo()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setTimeout(() => observer.disconnect(), WAIT_FOR_TARGET_MS)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [highlight, executed, pathname])

  if (!highlight) return null
  return (
    <style>{`[data-demo-id="${escapeValue(highlight)}"] {
  outline: 2px solid var(--color-price-ref);
  outline-offset: 2px;
  background-color: color-mix(in srgb, var(--color-price-ref) 14%, transparent);
  border-radius: 6px;
  transition: outline-color 0.2s, background-color 0.2s;
}`}</style>
  )
}
