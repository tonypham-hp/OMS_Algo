import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, placeIceberg, runUntilSession, test } from './fixtures'

/**
 * Ảnh nghiệm thu Đợt 8A (luật KRX), 1440×900:
 * phiếu lệnh lô lẻ, hộp Sửa lệnh có cảnh báo ưu tiên, trang /cau-hinh/luat, mã HNX trước và sau 28/12/2026.
 * Không nằm trong test:e2e; chạy bằng `npm run screenshots:dot8a`.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'dot8a')

async function shot(page: Page, name: string) {
  await page.clock.runFor(1_500)
  await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

async function chooseSymbol(page: Page, symbol: string) {
  const combobox = page.getByRole('combobox', { name: 'Mã' })
  await expect(combobox).toContainText('FPT')
  await expect(async () => {
    if ((await combobox.getAttribute('aria-expanded')) !== 'true') await combobox.click()
    await page.getByRole('option', { name: symbol, exact: true }).click({ timeout: 2_000 })
    await expect(combobox).toContainText(symbol, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

test('phiếu lệnh lô lẻ (dealer)', async ({ page }) => {
  await loginAs(page, 'DEALER')
  await navigate(page, '/dat-lenh')
  await expect(page.getByRole('combobox', { name: 'Mã' })).toContainText('FPT')
  await page.getByRole('group', { name: 'Loại lô' }).getByRole('button', { name: 'Lô lẻ' }).click()
  await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('50')
  await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill('118.000')
  await expect(demoId(page, 'odd-lot-hint')).toBeVisible()
  await shot(page, '01-phieu-lenh-lo-le')
})

test('hộp Sửa lệnh có cảnh báo ưu tiên (khách hàng)', async ({ page }) => {
  await loginAs(page, 'CUSTOMER')
  await runUntilSession(page, 'Khớp lệnh liên tục')
  const id = await placeIceberg(page)
  await navigate(page, '/so-lenh')
  await page.getByRole('button', { name: `Hành động cho lệnh ${id}` }).click()
  await page.getByRole('menu').getByRole('menuitem', { name: 'Sửa' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: 'Giá giới hạn' }).fill('110.000')
  await expect(demoId(page, 'amend-priority')).toBeVisible()
  await shot(page, '02-sua-lenh-canh-bao-uu-tien')
})

test('trang Luật giao dịch (vanhanh)', async ({ page }) => {
  await loginAs(page, 'OPS')
  await navigate(page, '/cau-hinh/luat')
  await expect(demoId(page, 'rule-packs-table')).toBeVisible()
  await shot(page, '03-cau-hinh-luat')
})

test('mã HNX trước và sau 28/12/2026 (vanhanh)', async ({ page }) => {
  await loginAs(page, 'OPS')
  await navigate(page, '/dat-lenh')
  await chooseSymbol(page, 'XHA')
  await expect(demoId(page, 'board-badge-XHA')).toContainText('HNX')
  await shot(page, '04-ma-hnx-truoc-28-12')

  await page.getByRole('button', { name: /^Ngày mô phỏng/ }).click()
  await page.getByRole('button', { name: 'Đến 28/12/2026' }).click()
  await expect(demoId(page, 'board-badge-XHA')).toContainText('HOSE')
  await shot(page, '05-ma-hnx-sau-28-12-sang-hose')
})
