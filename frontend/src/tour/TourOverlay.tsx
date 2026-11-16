import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { useUiStore } from '@/store/ui.store'
import { markTourDone, shouldStartTour } from './tourState'
import { TOUR_STEPS } from './tourSteps'

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6
const EDGE = 12
const CARD_WIDTH = 340
/** Đo lại vị trí phần tử định kỳ: màn đang tải, thanh bên thu gọn, dữ liệu đổi làm phần tử dịch chỗ. */
const MEASURE_MS = 250

/** Khung bao quanh mọi phần tử của bước hiện tại; null khi chưa thấy phần tử nào. */
function measure(targets: string[]): Box | null {
  const rects = targets
    .flatMap((id) => Array.from(document.querySelectorAll<HTMLElement>(`[data-demo-id="${CSS.escape(id)}"]`)))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
  if (rects.length === 0) return null
  const top = Math.min(...rects.map((rect) => rect.top)) - PAD
  const left = Math.min(...rects.map((rect) => rect.left)) - PAD
  const bottom = Math.max(...rects.map((rect) => rect.bottom)) + PAD
  const right = Math.max(...rects.map((rect) => rect.right)) + PAD
  return { top, left, width: right - left, height: bottom - top }
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

/** Đặt thẻ hướng dẫn bên phải phần tử nếu đủ chỗ, không thì bên dưới, không thì bên trên; luôn nằm trong màn hình. */
function placeCard(box: Box | null, cardHeight: number) {
  const width = Math.min(CARD_WIDTH, window.innerWidth - EDGE * 2)
  if (!box) return { top: window.innerHeight / 2 - cardHeight / 2, left: window.innerWidth / 2 - width / 2, width }
  const clampTop = (top: number) => Math.min(Math.max(top, EDGE), window.innerHeight - cardHeight - EDGE)
  const clampLeft = (left: number) => Math.min(Math.max(left, EDGE), window.innerWidth - width - EDGE)
  if (box.left + box.width + EDGE + width <= window.innerWidth - EDGE) {
    return { top: clampTop(box.top), left: box.left + box.width + EDGE, width }
  }
  if (box.top + box.height + EDGE + cardHeight <= window.innerHeight - EDGE) {
    return { top: box.top + box.height + EDGE, left: clampLeft(box.left + box.width - width), width }
  }
  return { top: clampTop(box.top - cardHeight - EDGE), left: clampLeft(box.left), width }
}

/**
 * Tour lần đầu: tô sáng từng phần tử theo data-demo-id, thẻ hướng dẫn có Tiếp / Bỏ qua.
 * Tự chạy một lần mỗi vai trò, mở lại được từ menu tài khoản, không bao giờ chạy khi đang Demo.
 */
export function TourOverlay() {
  const role = useAuthStore((state) => state.user?.role)
  const demoActive = useDemoStore((state) => state.snapshot !== null)
  const open = useUiStore((state) => state.tourOpen)
  const setOpen = useUiStore((state) => state.setTourOpen)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [cardHeight, setCardHeight] = useState(180)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Lần đầu vào ứng dụng với vai trò này: tự mở tour.
  useEffect(() => {
    if (shouldStartTour(role, demoActive)) setOpen(true)
    // Chỉ xét khi đổi vai trò (đăng nhập); bật, tắt Demo không làm tour tự mở lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  // Vào Demo giữa chừng: đóng tour, không ghi là đã xem.
  useEffect(() => {
    if (demoActive && open) setOpen(false)
  }, [demoActive, open, setOpen])

  const current = TOUR_STEPS[step]
  const isVisible = open && !demoActive && role !== undefined && current !== undefined

  const finish = useCallback(() => {
    if (role) markTourDone(role)
    setOpen(false)
    setStep(0)
  }, [role, setOpen])

  useEffect(() => {
    if (!isVisible || !current.path || pathname === current.path) return
    navigate(current.path)
  }, [isVisible, current, pathname, navigate])

  useEffect(() => {
    if (!isVisible) return
    const update = () => {
      const next = measure(current.targets)
      setBox((previous) => (sameBox(previous, next) ? previous : next))
      const height = cardRef.current?.offsetHeight
      if (height) setCardHeight((previous) => (previous === height ? previous : height))
    }
    update()
    const timer = window.setInterval(update, MEASURE_MS)
    window.addEventListener('resize', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('resize', update)
    }
  }, [isVisible, current])

  // Phần tử nằm ngoài màn hình (trang dài): cuộn tới một lần khi sang bước mới.
  useEffect(() => {
    if (!isVisible) return
    const element = document.querySelector<HTMLElement>(`[data-demo-id="${CSS.escape(current.targets[0])}"]`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [isVisible, current])

  useLayoutEffect(() => {
    if (isVisible) nextRef.current?.focus()
  }, [isVisible, step])

  useEffect(() => {
    if (!isVisible) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
        return
      }
      // Giữ focus trong thẻ hướng dẫn: Tab, Shift+Tab chỉ đi giữa Bỏ qua và Tiếp.
      if (event.key === 'Tab') {
        const buttons = Array.from(cardRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
        if (buttons.length === 0) return
        event.preventDefault()
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length
        buttons[next].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isVisible, finish])

  if (!isVisible) return null
  const isLast = step === TOUR_STEPS.length - 1
  const card = placeCard(box, cardHeight)

  return createPortal(
    <div className="fixed inset-0 z-[70]" data-demo-id="tour">
      {/* Nền tối có lỗ ở phần tử đang giới thiệu: dùng box-shadow lớn của chính khung tô sáng. */}
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
            outline: '2px solid var(--color-price-ref)',
          }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-black/55" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="bg-popover text-popover-foreground border-border-strong fixed flex flex-col gap-3 rounded-lg border p-4 shadow-xl"
        style={{ top: card.top, left: card.left, width: card.width }}
      >
        <p className="text-muted-foreground text-xs" data-demo-id="tour-progress">
          Bước {step + 1}/{TOUR_STEPS.length}
        </p>
        <h2 id="tour-title" className="font-semibold">
          {current.title}
        </h2>
        <p id="tour-body" className="text-sm leading-relaxed">
          {current.body}
        </p>
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={finish}>
            Bỏ qua
          </Button>
          <Button ref={nextRef} size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))}>
            {isLast ? 'Xong' : 'Tiếp'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
