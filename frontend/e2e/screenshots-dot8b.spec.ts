import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { chooseStrategy, demoId, expect, loginAs, navigate, test } from './fixtures'

/**
 * Ảnh nghiệm thu Đợt 8B (phiên đặc biệt KRX), 1440×900: mã hạn chế có đồng hồ đếm ngược, nút Hủy bị khóa,
 * phiếu thỏa thuận, tab Thỏa thuận. Không nằm trong test:e2e; chạy bằng `npm run screenshots:dot8b`.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'dot8b')

async function shot(page: Page, name: string) {
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

async function speed(page: Page, value: 'x1' | 'x60') {
  await page.getByRole('group', { name: 'Tốc độ giả lập' }).getByRole('button', { name: value, exact: true }).click()
}

test('mã hạn chế: đồng hồ đếm ngược và nút Hủy bị khóa (khách hàng)', async ({ page }) => {
  await loginAs(page, 'CUSTOMER')
  await navigate(page, '/dat-lenh')
  await chooseSymbol(page, 'XRS')
  await chooseStrategy(page, 'Lệnh giới hạn (LO)')
  await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('1.000')
  await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill('14.000')
  await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
  const id = (await dialog.getByText(/^PO-\d{8}-\d{4}$/).innerText()).trim()
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()

  // Tua vào lượt định kỳ đầu tiên (sau 09:15) để có đồng hồ đếm ngược.
  const countdown = demoId(page, 'call-countdown-XRS').first()
  await speed(page, 'x60')
  await expect(async () => {
    await page.clock.runFor(1_000)
    await expect(countdown).toContainText('Khớp kế tiếp 09:30', { timeout: 200 })
  }).toPass({ timeout: 60_000 })
  await speed(page, 'x1')
  await page.getByRole('heading', { name: 'Đặt lệnh nâng cao' }).scrollIntoViewIfNeeded()
  await shot(page, '01-ma-han-che-dem-nguoc')

  await speed(page, 'x60')
  await expect(async () => {
    await page.clock.runFor(1_000)
    await expect(countdown).toContainText('đang khóa sửa/hủy', { timeout: 200 })
  }).toPass({ timeout: 60_000 })
  await speed(page, 'x1')
  await navigate(page, '/so-lenh')
  await page.getByRole('button', { name: `Hành động cho lệnh ${id}` }).click()
  await expect(page.getByRole('menu').getByText(/Khóa sửa, hủy 5 phút cuối lượt/).first()).toBeVisible()
  // Chờ hiệu ứng mở menu chạy xong để ảnh không bị mờ chồng chữ.
  await page.waitForTimeout(500)
  await shot(page, '02-nut-huy-bi-khoa')
})

test('phiếu thỏa thuận và tab Thỏa thuận (khách hàng, 14:50)', async ({ page }) => {
  await loginAs(page, 'CUSTOMER')
  await navigate(page, '/so-lenh?tab=thoa-thuan')
  const status = demoId(page, 'session-status')
  await speed(page, 'x60')
  for (let index = 0; index < 400 && !/14:5\d/.test(await status.innerText()); index += 1) await page.clock.runFor(5_000)
  await speed(page, 'x1')

  await page.getByRole('button', { name: 'Tạo lệnh thỏa thuận' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Khối lượng' }).fill('20.000')
  await dialog.getByRole('textbox', { name: 'Giá thỏa thuận' }).fill('118.050')
  await shot(page, '03-phieu-thoa-thuan')
  await dialog.getByRole('button', { name: 'Gửi lệnh thỏa thuận' }).click()
  await expect(dialog).toHaveCount(0)

  // Một lệnh đã khớp, một lệnh chờ đối ứng.
  await page.getByRole('button', { name: 'Đối ứng xác nhận' }).first().click()
  await expect(page.locator('[data-demo-id^="put-through-row-"]').first()).toContainText('Đã khớp')
  await page.getByRole('button', { name: 'Tạo lệnh thỏa thuận' }).click()
  await dialog.getByRole('button', { name: 'Bán' }).click()
  await dialog.getByRole('textbox', { name: 'Khối lượng' }).fill('25.000')
  await dialog.getByRole('textbox', { name: 'Giá thỏa thuận' }).fill('117.800')
  await dialog.getByRole('button', { name: 'Gửi lệnh thỏa thuận' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(demoId(page, 'put-through-table')).toContainText('Chờ đối ứng xác nhận')
  await shot(page, '04-tab-thoa-thuan')
})
