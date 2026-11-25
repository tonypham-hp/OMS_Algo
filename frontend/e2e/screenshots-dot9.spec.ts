import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, runUntilSession, seedAppearance, test } from './fixtures'

/**
 * Ảnh nghiệm thu Đợt 9 (theme), 1440×900: Trung tâm lệnh và Đặt lệnh + Sổ lệnh 3 mức ở Sáng, Tối, Tương phản cao
 * (tối, sáng), Mù màu; trang Cài đặt giao diện. Không nằm trong test:e2e; chạy bằng `npm run screenshots:dot9`.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'dot9')

const VARIANTS = [
  { file: 'sang', settings: { mode: 'light' } },
  { file: 'toi', settings: { mode: 'dark' } },
  { file: 'tuong-phan-cao-toi', settings: { mode: 'dark', highContrast: true } },
  { file: 'tuong-phan-cao-sang', settings: { mode: 'light', highContrast: true } },
  { file: 'mu-mau', settings: { mode: 'dark', palette: 'cvd' } },
] as const

async function shot(page: Page, name: string, fullPage = false) {
  await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage })
}

for (const variant of VARIANTS) {
  test(`Trung tâm lệnh và Đặt lệnh · ${variant.file}`, async ({ page }) => {
    test.setTimeout(180_000)
    await seedAppearance(page, variant.settings)
    await loginAs(page, 'OPS')
    // Khớp liên tục: giá đã chạy, đủ cả trần/tăng/tham chiếu/giảm/sàn trên bảng giá.
    await runUntilSession(page, 'Khớp lệnh liên tục')
    await page.clock.runFor(20_000)
    await navigate(page, '/trung-tam')
    await expect(demoId(page, 'kpi-running')).toBeVisible()
    await shot(page, `trung-tam-${variant.file}`)
    await navigate(page, '/dat-lenh')
    await expect(demoId(page, 'orderbook3')).toBeVisible()
    await page.clock.runFor(2_000)
    await shot(page, `dat-lenh-${variant.file}`)
  })
}

test('Cài đặt giao diện (cả trang)', async ({ page }) => {
  await loginAs(page, 'DEALER')
  await navigate(page, '/cai-dat')
  await expect(page.getByTestId('settings-page')).toBeVisible()
  await shot(page, 'cai-dat', true)
})
