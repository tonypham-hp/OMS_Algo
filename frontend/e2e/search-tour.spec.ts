import { e2eQuery, expect, loginAs, loginFromPage, prepare, test } from './fixtures'

test.describe('Tìm nhanh (Ctrl+K)', () => {
  test('gõ "hpg" ra cả lệnh và mã chứng khoán; bấm kết quả mở lệnh', async ({ page }) => {
    await loginAs(page, 'OPS')
    await expect(page.locator('[data-demo-id="kpi-running"]')).toBeVisible()
    await page.keyboard.press('Control+k')
    const input = page.getByRole('combobox', { name: 'Tìm nhanh' })
    await expect(input).toBeFocused()
    await input.fill('hpg')

    const results = page.getByRole('listbox', { name: 'Kết quả' })
    const orders = results.getByRole('group', { name: 'Lệnh' })
    const symbols = results.getByRole('group', { name: 'Mã chứng khoán' })
    await expect(orders.getByRole('option').first()).toContainText('HPG')
    await expect(symbols.getByRole('option').first()).toContainText('HPG')

    // Phím mũi tên chọn kết quả; Esc đóng.
    await input.press('ArrowDown')
    await expect(results.getByRole('option', { selected: true })).toHaveCount(1)
    await input.press('Escape')
    await expect(input).toHaveCount(0)

    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: 'Tìm nhanh' }).fill('hpg')
    const firstOrder = page.getByRole('group', { name: 'Lệnh' }).getByRole('option').first()
    const orderId = /PO-\d{8}-\d{4}/.exec(await firstOrder.innerText())![0]
    await firstOrder.click()
    await expect(page).toHaveURL(new RegExp(`/so-lenh/${orderId}$`))
  })
})

test.describe('Tour lần đầu', () => {
  test('hiện ở lần đăng nhập đầu, bỏ qua thì không hiện lại', async ({ page }) => {
    await prepare(page, { showTour: true })
    await page.goto(`/login${e2eQuery()}`)
    await loginFromPage(page, 'CUSTOMER')

    const tour = page.getByRole('dialog').filter({ has: page.locator('#tour-title') })
    await expect(tour).toBeVisible()
    await tour.getByRole('button', { name: 'Tiếp' }).click()
    await expect(page.locator('[data-demo-id="tour-progress"]')).toBeVisible()
    await tour.getByRole('button', { name: 'Bỏ qua' }).click()
    await expect(tour).toHaveCount(0)

    // Tải lại, đăng xuất rồi đăng nhập lại: tour không tự hiện nữa.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(tour).toHaveCount(0)
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click()
    await loginFromPage(page, 'CUSTOMER')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(tour).toHaveCount(0)
  })
})
