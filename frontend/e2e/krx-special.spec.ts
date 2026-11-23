import type { Page } from '@playwright/test'
import { chooseStrategy, demoId, expect, loginAs, navigate, runUntilSession, test } from './fixtures'

// Phiên giao dịch đặc biệt theo KRX (Đợt 8B): mã hạn chế khớp định kỳ, tạm ngừng và giao dịch lại, lệnh thỏa thuận.

async function chooseFromCombobox(page: Page, name: string | RegExp, option: string) {
  const combobox = page.getByRole('combobox', { name })
  await expect(async () => {
    if ((await combobox.getAttribute('aria-expanded')) !== 'true') await combobox.click()
    await page.getByRole('option', { name: option, exact: true }).click({ timeout: 2_000 })
    await expect(combobox).toContainText(option, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

async function setSpeed(page: Page, speed: 'x1' | 'x60') {
  await page.getByRole('group', { name: 'Tốc độ giả lập' }).getByRole('button', { name: speed, exact: true }).click()
}

/** Đặt lệnh LO thường qua phiếu lệnh, trả về mã lệnh cha. */
async function placeLimit(page: Page, symbol: string, qty: string, price: string) {
  await navigate(page, '/dat-lenh')
  await expect(page.getByRole('combobox', { name: 'Mã' })).toContainText('FPT')
  if (symbol !== 'FPT') await chooseFromCombobox(page, 'Mã', symbol)
  await chooseStrategy(page, 'Lệnh giới hạn (LO)')
  await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill(qty)
  await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill(price)
  await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
  await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
  const id = (await dialog.getByText(/^PO-\d{8}-\d{4}$/).innerText()).trim()
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  return id
}

async function openActions(page: Page, id: string) {
  const menu = page.getByRole('menu')
  await expect(menu).toHaveCount(0)
  await page.getByRole('button', { name: `Hành động cho lệnh ${id}` }).click()
  await expect(menu).toBeVisible()
  return menu
}

test.describe('Phiên giao dịch đặc biệt KRX', () => {
  test('mã hạn chế: nút Hủy bị vô hiệu trong 5 phút cuối lượt, kèm lý do và giờ khớp', async ({ page }) => {
    test.slow()
    await loginAs(page, 'CUSTOMER')
    const id = await placeLimit(page, 'XRS', '1.000', '14.000')
    await expect(demoId(page, 'symbol-status-XRS').first()).toHaveText('Hạn chế GD')

    // Tua tới cửa sổ khóa đầu tiên (09:25–09:30): đồng hồ đếm ngược báo "đang khóa sửa/hủy".
    const countdown = demoId(page, 'call-countdown-XRS').first()
    await setSpeed(page, 'x60')
    await expect(async () => {
      await page.clock.runFor(1_000)
      await expect(countdown).toContainText('đang khóa sửa/hủy', { timeout: 200 })
    }).toPass({ timeout: 120_000 })
    await setSpeed(page, 'x1')
    await expect(countdown).toContainText('Khớp kế tiếp 09:30')

    await navigate(page, '/so-lenh')
    const menu = await openActions(page, id)
    await expect(menu.getByRole('menuitem', { name: /^Hủy/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByRole('menuitem', { name: /^Sửa/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByText('Khóa sửa, hủy 5 phút cuối lượt khớp định kỳ (khớp lúc 09:30)').first()).toBeVisible()
  })

  test('vận hành tạm ngừng mã → lệnh cha "Hệ thống tạm dừng" → giao dịch lại chạy phiên khớp định kỳ', async ({ page }) => {
    await loginAs(page, 'OPS')
    const id = await placeLimit(page, 'FPT', '1.000', '110.000')
    const row = demoId(page, `order-row-${id}`)

    await navigate(page, '/van-hanh')
    const panel = demoId(page, 'symbol-halt-panel')
    await expect(panel.getByRole('combobox', { name: 'Mã' })).toContainText('FPT')
    await panel.getByRole('button', { name: 'Tạm ngừng mã' }).click()
    await expect(demoId(page, 'halt-status')).toHaveText('Tạm ngừng')

    await navigate(page, '/so-lenh')
    await expect(row).toContainText('Hệ thống tạm dừng')
    await expect(row).toContainText('Tạm ngừng')

    await navigate(page, '/van-hanh')
    await panel.getByRole('button', { name: 'Giao dịch lại' }).click()
    await expect(demoId(page, 'halt-status')).toHaveText('Khớp định kỳ sau tạm ngừng')
    await expect(demoId(page, 'call-countdown-FPT').first()).toContainText('Khớp kế tiếp')

    await navigate(page, '/so-lenh')
    await expect(row).toContainText('Đang hoạt động')
    await expect(row).toContainText('Khớp định kỳ sau tạm ngừng')
    // Phiên khớp định kỳ sau tạm ngừng cấm sửa, hủy.
    const menu = await openActions(page, id)
    await expect(menu.getByRole('menuitem', { name: /^Hủy/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByText('Không được sửa, hủy lệnh trong Khớp định kỳ sau tạm ngừng').first()).toBeVisible()
  })

  test('đặt lệnh thỏa thuận lúc 14:50 → đối ứng xác nhận → khớp; không hủy được sau khi khớp', async ({ page }) => {
    test.slow()
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/so-lenh?tab=thoa-thuan')
    await runUntilSession(page, 'Thỏa thuận sau giờ')
    await setSpeed(page, 'x60')
    await page.clock.runFor(5_000)
    await setSpeed(page, 'x1')
    await expect(demoId(page, 'session-status')).toContainText(/14:5\d/)

    await page.getByRole('button', { name: 'Tạo lệnh thỏa thuận' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Lệnh thỏa thuận' })).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Khối lượng' }).fill('10.000')
    await dialog.getByRole('textbox', { name: 'Giá thỏa thuận' }).fill('118.050')
    await dialog.getByRole('button', { name: 'Gửi lệnh thỏa thuận' }).click()
    await expect(dialog.getByText('Lệnh thỏa thuận trên HOSE tối thiểu 20.000 CP (đang nhập 10.000 CP).')).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Khối lượng' }).fill('20.000')
    await dialog.getByRole('button', { name: 'Gửi lệnh thỏa thuận' }).click()
    await expect(dialog).toHaveCount(0)

    const row = page.locator('[data-demo-id^="put-through-row-"]').first()
    await expect(row).toContainText('Chờ đối ứng xác nhận')
    await expect(row).toContainText('20.000')
    await row.getByRole('button', { name: 'Đối ứng xác nhận' }).click()
    await expect(row).toContainText('Đã khớp')
    await expect(row.getByRole('button', { name: 'Hủy' })).toBeDisabled()
    await expect(row.getByRole('button', { name: 'Đối ứng xác nhận' })).toHaveCount(0)
  })
})
