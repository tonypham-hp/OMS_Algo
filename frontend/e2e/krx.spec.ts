import type { Page } from '@playwright/test'
import { chooseStrategy, demoId, expect, loginAs, navigate, placeIceberg, runUntilSession, test } from './fixtures'

// Luật giao dịch theo KRX (Đợt 8A): sửa lệnh một trường, lô lẻ trong ATC, room ngoại, hết hiệu lực 14:45,
// ngày mô phỏng 28/12/2026 (mã HNX sang HOSE), trang Luật giao dịch.

async function chooseFromCombobox(page: Page, name: string | RegExp, option: string) {
  const combobox = page.getByRole('combobox', { name })
  await expect(async () => {
    if ((await combobox.getAttribute('aria-expanded')) !== 'true') await combobox.click()
    await page.getByRole('option', { name: option, exact: true }).click({ timeout: 2_000 })
    await expect(combobox).toContainText(option, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

async function openActions(page: Page, id: string) {
  const menu = page.getByRole('menu')
  await expect(menu).toHaveCount(0)
  await page.getByRole('button', { name: `Hành động cho lệnh ${id}` }).click()
  await expect(menu).toBeVisible()
  return menu
}

/** Đặt lệnh LO thường (LIMIT) qua phiếu lệnh, trả về mã lệnh cha. */
async function placeLimit(page: Page, values: { qty: string; price: string; odd?: boolean }) {
  await navigate(page, '/dat-lenh')
  await expect(page.getByRole('combobox', { name: 'Mã' })).toContainText('FPT')
  if (values.odd) {
    await page.getByRole('group', { name: 'Loại lô' }).getByRole('button', { name: 'Lô lẻ' }).click()
    await expect(page.getByRole('combobox', { name: /^Loại lệnh/ })).toHaveText('Lệnh giới hạn (LO)')
  } else {
    await chooseStrategy(page, 'Lệnh giới hạn (LO)')
  }
  await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill(values.qty)
  await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill(values.price)
  await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()
  if (values.odd) await expect(dialog).toContainText(`${values.qty} CP (lô lẻ)`)
  await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
  await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
  const id = (await dialog.getByText(/^PO-\d{8}-\d{4}$/).innerText()).trim()
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  return id
}

test.describe('Luật giao dịch KRX', () => {
  test('Sửa lệnh: sửa KL thì ô giá bị khóa và ngược lại, cảnh báo giữ/mất ưu tiên thời gian', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await runUntilSession(page, 'Khớp lệnh liên tục')
    const id = await placeIceberg(page)
    await navigate(page, '/so-lenh')
    const menu = await openActions(page, id)
    await menu.getByRole('menuitem', { name: 'Sửa' }).click()

    const dialog = page.getByRole('dialog')
    const qty = dialog.getByRole('textbox', { name: 'Khối lượng đặt' })
    const price = dialog.getByRole('textbox', { name: 'Giá giới hạn' })
    const save = dialog.getByRole('button', { name: 'Lưu thay đổi' })
    await expect(save).toBeDisabled()

    // Giảm KL: ô giá bị khóa, giữ ưu tiên.
    await qty.fill('4.000')
    await expect(price).toBeDisabled()
    await expect(demoId(page, 'amend-priority')).toHaveText(/Giảm KL giữ ưu tiên thời gian/)

    // Đổi trường sửa: cả hai ô mở lại, giá trị về như cũ.
    await dialog.getByRole('button', { name: 'Đổi trường sửa' }).click()
    await expect(qty).toHaveValue('5.000')
    await expect(price).toBeEnabled()

    // Đổi giá: ô KL bị khóa, mất ưu tiên.
    await price.fill('110.000')
    await expect(qty).toBeDisabled()
    await expect(demoId(page, 'amend-priority')).toHaveText(/Đổi giá sẽ mất ưu tiên thời gian/)
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(demoId(page, `order-row-${id}`)).toContainText('110.000')
  })

  test('lệnh LO lô lẻ đặt trong phiên ATC được nhận', async ({ page }) => {
    test.slow()
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/dat-lenh')
    await runUntilSession(page, 'Phiên ATC')
    const id = await placeLimit(page, { qty: '50', price: '118.000', odd: true })
    await navigate(page, '/so-lenh')
    await chooseFromCombobox(page, 'Lô', 'Lô lẻ')
    const row = demoId(page, `order-row-${id}`)
    await expect(row).toBeVisible()
    await expect(row).toContainText('Lệnh giới hạn (LO)')
    await expect(row).toContainText('50')
  })

  test('lô lẻ: KL ngoài 1–99 bị báo lỗi ngay trên phiếu lệnh', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/dat-lenh')
    await page.getByRole('group', { name: 'Loại lô' }).getByRole('button', { name: 'Lô lẻ' }).click()
    await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('150')
    await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill('118.000')
    await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
    await expect(page.getByText('Lô lẻ: khối lượng từ 1 đến 99 CP (đang nhập 150 CP).')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('lệnh mua của tài khoản nhà đầu tư nước ngoài vượt room bị từ chối đúng lý do', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await navigate(page, '/dat-lenh')
    await expect(page.getByRole('combobox', { name: 'Mã' })).toContainText('FPT')
    await chooseFromCombobox(page, 'Mã', 'MWG')
    await expect(demoId(page, 'orderbook-room')).toContainText('5.000 CP')
    await chooseFromCombobox(page, 'Tài khoản', '058C345678')
    await chooseStrategy(page, 'Lệnh giới hạn (LO)')
    await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('10.000')
    await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill('62.400')
    await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
    await expect(page.getByText(/Room ngoại của MWG chỉ còn 5\.000 CP, không mua được 10\.000 CP/)).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Tài khoản trong nước cùng lệnh đó thì không bị giới hạn room.
    await chooseFromCombobox(page, 'Tài khoản', '058C123456')
    await expect(page.getByText(/Room ngoại của MWG/)).toHaveCount(0)
  })

  test('tới 14:45 lệnh trong ngày chưa khớp chuyển "Hết hiệu lực 14:45"', async ({ page }) => {
    test.slow()
    await loginAs(page, 'CUSTOMER')
    await runUntilSession(page, 'Khớp lệnh liên tục')
    // Mua ở giá sàn: đứng chờ cả ngày, không khớp.
    const id = await placeLimit(page, { qty: '1.000', price: '109.800' })
    await navigate(page, '/so-lenh')
    await runUntilSession(page, 'Thỏa thuận sau giờ')
    await expect(demoId(page, `order-row-${id}`)).toContainText('Hết hiệu lực 14:45')
  })

  test('đổi ngày mô phỏng qua 28/12/2026: mã HNX hiện nhãn HOSE và biên ±7%, không tải lại trang', async ({ page }) => {
    await loginAs(page, 'OPS')
    await navigate(page, '/dat-lenh')
    await expect(page.getByRole('combobox', { name: 'Mã' })).toContainText('FPT')
    await chooseFromCombobox(page, 'Mã', 'XHA')
    await expect(demoId(page, 'board-badge-XHA')).toContainText('HNX')
    await expect(demoId(page, 'price-band')).toContainText('biên ±10%')

    // Đánh dấu trang: tải lại trang thì dấu này mất.
    await page.evaluate(() => Object.assign(window, { __noReload: true }))
    await page.getByRole('button', { name: /^Ngày mô phỏng 16\/11\/2026/ }).click()
    await page.getByRole('button', { name: 'Đến 28/12/2026' }).click()
    await expect(page.getByRole('button', { name: /^Ngày mô phỏng 28\/12\/2026/ })).toBeVisible()

    await expect(demoId(page, 'board-badge-XHA')).toContainText('HOSE')
    await expect(demoId(page, 'board-badge-XHA')).toContainText('Giả định')
    await expect(demoId(page, 'price-band')).toContainText('biên ±7%')
    expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true)
  })

  test('trang Luật giao dịch (OPS): bảng gói luật, trạng thái kiểm chứng, nạp thử pack bỏ nghỉ trưa', async ({ page }) => {
    await loginAs(page, 'OPS')
    await navigate(page, '/cau-hinh/luat')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luật giao dịch')
    const table = demoId(page, 'rule-packs-table')
    await expect(table.locator('[data-pack-id="sto-krx-2025"]')).toContainText('Đang áp dụng')
    await expect(table.locator('[data-pack-id="sto-krx-2025"]')).toContainText('Đã kiểm chứng')
    await expect(table.locator('[data-pack-id="stx-krx-2025"]')).toContainText('23/12/2026')
    await expect(table.locator('[data-pack-id="upx-krx-2025"]')).toContainText('Chưa kiểm chứng')

    await page.getByRole('button', { name: 'Thử cấu hình bỏ nghỉ trưa' }).click()
    await expect(demoId(page, 'experimental-active')).toBeVisible()
    await expect(table.locator('[data-pack-id="sto-experimental-no-lunch"]')).toContainText('Đang áp dụng')
    await page.getByRole('button', { name: 'Bỏ cấu hình thử' }).click()
    await expect(demoId(page, 'experimental-active')).toHaveCount(0)
  })

  test('khách hàng, dealer không vào được trang Luật giao dịch', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await page.goto('/cau-hinh/luat')
    await expect(page).toHaveURL(/\/403$/)
  })
})
