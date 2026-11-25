import { create } from 'zustand'
import {
  APPEARANCE_LAST_KEY,
  DEFAULT_APPEARANCE,
  appearanceKey,
  parseAppearance,
  readMediaEnvironment,
  resolveAppearance,
  type AppearanceSettings,
  type MediaEnvironment,
  type ResolvedAppearance,
} from '@/theme/appearance'

/** Chỉ có trong trình duyệt; trong Node (test) trả undefined, trừ khi test tự gắn window giả. */
const browserStorage = (): Storage | undefined => (typeof window === 'undefined' ? undefined : window.localStorage)

/**
 * Đọc cài đặt của một tài khoản (null: chưa đăng nhập → bản của lần dùng gần nhất).
 * localStorage bị chặn hoặc dữ liệu hỏng: trả mặc định (Tối), không ném lỗi.
 */
export function loadAppearance(username: string | null): AppearanceSettings {
  try {
    const storage = browserStorage()
    const raw = storage?.getItem(username ? appearanceKey(username) : APPEARANCE_LAST_KEY)
    // Tài khoản chưa có cài đặt riêng: dùng mặc định, không thừa hưởng của người dùng trước trên cùng máy.
    return raw ? parseAppearance(JSON.parse(raw)) : { ...DEFAULT_APPEARANCE }
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

/** Lưu theo tài khoản, kèm bản sao `:last` cho script khởi động (chạy trước khi biết ai đăng nhập). */
export function saveAppearance(username: string | null, settings: AppearanceSettings) {
  try {
    const storage = browserStorage()
    const value = JSON.stringify(settings)
    if (username) storage?.setItem(appearanceKey(username), value)
    storage?.setItem(APPEARANCE_LAST_KEY, value)
  } catch {
    // Không lưu được (chế độ riêng tư, hết chỗ): vẫn áp trong phiên này, lần sau mở lại ở mặc định.
  }
}

interface AppearanceState {
  /** Tài khoản đang áp cài đặt; null khi chưa đăng nhập. */
  owner: string | null
  settings: AppearanceSettings
  env: MediaEnvironment
  resolved: ResolvedAppearance
  /** Đổi tài khoản (đăng nhập/đăng xuất): nạp cài đặt của tài khoản đó. */
  loadFor: (username: string | null) => void
  update: (patch: Partial<AppearanceSettings>) => void
  /** Nút trên thanh trên / Ctrl+K: đổi qua lại Sáng ↔ Tối theo nền đang hiện (Theo hệ thống cũng thành lựa chọn cụ thể). */
  toggleMode: () => void
  setEnv: (env: MediaEnvironment) => void
}

export const useAppearanceStore = create<AppearanceState>()((set, get) => {
  const env = readMediaEnvironment()
  const settings = loadAppearance(null)
  const commit = (owner: string | null, next: AppearanceSettings) =>
    set({ owner, settings: next, resolved: resolveAppearance(next, get().env) })
  return {
    owner: null,
    settings,
    env,
    resolved: resolveAppearance(settings, env),
    loadFor: (username) => {
      if (username === get().owner) return
      const next = loadAppearance(username)
      // Ghi lại `:last` để lần tải sau (trước khi biết ai đăng nhập) khớp tài khoản vừa vào.
      if (username) saveAppearance(null, next)
      commit(username, next)
    },
    update: (patch) => {
      const next = { ...get().settings, ...patch }
      saveAppearance(get().owner, next)
      commit(get().owner, next)
    },
    toggleMode: () => get().update({ mode: get().resolved.colorScheme === 'dark' ? 'light' : 'dark' }),
    setEnv: (nextEnv) => set({ env: nextEnv, resolved: resolveAppearance(get().settings, nextEnv) }),
  }
})
