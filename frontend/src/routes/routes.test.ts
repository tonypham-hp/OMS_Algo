import { isValidElement } from 'react'
import { matchRoutes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { DemoUser } from '@/types'
import { getProtectedRedirect, getPublicRedirect, HOME_PATH, LOGIN_PATH } from './guards'

// Bộ giả lập thị trường đăng ký sự kiện của window khi import: thay bằng bản rỗng để chạy trong Node.
vi.mock('@/services/market.service', () => ({
  marketService: { subscribe: () => () => {}, setSpeed: () => {}, resetDay: () => {}, nextDay: () => {} },
}))

const { routes } = await import('./routeConfig')
const { LoginRoute } = await import('./LoginRoute')
const { ProtectedRoute } = await import('./ProtectedRoute')

const user: DemoUser = { username: 'khachhang', display_name: 'Khách hàng demo', role: 'CUSTOMER', accounts: ['A'] }

/** Các guard (element) mà đường dẫn đi qua, từ ngoài vào trong. */
function guardsOf(path: string) {
  return (matchRoutes(routes, path) ?? []).map(({ route }) =>
    isValidElement(route.element) ? route.element.type : null,
  )
}

describe('guard', () => {
  it('chưa đăng nhập vào trang cần đăng nhập thì về /login', () => {
    expect(getProtectedRedirect(null)).toBe(LOGIN_PATH)
    expect(getProtectedRedirect(user)).toBeNull()
  })

  it('đã đăng nhập vào / hoặc /login thì sang /trung-tam', () => {
    expect(getPublicRedirect(user)).toBe(HOME_PATH)
    expect(HOME_PATH).toBe('/trung-tam')
    expect(getPublicRedirect(null)).toBeNull()
  })
})

describe('cấu hình route', () => {
  it('/trung-tam và các màn cũ nằm sau ProtectedRoute', () => {
    for (const path of ['/trung-tam', '/dat-lenh', '/so-lenh', '/so-lenh/PO-1', '/van-hanh', '/cau-hinh']) {
      const guards = guardsOf(path)
      expect(guards).toContain(ProtectedRoute)
      expect(guards).not.toContain(LoginRoute)
    }
  })

  it('"/" và "/login" là trang công khai, đi qua LoginRoute', () => {
    for (const path of ['/', '/login']) {
      const guards = guardsOf(path)
      expect(guards).toContain(LoginRoute)
      expect(guards).not.toContain(ProtectedRoute)
    }
  })
})
