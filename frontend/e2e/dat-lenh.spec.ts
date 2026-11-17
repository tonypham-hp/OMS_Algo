import type { Page } from '@playwright/test'
import { chooseStrategy, demoId, expect, loginAs, navigate, test } from './fixtures'

async function fillIceberg(page: Page, values: { qty: string; slice: string; price: string }) {
  await chooseStrategy(page, 'Iceberg')
  await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill(values.qty)
  await page.getByRole('textbox', { name: 'KL mỗi phần' }).fill(values.slice)
  await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill(values.price)
}

test.describe('Đặt lệnh', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/dat-lenh')
    await expect(page.getByRole('combobox', { name: 'Mã' })).toHaveText('FPT')
  })

  test('đặt Iceberg hợp lệ → có trong Sổ lệnh', async ({ page }) => {
    await fillIceberg(page, { qty: '10.000', slice: '1.000', price: '118.000' })
    await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
    await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
    const orderId = (await dialog.getByText(/^PO-\d{8}-\d{4}$/).innerText()).trim()
    await dialog.getByRole('button', { name: 'Đóng' }).click()

    await page.locator('[data-demo-id="nav-so-lenh"]').click()
    const row = demoId(page, `order-row-${orderId}`)
    await expect(row).toBeVisible()
    await expect(row).toContainText('Iceberg')
    await expect(row).toContainText('10.000')
  })

  const invalidCases = [
    { name: 'sai bước giá', values: { qty: '10.000', slice: '1.000', price: '118.050' }, error: 'Giá phải theo bước 100đ ở mức giá này' },
    { name: 'sai lô 100', values: { qty: '10.050', slice: '1.000', price: '118.000' }, error: 'Khối lượng phải là bội số của 100' },
    { name: 'giá vượt trần', values: { qty: '10.000', slice: '1.000', price: '130.000' }, error: 'Giá không được vượt giá trần 126.200' },
    { name: 'giá dưới sàn', values: { qty: '10.000', slice: '1.000', price: '100.000' }, error: 'Giá không được thấp hơn giá sàn 109.800' },
  ]
  for (const item of invalidCases) {
    test(`nhập ${item.name} → báo lỗi tiếng Việt, không đặt được`, async ({ page }) => {
      await fillIceberg(page, item.values)
      await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
      await expect(page.getByText(item.error)).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })
  }

  test('dùng mẫu chiến lược → form điền sẵn, vẫn sửa được', async ({ page }) => {
    await demoId(page, 'template-iceberg-quiet').click()
    await expect(demoId(page, 'template-iceberg-quiet')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('combobox', { name: /^Loại lệnh/ })).toHaveText('Iceberg')
    await expect(page.getByRole('button', { name: 'Mua', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const qty = page.getByRole('textbox', { name: 'Khối lượng', exact: true })
    await expect(qty).toHaveValue('20.000')
    await expect(page.getByRole('textbox', { name: 'KL mỗi phần' })).toHaveValue('2.000')
    await expect(page.getByRole('textbox', { name: 'Giá giới hạn' })).not.toHaveValue('')

    // Sửa khối lượng sau khi áp mẫu rồi đặt.
    await qty.fill('6.000')
    await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('6.000', { exact: false }).first()).toBeVisible()
    await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
    await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
  })
})
