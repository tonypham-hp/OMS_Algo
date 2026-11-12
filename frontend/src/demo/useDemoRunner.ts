import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { demoController } from './controller'

/** Đang gõ trong ô nhập thì không bắt phím tắt. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Gắn Chế độ Demo vào layout: cấp hàm điều hướng cho runner, chạy nhịp khung hình khi đang phát,
 * và phím tắt (chỉ khi đang Demo): Space phát / tạm dừng, → bước tiếp, Esc thoát.
 */
export function useDemoRunner() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const status = useDemoStore((state) => state.snapshot?.status)
  const active = useDemoStore((state) => state.snapshot !== null)
  const user = useAuthStore((state) => state.user)

  // Effect chạy sau khi commit: lúc này màn mới đã thay màn cũ (điều hướng của router chạy trong transition).
  useEffect(() => {
    useDemoStore.setState({ committedPath: pathname })
  }, [pathname])

  useEffect(() => {
    demoController.setNavigate((path) => navigate(path))
    return () => demoController.setNavigate(null)
  }, [navigate])

  // Đăng xuất giữa chừng: thoát Demo để khôi phục dữ liệu trước khi người khác đăng nhập.
  useEffect(() => {
    if (!user && demoController.isActive()) demoController.exit()
  }, [user])

  // Nhịp khung hình chỉ cấp số ms thật đã trôi qua; quyết định sang bước nằm trong runner.
  useEffect(() => {
    if (status !== 'playing') return
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      demoController.getRunner()?.advanceClock(now - last)
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [status])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || useDemoStore.getState().pickerOpen) return
      const runner = demoController.getRunner()
      if (event.key === 'Escape') {
        event.preventDefault()
        demoController.exit()
      } else if (event.key === ' ' && runner) {
        event.preventDefault()
        if (runner.getSnapshot().status === 'playing') runner.pause()
        else runner.play()
      } else if (event.key === 'ArrowRight' && runner) {
        event.preventDefault()
        runner.next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
