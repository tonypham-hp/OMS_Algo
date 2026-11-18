import { e2eQuery, expect, loginAs, loginFromPage, navigate, prepare, test, type Role } from './fixtures'

/** Màn có tải dữ liệu, nhóm API làm lỗi, và câu báo lỗi mong đợi. */
const SCREENS: ReadonlyArray<{ path: string; fail: string[]; message: RegExp; role: Role }> = [
  { path: '/trung-tam', fail: ['dashboard'], message: /Không tải được dữ liệu/, role: 'CUSTOMER' },
  { path: '/so-lenh', fail: ['orders'], message: /Không tải được sổ lệnh/, role: 'CUSTOMER' },
  { path: '/bao-cao/hieu-qua', fail: ['reports'], message: /Không tải được báo cáo/, role: 'CUSTOMER' },
  { path: '/bao-cao/lich-su', fail: ['history'], message: /Không tải được lịch sử/, role: 'CUSTOMER' },
  { path: '/bao-cao/lich-su?tab=doi-soat', fail: ['reconciliation'], message: /Không tải được đối soát/, role: 'DEALER' },
  { path: '/van-hanh', fail: ['ops'], message: /Không tải được dữ liệu vận hành/, role: 'OPS' },
  { path: '/cau-hinh', fail: ['config'], message: /Không tải được (tham số|lịch sử)/, role: 'OPS' },
]

test.describe('Trạng thái lỗi (ErrorState)', () => {
  test.use({ allowHttpErrors: true })

  for (const screen of SCREENS) {
    test(`${screen.path}: lỗi API hiện câu báo tiếng Việt và nút Thử lại`, async ({ page }) => {
      await loginAs(page, screen.role, { fail: screen.fail })
      await navigate(page, screen.path)
      const alert = page.getByRole('alert').filter({ hasText: screen.message }).first()
      await expect(alert).toBeVisible({ timeout: 15_000 })
      await expect(alert.getByRole('button', { name: 'Thử lại' })).toBeVisible()
    })
  }
})

test.describe('Trạng thái đang tải (LoadingState)', () => {
  test('API chậm: màn hiện "Đang tải..." rồi mới hiện dữ liệu', async ({ page }) => {
    await prepare(page)
    await page.goto(`/login${e2eQuery({ delay: 1_500 })}`)
    await expect(page.getByRole('status').filter({ hasText: 'Đang tải tài khoản demo...' })).toBeVisible()
    await loginFromPage(page, 'CUSTOMER')
    await navigate(page, '/so-lenh')
    await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ }).first()).toBeVisible()
    await expect(page.locator('[data-demo-id^="order-row-"]').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Trạng thái trống (EmptyState)', () => {
  test('Sổ lệnh lọc không ra kết quả: có câu hướng dẫn và nút Bỏ lọc', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/so-lenh')
    await page.getByRole('combobox', { name: 'Trạng thái' }).click()
    await page.getByRole('option', { name: 'Nháp', exact: true }).click()
    await expect(page.getByText('Không có lệnh nào khớp bộ lọc')).toBeVisible()
    await expect(page.getByText(/Thử bỏ bớt điều kiện lọc/)).toBeVisible()
    await page.getByRole('button', { name: 'Bỏ lọc' }).click()
    await expect(page.locator('[data-demo-id^="order-row-"]').first()).toBeVisible()
  })

  test('Thuật ngữ không khớp: có nút Xóa từ khóa', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await navigate(page, '/thuat-ngu')
    await page.getByRole('searchbox', { name: 'Lọc thuật ngữ' }).fill('zzzzzz')
    await expect(page.getByText('Không có thuật ngữ nào khớp')).toBeVisible()
    await page.getByRole('button', { name: 'Xóa từ khóa' }).click()
    await expect(page.getByRole('searchbox', { name: 'Lọc thuật ngữ' })).toHaveValue('')
  })
})
