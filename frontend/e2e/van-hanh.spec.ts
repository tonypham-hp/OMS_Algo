import { demoId, expect, loginAs, navigate, placeIceberg, runUntilSession, test } from './fixtures'

test.describe('Vận hành (OPS)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'OPS')
  })

  test('bơm lỗi mất ACK: lệnh con UNKNOWN rồi tự đối soát', async ({ page }) => {
    await runUntilSession(page, 'Khớp lệnh liên tục')
    // Iceberg giá trần: mỗi phần khớp ngay nên lệnh con kế tiếp được gửi sớm.
    const id = await placeIceberg(page, { qty: '20.000', slice: '1.000', price: '126.200' })

    await navigate(page, '/van-hanh')
    await page.getByRole('combobox', { name: /^Lệnh áp dụng/ }).click()
    await page.getByRole('option', { name: new RegExp(`^${id}`) }).click()
    const scenario = page.getByRole('row').filter({ hasText: 'TC-E2E-141' })
    await scenario.getByRole('button', { name: 'Bơm lỗi' }).click()
    await expect(page.getByText(`Đã bơm: lệnh con tiếp theo của ${id} sẽ timeout, Core đã tạo lệnh.`)).toBeVisible()

    await navigate(page, `/so-lenh/${id}`)
    const children = page.locator('[data-demo-id^="child-status-"]')
    // Lệnh con bị mất ACK chuyển sang "Chưa rõ"...
    const unknown = children.filter({ hasText: 'Chưa rõ' }).first()
    await expect(async () => {
      await page.clock.runFor(1_000)
      await expect(unknown).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 30_000 })
    const childId = (await unknown.getAttribute('data-demo-id'))!.replace('child-status-', '')

    // ...rồi đối soát: Core đã có lệnh nên giữ lệnh con, không còn "Chưa rõ".
    const status = demoId(page, `child-status-${childId}`)
    await expect(async () => {
      await page.clock.runFor(1_000)
      await expect(status).not.toHaveText('Chưa rõ', { timeout: 500 })
    }).toPass({ timeout: 30_000 })
    await expect(status).toHaveText(/Đã xác nhận|Khớp một phần|Đã khớp/)
    await expect(demoId(page, 'event-log')).toContainText(/đối soát/i)
  })

  test('kill switch: bật qua hai bước xác nhận rồi gỡ', async ({ page }) => {
    await navigate(page, '/van-hanh')
    await expect(page.getByText('Kill switch đang tắt.')).toBeVisible()
    await page.getByRole('button', { name: 'Kích hoạt kill switch' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Kích hoạt kill switch (1/2)' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click()
    const confirm = dialog.getByRole('button', { name: 'Xác nhận dừng' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox', { name: 'Gõ DUNG để xác nhận' }).fill('DUNG')
    await confirm.click()
    await expect(dialog).toHaveCount(0)
    const banner = page.getByRole('status').filter({ hasText: 'Kill switch đang bật' })
    await expect(banner).toContainText('Toàn hệ thống')

    await banner.getByRole('button', { name: 'Gỡ' }).click()
    await expect(page.getByText('Kill switch đang tắt.')).toBeVisible()
  })

  test('maker-checker ở Cấu hình: người tạo không tự duyệt, người thứ hai duyệt', async ({ page }) => {
    await navigate(page, '/cau-hinh')
    const row = page.locator('[data-parameter="MAX_CONSECUTIVE_REJECTS"]')
    await row.getByRole('button', { name: 'Đề xuất thay đổi' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox', { name: 'Giá trị mới' }).fill('4')
    await dialog.getByRole('textbox', { name: 'Lý do thay đổi' }).fill('Kiểm thử e2e maker-checker')
    await dialog.getByRole('button', { name: 'Gửi yêu cầu duyệt' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(row).toContainText('Bạn tạo yêu cầu này, đang chờ người khác duyệt.')
    await expect(row.getByRole('button', { name: 'Duyệt' })).toHaveCount(0)

    // Người thứ hai: vanhanh2.
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByRole('button', { name: 'vanhanh2' }).click()
    await page.getByRole('button', { name: 'Vào hệ thống với vai trò Vận hành' }).click()
    await expect(page).toHaveURL(/\/trung-tam$/)
    await navigate(page, '/cau-hinh')
    await expect(row).toContainText('Người tạo: vanhanh')
    await row.getByRole('button', { name: 'Duyệt' }).click()
    await expect(dialog.getByRole('heading', { name: /^Duyệt thay đổi/ })).toBeVisible()
    await dialog.getByRole('button', { name: 'Xác nhận duyệt' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(row).toContainText('Duyệt: vanhanh2')
    await expect(row).toContainText('4')
  })
})
