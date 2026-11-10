import type { DemoUser } from '@/types'

/** Trang mặc định sau đăng nhập. */
export const HOME_PATH = '/trung-tam'
export const LOGIN_PATH = '/login'

/** Trang công khai ("/", "/login"): đã đăng nhập thì chuyển sang trang mặc định. */
export function getPublicRedirect(user: DemoUser | null): string | null {
  return user ? HOME_PATH : null
}

/** Trang cần đăng nhập: chưa đăng nhập thì về trang đăng nhập. */
export function getProtectedRedirect(user: DemoUser | null): string | null {
  return user ? null : LOGIN_PATH
}
