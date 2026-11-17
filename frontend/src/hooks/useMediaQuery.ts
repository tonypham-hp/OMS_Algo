import { useCallback, useSyncExternalStore } from 'react'

/** Màn hình từ 1280px trở xuống: thanh bên tự thu gọn để nội dung đủ chỗ. */
export const NARROW_SCREEN_QUERY = '(max-width: 1280px)'

/** Theo dõi một media query. Ngoài trình duyệt (test Node) luôn trả false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}
