import { expect, loginAs, loginFromPage, prepare, e2eQuery, test, type Role } from './fixtures'

test.describe('Đăng nhập và phân quyền', () => {
  for (const role of ['CUSTOMER', 'DEALER', 'OPS'] as Role[]) {
    test(`đăng nhập vai trò ${role}`, async ({ page }) => {
      await loginAs(page, role)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('[data-demo-id="sidebar"]')).toBeVisible()
      const opsNav = page.locator('[data-demo-id="nav-van-hanh"]')
      if (role === 'OPS') await expect(opsNav).toBeVisible()
      else await expect(opsNav).toHaveCount(0)
    })
  }

  test('chưa đăng nhập bị chuyển về /login', async ({ page }) => {
    await prepare(page)
    await page.goto(`/so-lenh${e2eQuery()}`)
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    await loginFromPage(page, 'CUSTOMER')
  })

  test('CUSTOMER không vào được Vận hành (403)', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await page.goto('/van-hanh')
    await expect(page).toHaveURL(/\/403$/)
    await expect(page.getByText(/không có quyền/i).first()).toBeVisible()
    await page.goto('/cau-hinh')
    await expect(page).toHaveURL(/\/403$/)
  })
})
