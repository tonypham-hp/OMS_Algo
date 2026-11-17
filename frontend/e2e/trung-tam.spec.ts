import { demoId, expect, FIXED_NOW, loginAs, test } from './fixtures'

test.describe('Trung tâm lệnh', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'OPS')
  })

  test('4 KPI hiện số', async ({ page }) => {
    for (const id of ['kpi-running', 'kpi-filled', 'kpi-attention', 'kpi-slippage']) {
      const card = demoId(page, id)
      await expect(card).toBeVisible()
      // Giá trị là số kiểu Việt Nam (1.000) hoặc bps có dấu (+1,2 bps); "—" chỉ khi chưa có lệnh khớp.
      await expect(card.locator('p').nth(1)).toHaveText(/^[+−-]?\d[\d.]*(,\d+)?( bps)?$/)
    }
  })

  test('bấm một dòng "Lệnh cần chú ý" mở đúng chi tiết lệnh', async ({ page }) => {
    const rows = demoId(page, 'attention-table').locator('tbody tr')
    await expect(rows.first()).toBeVisible()
    const orderId = (await rows.first().locator('td').first().innerText()).trim()
    await rows.first().click()
    await expect(page).toHaveURL(new RegExp(`/so-lenh/${orderId}$`))
    await expect(page.getByRole('heading', { level: 1, name: 'Chi tiết lệnh' })).toBeVisible()
    await expect(page.getByRole('main').getByText(orderId).first()).toBeVisible()
  })

  test('mở dòng cần chú ý bằng phím Enter', async ({ page }) => {
    const row = demoId(page, 'attention-table').locator('tbody tr').first()
    const orderId = (await row.locator('td').first().innerText()).trim()
    await row.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/so-lenh/${orderId}$`))
  })

  test('thông báo: đánh dấu tất cả đã đọc', async ({ page }) => {
    const bell = demoId(page, 'notification-bell')
    await expect(bell).toHaveAccessibleName(/Thông báo, \d+ chưa đọc/)
    await bell.click()
    await expect(page.getByRole('menu').getByText('(chưa đọc)').first()).toBeAttached()
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click()
    await expect(page.getByRole('menu').getByText('(chưa đọc)')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(bell).toHaveAccessibleName('Thông báo')
  })

  test('thông báo: bấm một mục thì mở lệnh và giảm số chưa đọc', async ({ page }) => {
    // Dừng đồng hồ để không có thông báo mới xen vào giữa lúc đếm.
    const bell = demoId(page, 'notification-bell')
    await expect(bell).toHaveAccessibleName(/Thông báo, \d+ chưa đọc/)
    await page.clock.pauseAt(new Date(FIXED_NOW.getTime() + 60_000))
    const before = Number((await bell.getAttribute('aria-label'))?.match(/(\d+) chưa đọc/)?.[1])
    await bell.click()
    const item = page.getByRole('menuitem').filter({ hasText: '(chưa đọc)' }).first()
    await item.click()
    await expect(page).toHaveURL(/\/so-lenh\/[^/]+$/)
    const expected = before - 1
    await expect(bell).toHaveAccessibleName(expected > 0 ? `Thông báo, ${expected} chưa đọc` : 'Thông báo')
  })
})
