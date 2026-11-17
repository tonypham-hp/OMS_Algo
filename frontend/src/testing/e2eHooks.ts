/**
 * Cờ chỉ dùng khi chạy test e2e (Playwright). Chỉ có tác dụng ở bản dev: bản build bỏ hẳn nhánh này.
 *
 * Bật bằng query string ở lần mở trang đầu tiên, ví dụ `/login?e2e=1&seed=42&fail=dashboard,orders`:
 * - `seed`: thay Math.random bằng dãy giả ngẫu nhiên cố định để giá, lệnh mẫu… lặp lại được giữa các lần chạy.
 * - `fail`: các nhóm API trả lỗi 500 để kiểm ErrorState (tên nhóm là đoạn sau `/api/`, ví dụ `dashboard`, `orders`).
 * - `delay`: số mili giây chờ trước mỗi phản hồi API để kiểm LoadingState.
 * Cờ được lưu vào sessionStorage để giữ qua điều hướng và tải lại trang trong cùng tab.
 * Đồng hồ không đặt ở đây: test dùng `page.clock` của Playwright để cố định `Date` và `setInterval`.
 */
export interface E2eFlags {
  seed: number | null
  fail: string[]
  delay: number
}

const STORAGE_KEY = 'oms-e2e'

/** LCG giống demo/env.ts, chép lại để module này không kéo theo engine giả lập khi nạp sớm. */
function createLcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

function parseFlags(search: string): E2eFlags | null {
  const params = new URLSearchParams(search)
  if (params.get('e2e') !== '1') return null
  const seed = Number(params.get('seed'))
  return {
    seed: Number.isFinite(seed) && params.has('seed') ? seed : null,
    fail: (params.get('fail') ?? '').split(',').filter(Boolean),
    delay: Math.max(0, Number(params.get('delay')) || 0),
  }
}

function readFlags(): E2eFlags | null {
  try {
    const fromUrl = parseFlags(window.location.search)
    if (fromUrl) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl))
      return fromUrl
    }
    const saved = window.sessionStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as E2eFlags) : null
  } catch {
    return null
  }
}

const flags: E2eFlags | null = import.meta.env.DEV && typeof window !== 'undefined' ? readFlags() : null

// Thay Math.random trước khi bộ giả lập được nạp (module này được import đầu tiên ở main.tsx).
if (flags?.seed !== null && flags?.seed !== undefined) Math.random = createLcg(flags.seed)

export function getE2eFlags(): E2eFlags | null {
  return flags
}

/** Nhóm API của một URL: `/api/orders/123/detail` → `orders`. */
export function apiGroupOf(url: string): string | null {
  const match = /\/api\/([^/?]+)/.exec(new URL(url, 'http://localhost').pathname)
  return match ? match[1] : null
}
