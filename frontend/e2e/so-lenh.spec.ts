import type { Locator, Page } from '@playwright/test'
import { expect, loginAs, navigate, placeIceberg, runUntilSession, test } from './fixtures'

const RUNNING = /Đang hoạt động|Khớp một phần/

/** Dòng đầu tiên của Sổ lệnh có trạng thái khớp mẫu; trả về id để bám đúng dòng dù bảng sắp xếp lại. */
async function pickRow(page: Page, status: RegExp): Promise<{ id: string; row: Locator }> {
  const row = page.locator('[data-demo-id^="order-row-"]').filter({ hasText: status }).first()
  await expect(row).toBeVisible()
  const id = (await row.getAttribute('data-order-id'))!
  return { id, row: page.locator(`[data-demo-id="order-row-${id}"]`) }
}

async function openActions(page: Page, id: string) {
  const menu = page.getByRole('menu')
  // Menu của lần trước còn đang chạy hiệu ứng đóng: chờ nó biến mất rồi mới mở menu mới.
  await expect(menu).toHaveCount(0)
  await page.getByRole('button', { name: `Hành động cho lệnh ${id}` }).click()
  await expect(menu).toBeVisible()
  return menu
}

test.describe('Sổ lệnh', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/so-lenh')
  })

  test('trong ATO: Sửa, Hủy bị khóa kèm lý do; Tạm dừng vẫn được', async ({ page }) => {
    await expect(page.locator('[data-demo-id="session-status"]')).toContainText('Phiên ATO')
    const { id } = await pickRow(page, RUNNING)
    const menu = await openActions(page, id)
    await expect(menu.getByRole('menuitem', { name: /^Sửa/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByRole('menuitem', { name: /^Hủy/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByText('Không được sửa, hủy lệnh trong Phiên ATO').first()).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Tạm dừng' })).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('phiên liên tục: Tạm dừng → Tiếp tục → Hủy theo bảng trạng thái', async ({ page }) => {
    await runUntilSession(page, 'Khớp lệnh liên tục')
    const id = await placeIceberg(page)
    await navigate(page, '/so-lenh')
    const row = page.locator(`[data-demo-id="order-row-${id}"]`)
    await expect(row).toContainText(RUNNING)

    // Đang chạy: được Sửa, Hủy, Tạm dừng.
    let menu = await openActions(page, id)
    await expect(menu.getByRole('menuitem', { name: 'Sửa' })).not.toHaveAttribute('aria-disabled', 'true')
    await menu.getByRole('menuitem', { name: 'Tạm dừng' }).click()
    await expect(row).toContainText('Tạm dừng')

    // Tạm dừng bởi người dùng: nút đổi thành Tiếp tục.
    menu = await openActions(page, id)
    await expect(menu.getByRole('menuitem', { name: 'Tạm dừng' })).toHaveCount(0)
    await menu.getByRole('menuitem', { name: 'Tiếp tục' }).click()
    await expect(row).toContainText(RUNNING)

    // Hủy có hộp xác nhận.
    menu = await openActions(page, id)
    await menu.getByRole('menuitem', { name: 'Hủy' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: /^Hủy lệnh/ })).toBeVisible()
    await dialog.getByRole('button', { name: 'Xác nhận hủy' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(row).toContainText(/Đã hủy|Đang hủy/)
    await expect(row).toContainText('Đã hủy')

    // Lệnh đã hủy: không còn hành động nào.
    await expect(page.getByRole('button', { name: `Hành động cho lệnh ${id}` })).toBeDisabled()
  })

  test('trong ATC: Sửa, Hủy bị khóa', async ({ page }) => {
    test.slow()
    // Lệnh mua ở giá sàn đứng chờ tới ATC mà không khớp.
    const id = await placeIceberg(page)
    await navigate(page, '/so-lenh')
    await runUntilSession(page, 'Phiên ATC')
    const menu = await openActions(page, id)
    await expect(menu.getByRole('menuitem', { name: /^Sửa/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByRole('menuitem', { name: /^Hủy/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(menu.getByText('Không được sửa, hủy lệnh trong Phiên ATC').first()).toBeVisible()
  })
})
