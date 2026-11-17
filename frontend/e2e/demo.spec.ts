import type { Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, test } from './fixtures'

const SCENARIO_COUNT = 6

/** Danh sách mã lệnh đang thấy trong Sổ lệnh (để so dữ liệu trước và sau Demo). */
async function orderIds(page: Page) {
  await navigate(page, '/so-lenh')
  const rows = page.locator('[data-demo-id^="order-row-"]')
  await expect(rows.first()).toBeVisible()
  // Mã lệnh không đổi khi giá chạy; sắp xếp để không phụ thuộc thứ tự hiển thị.
  return (await rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-order-id')))).sort()
}

test.describe('Chế độ Demo', () => {
  test('chạy cả 6 kịch bản ở tốc độ cao nhất, mọi điều kiện ĐẠT; thoát Demo khôi phục dữ liệu', async ({ page }) => {
    test.setTimeout(240_000)
    await loginAs(page, 'OPS')
    const before = await orderIds(page)

    for (let number = 1; number <= SCENARIO_COUNT; number += 1) {
      await page.getByRole('button', { name: 'Demo', exact: true }).click()
      const picker = page.getByRole('dialog', { name: 'Chọn kịch bản Demo' })
      await picker.getByRole('button', { name: new RegExp(`^Scenario ${number} ·`) }).click()
      await expect(demoId(page, 'demo-badge')).toHaveText(`ĐANG CHẠY DEMO · Scenario ${number}`)

      const controller = demoId(page, 'demo-controller')
      await controller.getByRole('group', { name: 'Tốc độ Demo' }).getByRole('button', { name: 'x4' }).click()
      // Kịch bản tự phát khi bắt đầu; nếu đang dừng thì bấm Phát.
      const play = controller.getByRole('button', { name: 'Phát' })
      if (await play.isVisible()) await play.click()

      const result = demoId(page, 'demo-result')
      await expect(async () => {
        await page.clock.runFor(2_000)
        await expect(result).toBeVisible({ timeout: 200 })
      }).toPass({ timeout: 120_000 })
      await expect(result.getByRole('heading', { name: new RegExp(`^Kết quả · Scenario ${number}:`) })).toBeVisible()
      await expect(result).toContainText('Mọi điều kiện kiểm tra đều ĐẠT.')
      await result.getByRole('button', { name: 'Thoát Demo' }).click()
      await expect(demoId(page, 'demo-badge')).toHaveCount(0)
    }

    // Sau khi thoát, Sổ lệnh tải lại dữ liệu của người dùng (có thể mất một nhịp làm mới).
    await expect.poll(() => orderIds(page), { timeout: 15_000 }).toEqual(before)
  })

  test('thoát Demo giữa chừng bằng nút trên thanh trên cùng cũng khôi phục dữ liệu', async ({ page }) => {
    await loginAs(page, 'OPS')
    const before = await orderIds(page)
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Scenario 1 ·/ }).click()
    await demoId(page, 'demo-controller').getByRole('button', { name: 'Bước tiếp' }).click()
    await page.getByRole('button', { name: 'Thoát Demo' }).click()
    await expect(demoId(page, 'demo-badge')).toHaveCount(0)
    // Sau khi thoát, Sổ lệnh tải lại dữ liệu của người dùng (có thể mất một nhịp làm mới).
    await expect.poll(() => orderIds(page), { timeout: 15_000 }).toEqual(before)
  })
})
