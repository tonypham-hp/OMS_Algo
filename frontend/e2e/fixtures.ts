import { test as base, expect, type Page } from '@playwright/test'

export type Role = 'CUSTOMER' | 'DEALER' | 'OPS'

export const USERNAMES: Record<Role, string> = { CUSTOMER: 'khachhang', DEALER: 'dealer', OPS: 'vanhanh' }
export const ROLE_LABELS: Record<Role, string> = { CUSTOMER: 'Khách hàng', DEALER: 'Dealer', OPS: 'Vận hành' }

/** Ngày giờ giả lập cố định cho mọi test: thứ Hai 16/11/2026, 09:10 giờ Việt Nam. */
export const FIXED_NOW = new Date('2026-11-16T09:10:00+07:00')
/** Seed cố định của Math.random khi test (xem src/testing/e2eHooks.ts). */
export const SEED = 20_261_116

export interface E2eOptions {
  /** Nhóm API trả lỗi 500 (ví dụ ['dashboard']). */
  fail?: string[]
  /** Làm chậm mọi phản hồi API (mili giây). */
  delay?: number
  /** Giữ tour lần đầu (mặc định đánh dấu đã xem để không che giao diện). */
  showTour?: boolean
}

/** Query string bật cờ test, gắn vào lần mở trang đầu tiên. */
export function e2eQuery(options: E2eOptions = {}) {
  const params = new URLSearchParams({ e2e: '1', seed: String(SEED) })
  if (options.fail?.length) params.set('fail', options.fail.join(','))
  if (options.delay) params.set('delay', String(options.delay))
  return `?${params.toString()}`
}

/** Lỗi console và request lỗi thu được trong một test. */
export interface PageProblems {
  console: string[]
  requests: string[]
}

/** MSW in vài dòng thông tin lúc khởi động, không phải lỗi. Lỗi giả lập có chủ đích khi test cũng bỏ qua. */
function isExpectedConsole(text: string) {
  return text.includes('Lỗi giả lập khi test') || text.includes('status of 500')
}

export function watchProblems(page: Page, options: { allowHttpErrors?: boolean } = {}): PageProblems {
  const problems: PageProblems = { console: [], requests: [] }
  page.on('console', (message) => {
    if (message.type() === 'error' && !(options.allowHttpErrors && isExpectedConsole(message.text()))) {
      problems.console.push(message.text())
    }
  })
  page.on('pageerror', (error) => problems.console.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => {
    // Điều hướng bị hủy giữa chừng (đổi trang nhanh) không phải lỗi của app.
    if (request.failure()?.errorText.includes('ERR_ABORTED')) return
    problems.requests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400 && !options.allowHttpErrors) {
      problems.requests.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  return problems
}

/** Cài đồng hồ giả lập và cờ test trước khi mở trang. Gọi trước page.goto đầu tiên. */
export async function prepare(page: Page, options: E2eOptions = {}) {
  await page.clock.install({ time: FIXED_NOW })
  if (!options.showTour) {
    await page.addInitScript(() => {
      for (const role of ['CUSTOMER', 'DEALER', 'OPS']) window.localStorage.setItem(`oms-tour-${role}`, 'done')
    })
  }
}

/** Mở trang đăng nhập (kèm cờ test) và vào hệ thống bằng tài khoản của vai trò. */
export async function loginAs(page: Page, role: Role, options: E2eOptions = {}) {
  await prepare(page, options)
  await page.goto(`/login${e2eQuery(options)}`)
  await loginFromPage(page, role)
}

/** Đăng nhập khi đang đứng ở trang đăng nhập. */
export async function loginFromPage(page: Page, role: Role) {
  await page.getByRole('radio', { name: new RegExp(USERNAMES[role]) }).click()
  await page.getByRole('button', { name: `Vào hệ thống với vai trò ${ROLE_LABELS[role]}` }).click()
  await expect(page).toHaveURL(/\/trung-tam$/)
}

/** Đi tới route bằng thanh bên/URL trong cùng phiên (giữ dữ liệu giả lập trong bộ nhớ). */
export async function navigate(page: Page, path: string) {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
}

/** Tua đồng hồ giả lập (mili giây thật của trình duyệt; bộ giả lập tick mỗi 1 giây). */
export async function advance(page: Page, ms: number) {
  await page.clock.runFor(ms)
}

export const demoId = (page: Page, id: string) => page.locator(`[data-demo-id="${id}"]`)

/** Test có sẵn bộ theo dõi lỗi: test nào cũng fail nếu có lỗi console hoặc request lỗi ngoài dự kiến. */
export const test = base.extend<{ allowHttpErrors: boolean; problems: PageProblems }>({
  /** Bật trong test cố ý làm lỗi API (kiểm ErrorState): bỏ qua phản hồi 4xx/5xx và lỗi console tương ứng. */
  allowHttpErrors: [false, { option: true }],
  problems: [
    async ({ page, allowHttpErrors }, use) => {
      const problems = watchProblems(page, { allowHttpErrors })
      await use(problems)
      expect(problems.console, 'Lỗi console').toEqual([])
      expect(problems.requests, 'Request lỗi').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
