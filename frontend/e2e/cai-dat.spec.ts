import { expect, loginAs, loginFromPage, navigate, test } from './fixtures'

const html = (page: import('@playwright/test').Page) => page.locator('html')

test.describe('Cài đặt giao diện (/cai-dat)', () => {
  test('mọi vai trò mở được từ menu tài khoản; mỗi tùy chọn đổi data-* trên <html> ngay', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await page.getByRole('button', { name: /^Tài khoản / }).click()
    await page.getByRole('menuitem', { name: 'Cài đặt' }).click()
    await expect(page).toHaveURL(/\/cai-dat$/)
    await expect(page.getByRole('heading', { name: 'Cài đặt giao diện' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Vị trí' })).toContainText('Cài đặt giao diện')

    // Mặc định: Tối, bảng màu VN, Thoáng, 100%, có nhấp nháy.
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(html(page)).toHaveAttribute('data-palette', 'default')

    await page.getByRole('radio', { name: 'Sáng' }).check()
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    await page.getByRole('group', { name: 'Tương phản cao' }).getByRole('radio', { name: 'Bật' }).check()
    await expect(html(page)).toHaveAttribute('data-theme', 'hc-light')
    await page.getByRole('radio', { name: 'Mù màu xanh–cam' }).check()
    await expect(html(page)).toHaveAttribute('data-palette', 'cvd')
    await page.getByRole('radio', { name: 'Gọn' }).check()
    await expect(html(page)).toHaveAttribute('data-density', 'compact')
    await page.getByRole('radio', { name: '110%' }).check()
    await expect(html(page)).toHaveAttribute('data-font-scale', '110')
    await page.getByLabel('Nhấp nháy giá khi giá đổi').click()
    await expect(html(page)).toHaveAttribute('data-flash', 'off')

    // Tải lại: script khởi động áp đúng trước khi app chạy, không mất lựa chọn.
    await page.reload()
    await expect(html(page)).toHaveAttribute('data-theme', 'hc-light')
    await expect(html(page)).toHaveAttribute('data-palette', 'cvd')
    await expect(html(page)).toHaveAttribute('data-density', 'compact')

    await page.getByRole('button', { name: 'Khôi phục mặc định' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(html(page)).toHaveAttribute('data-flash', 'on')
  })

  test('mỗi lựa chọn giao diện có xem trước đủ 5 màu giá, xem trước theo đúng theme của lựa chọn', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await navigate(page, '/cai-dat')
    const lightOption = page.getByTestId('mode-light')
    const preview = lightOption.getByTestId('appearance-preview')
    await expect(preview).toHaveAttribute('data-theme', 'light')
    for (const label of ['Trần', 'Tăng', 'TC', 'Giảm', 'Sàn']) await expect(preview).toContainText(label)
    await expect(preview.getByRole('img', { name: 'Giá trần' })).toBeVisible()
    await expect(preview.getByRole('img', { name: 'Giá sàn' })).toBeVisible()
    await expect(page.getByTestId('contrast-true').getByTestId('appearance-preview')).toHaveAttribute('data-theme', 'hc-dark')
    await expect(page.getByTestId('palette-cvd').getByTestId('appearance-preview')).toHaveAttribute('data-palette', 'cvd')
  })

  test('lưu riêng theo tài khoản demo', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await navigate(page, '/cai-dat')
    await page.getByRole('radio', { name: 'Sáng' }).check()
    await expect(html(page)).toHaveAttribute('data-theme', 'light')

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click()
    await loginFromPage(page, 'OPS')
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click()
    await loginFromPage(page, 'DEALER')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
  })

  test('ẩn số khi trình chiếu: bps và số tài khoản bị che, tắt thì hiện lại', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await navigate(page, '/cai-dat')
    await page.getByLabel('Ẩn số tiền và bps khi trình chiếu').click()
    await expect(page.getByTestId('settings-page').getByText('058C•••456').first()).toBeVisible()

    await navigate(page, '/so-lenh')
    const firstRow = page.locator('[data-demo-id^="order-row-"]').first()
    await expect(firstRow).toBeVisible()
    await expect(firstRow).toContainText(/058C•••\d{3}/)
    await expect(firstRow).not.toContainText(/058C\d{6}/)

    await navigate(page, '/cai-dat')
    await page.getByLabel('Ẩn số tiền và bps khi trình chiếu').click()
    await navigate(page, '/so-lenh')
    await expect(page.locator('[data-demo-id^="order-row-"]').first()).toContainText(/058C\d{6}/)
  })
})
