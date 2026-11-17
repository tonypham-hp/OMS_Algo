import { demoId, expect, loginAs, navigate, test } from './fixtures'

/** Mã lệnh mẫu đầu tiên có trạng thái cho trước, lấy từ Sổ lệnh. */
async function firstOrderWith(page: import('@playwright/test').Page, status: string) {
  await navigate(page, '/so-lenh')
  const row = page.locator('[data-demo-id^="order-row-"]').filter({ hasText: status }).first()
  await expect(row).toBeVisible()
  return (await row.getAttribute('data-order-id'))!
}

test.describe('Chi tiết lệnh', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'OPS')
  })

  test('lệnh đã khớp: timeline lệnh con, bảng khớp, thẻ Hiệu quả', async ({ page }) => {
    const id = await firstOrderWith(page, 'Hoàn tất')
    await page.getByRole('link', { name: id, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/so-lenh/${id}$`))

    // Timeline lệnh con: có ít nhất một lệnh con, mỗi lệnh con có nhãn trạng thái bằng chữ.
    await expect(page.getByRole('heading', { name: 'Lệnh con', level: 2 })).toBeVisible()
    const children = page.locator('[data-demo-id^="child-status-"]')
    await expect(children.first()).toBeVisible()
    await expect(children.first()).toHaveText(/\S+/)

    // Bảng khớp: có dòng, giá và KL theo định dạng Việt Nam.
    const executions = demoId(page, 'executions')
    await expect(executions.getByRole('row').nth(1)).toBeVisible()
    await expect(executions.getByRole('row').nth(1)).toContainText(/\d{2}:\d{2}:\d{2}/)
    await expect(executions.getByRole('row').nth(1)).toContainText(/\d{1,3}(\.\d{3})+/)

    // Thẻ Hiệu quả.
    const quality = demoId(page, 'exec-quality')
    await expect(quality.getByRole('heading', { name: 'Hiệu quả' })).toBeVisible()
    await expect(quality).toContainText(/VWAP|Slippage|arrival/i)
  })

  test('lệnh PAUSED_SYSTEM: ExplainCard giải thích lý do và gợi ý thao tác', async ({ page }) => {
    const id = await firstOrderWith(page, 'Hệ thống tạm dừng')
    await navigate(page, `/so-lenh/${id}`)
    const card = demoId(page, 'explain-card')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(/\S+/)
    await expect(demoId(page, 'explain-text')).toHaveText(/.{20,}/)
    await expect(card).toHaveAttribute('data-explain-code', /.+/)
    await expect(demoId(page, 'order-status')).toContainText('Hệ thống tạm dừng')
  })
})
