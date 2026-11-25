import type { Page } from '@playwright/test'
import { FIXED_NOW, demoId, e2eQuery, expect, loginFromPage, navigate, prepare, seedAppearance, test } from './fixtures'

/**
 * Ảnh chuẩn theo theme (toHaveScreenshot), ở cả hai khổ màn của config: desktop-1440 và laptop-1366.
 * - Đồng hồ dừng ở một mốc cố định trước khi đăng nhập (page.clock.pauseAt): bộ giả lập chỉ tick khi tua bằng runFor cố định,
 *   nên dữ liệu giống hệt mỗi lần chạy.
 * - Tắt hiệu ứng (animations: 'disabled', giảm chuyển động).
 * - Font Google trả rỗng: dùng font hệ thống cố định, tránh lệch điểm ảnh do tải font chậm/khác phiên bản.
 * Cập nhật ảnh chuẩn khi cố ý đổi giao diện: npx playwright test e2e/visual.spec.ts --update-snapshots
 */
const VARIANTS = [
  { id: 'light', settings: { mode: 'light' } },
  { id: 'dark', settings: { mode: 'dark' } },
  { id: 'hc-dark', settings: { mode: 'dark', highContrast: true } },
  { id: 'hc-light', settings: { mode: 'light', highContrast: true } },
  { id: 'cvd', settings: { mode: 'dark', palette: 'cvd' } },
] as const

const SCREENS = [
  { id: 'trung-tam', path: '/trung-tam', ready: 'kpi-running' },
  { id: 'dat-lenh', path: '/dat-lenh', ready: 'orderbook3' },
] as const

async function openFrozen(page: Page, settings: object) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seedAppearance(page, settings)
  await prepare(page)
  await page.goto(`/login${e2eQuery()}`)
  await expect(page.getByRole('radio', { name: /vanhanh/ })).toBeVisible()
  // Trang đăng nhập cần đồng hồ chạy (khởi động MSW); dừng ở đúng một mốc trước khi bộ giả lập bắt đầu tick.
  await page.clock.pauseAt(new Date(FIXED_NOW.getTime() + 5_000))
  await loginFromPage(page, 'OPS')
}

for (const variant of VARIANTS) {
  for (const screen of SCREENS) {
    test(`ảnh chuẩn ${screen.id} · ${variant.id}`, async ({ page }) => {
      await openFrozen(page, variant.settings)
      await navigate(page, screen.path)
      // Tua từng bước nhỏ tới khi màn có dữ liệu, rồi nhảy tới một mốc tuyệt đối: thời gian giả lập và số nhịp của
      // bộ giả lập (bắt đầu đúng lúc đăng nhập, ở mốc +5 giây) luôn như nhau dù số bước nhỏ khác nhau giữa các lần chạy.
      await expect(async () => {
        await page.clock.runFor(100)
        await expect(demoId(page, screen.ready)).toBeVisible({ timeout: 100 })
      }).toPass({ timeout: 30_000 })
      await page.clock.pauseAt(new Date(FIXED_NOW.getTime() + 12_000))
      await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
      await expect(page).toHaveScreenshot(`${screen.id}-${variant.id}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.01,
      })
    })
  }
}
