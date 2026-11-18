import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, test } from './fixtures'

/**
 * Ảnh nghiệm thu Đợt 7: mỗi tab của màn Lịch sử và đối soát một ảnh, tài khoản vanhanh, 1440×900.
 * Không nằm trong test:e2e; chạy bằng `npm run screenshots:dot7`.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'dot7')

async function shot(page: Page, name: string) {
  await page.clock.runFor(1_500)
  await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

test('3 tab Lịch sử và đối soát (vanhanh)', async ({ page }) => {
  await loginAs(page, 'OPS')
  await navigate(page, '/bao-cao/lich-su?tab=lich-su')
  await expect(demoId(page, 'history-table')).toBeVisible()
  await shot(page, '01-lich-su-lenh')

  await navigate(page, '/bao-cao/lich-su?tab=nhat-ky')
  await expect(demoId(page, 'audit-table')).toBeVisible()
  await shot(page, '02-nhat-ky-kiem-toan')

  await navigate(page, '/bao-cao/lich-su?tab=doi-soat')
  await expect(demoId(page, 'recon-table')).toBeVisible()
  await shot(page, '03-doi-soat')
})
