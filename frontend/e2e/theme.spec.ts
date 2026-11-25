import { e2eQuery, expect, loginAs, navigate, prepare, seedAppearance, test } from './fixtures'

/** Màu token theo theme (rgb như getComputedStyle trả về). Giá trị gốc ở src/config/theme.ts. */
const PRICE_UP = { dark: 'rgb(14, 203, 129)', light: 'rgb(21, 128, 61)' }
const BG = { dark: 'rgb(11, 18, 32)', light: 'rgb(248, 250, 252)' }

test.describe('Đổi theme', () => {
  test('tải lại ở theme sáng: khung hình đầu đã là sáng (script khởi động chạy trước khi app vẽ)', async ({ page }) => {
    await seedAppearance(page, { mode: 'light' }, 'dealer')
    // Ghi lại theme lúc <body> vừa được tạo và ở khung hình đầu tiên (requestAnimationFrame chạy trước lần vẽ đầu).
    await page.addInitScript(() => {
      const record = (key: string) => {
        const root = document.documentElement
        ;(window as unknown as Record<string, unknown>)[key] = {
          theme: root.getAttribute('data-theme'),
          colorScheme: root.style.colorScheme,
        }
      }
      new MutationObserver((_, observer) => {
        if (document.body) {
          record('__atBody')
          observer.disconnect()
        }
      }).observe(document, { childList: true, subtree: true })
      requestAnimationFrame(() => record('__firstFrame'))
    })
    await prepare(page)
    await page.goto(`/login${e2eQuery()}`)
    const atBody = await page.evaluate(() => (window as unknown as Record<string, unknown>).__atBody)
    const firstFrame = await page.evaluate(() => (window as unknown as Record<string, unknown>).__firstFrame)
    expect(atBody).toEqual({ theme: 'light', colorScheme: 'light' })
    expect(firstFrame).toEqual({ theme: 'light', colorScheme: 'light' })
    await expect(page.locator('body')).toHaveCSS('background-color', BG.light)

    await page.reload()
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__firstFrame)).toEqual({ theme: 'light', colorScheme: 'light' })
  })

  test('nút trên thanh trên đổi Sáng ↔ Tối, nhớ qua tải lại', async ({ page }) => {
    await loginAs(page, 'DEALER')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', BG.dark)

    await page.getByRole('button', { name: 'Đổi sang giao diện sáng' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('body')).toHaveCSS('background-color', BG.light)
    await expect(page.getByRole('button', { name: 'Đổi sang giao diện tối' })).toBeVisible()

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Đổi sang giao diện tối' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  test('Ctrl+K "Đổi giao diện sáng" rồi "Đổi giao diện tối"', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    // Chờ màn vẽ xong (phím tắt gắn sau khi khung ứng dụng sẵn sàng).
    await expect(page.locator('[data-demo-id="kpi-running"]')).toBeVisible()
    const html = page.locator('html')
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('combobox', { name: 'Tìm nhanh' })).toBeFocused()
    await page.getByRole('combobox', { name: 'Tìm nhanh' }).fill('giao diện sáng')
    await expect(page.getByRole('option', { name: /Đổi giao diện sáng/ })).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(html).toHaveAttribute('data-theme', 'light')

    await page.keyboard.press('Control+k')
    await expect(page.getByRole('combobox', { name: 'Tìm nhanh' })).toBeFocused()
    await page.getByRole('combobox', { name: 'Tìm nhanh' }).fill('giao diện tối')
    await page.getByRole('option', { name: /Đổi giao diện tối/ }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })

  test('biểu đồ Recharts đổi màu theo theme ngay, không tải lại', async ({ page }) => {
    await loginAs(page, 'OPS')
    await navigate(page, '/bao-cao/hieu-qua')
    const favorableBar = page.locator('.recharts-bar-rectangle path[fill="var(--price-up)"]').first()
    await expect(favorableBar).toBeVisible()
    await expect(favorableBar).toHaveCSS('fill', PRICE_UP.dark)
    const navigations: string[] = []
    page.on('framenavigated', (frame) => navigations.push(frame.url()))

    await page.getByRole('button', { name: 'Đổi sang giao diện sáng' }).click()
    await expect(favorableBar).toHaveCSS('fill', PRICE_UP.light)
    expect(navigations, 'không tải lại trang').toEqual([])

    // Chữ trục cũng đổi theo (var(--text-muted)).
    await expect(page.locator('.recharts-cartesian-axis-tick-value').first()).toHaveCSS('fill', 'rgb(71, 85, 105)')
  })

  test('hệ điều hành ưu tiên tương phản cao / tối (Theo hệ thống) được áp tự động', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', contrast: 'more' })
    await seedAppearance(page, { mode: 'system' }, 'dealer')
    await loginAs(page, 'DEALER')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'hc-light')
    await page.emulateMedia({ colorScheme: 'dark', contrast: 'no-preference' })
    await expect(html).toHaveAttribute('data-theme', 'dark')
  })
})
