import { demoId, expect, loginAs, navigate, test } from './fixtures'

const EXPANDED_WIDTH = 232
const COLLAPSED_WIDTH = 64

test.describe('Bố cục 1366/1440', () => {
  test('thanh bên thu gọn vẫn dùng được: còn tên mục, điều hướng được, nhớ qua tải lại', async ({ page }) => {
    await loginAs(page, 'OPS')
    const sidebar = demoId(page, 'sidebar')
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(EXPANDED_WIDTH)

    await page.getByRole('button', { name: 'Thu gọn thanh bên' }).click()
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(COLLAPSED_WIDTH)
    // Mục chỉ còn icon nhưng vẫn có tên cho trình đọc màn hình, vẫn bấm được.
    await page.getByRole('navigation', { name: 'Menu chính' }).getByRole('link', { name: 'Sổ lệnh' }).click()
    await expect(page).toHaveURL(/\/so-lenh$/)

    await page.reload()
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(COLLAPSED_WIDTH)
    await page.getByRole('button', { name: 'Mở rộng thanh bên' }).click()
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(EXPANDED_WIDTH)
  })

  test('bảng rộng cuộn trong khung riêng, trang không tràn ngang', async ({ page }) => {
    await loginAs(page, 'OPS')
    for (const path of ['/so-lenh', '/bao-cao/hieu-qua', '/bao-cao/lich-su', '/bao-cao/lich-su?tab=nhat-ky', '/bao-cao/lich-su?tab=doi-soat', '/cau-hinh', '/cau-hinh/luat']) {
      await navigate(page, path)
      // Chờ màn mới tải xong: ngay sau điều hướng, bảng của màn trước có thể còn trong DOM rồi bị gỡ.
      await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
      const table = page.getByRole('table').first()
      await expect(table).toBeVisible()
      await expect(async () => {
        const container = await table.evaluate((element) => {
          const box = element.parentElement!
          return { overflowX: getComputedStyle(box).overflowX, fits: box.getBoundingClientRect().right <= window.innerWidth }
        })
        expect(container.overflowX, path).toBe('auto')
        expect(container.fits, path).toBe(true)
      }).toPass({ timeout: 5_000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0)
    }
  })

  test('khung Demo nổi không che nút chính khi cuộn tới', async ({ page }) => {
    await loginAs(page, 'OPS')
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Scenario 1 ·/ }).click()
    const controller = demoId(page, 'demo-controller')
    await expect(controller).toBeVisible()
    await controller.getByRole('button', { name: /Tạm dừng|Phát/ }).first().click()
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('main').locator('a, button, [tabindex="0"]').first()).toBeVisible()

    // Cuộn hết trang: phần chừa ở đáy phải đủ cho khung Demo, nút cuối trang không bị che.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const panel = (await controller.boundingBox())!
    // Phần tử bấm được thấp nhất của trang Demo đang mở: khi cuộn hết trang nó phải nằm ngoài vùng khung Demo.
    const boxes = []
    for (const button of await page.getByRole('main').locator('a, button, [tabindex="0"]').all()) {
      if (await button.isVisible()) boxes.push((await button.boundingBox())!)
    }
    expect(boxes.length).toBeGreaterThan(0)
    const box = boxes.reduce((lowest, item) => (item.y > lowest.y ? item : lowest))
    const overlaps = box.y + box.height > panel.y && box.y < panel.y + panel.height && box.x + box.width > panel.x && box.x < panel.x + panel.width
    expect(overlaps, 'khung Demo che nút cuối trang').toBe(false)
    expect(panel.height, 'khung Demo không cao hơn phần chừa ở đáy trang').toBeLessThanOrEqual(240)
    await page.getByRole('button', { name: 'Thoát Demo' }).click()
  })
})

test.describe('Màn hẹp', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('≤1280px: thanh bên tự thu gọn, mở tạm được', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    const sidebar = demoId(page, 'sidebar')
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(COLLAPSED_WIDTH)
    await page.getByRole('button', { name: 'Mở rộng thanh bên' }).click()
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(EXPANDED_WIDTH)
    // Mở tạm ở màn hẹp không ghi đè lựa chọn đã lưu cho màn rộng.
    expect(await page.evaluate(() => window.localStorage.getItem('oms-sidebar-collapsed'))).toBeNull()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('Thanh trên', () => {
  test('tên màn ở breadcrumb không bị cắt trên mọi route', async ({ page }) => {
    await loginAs(page, 'OPS')
    const paths = ['/trung-tam', '/dat-lenh', '/mau-chien-luoc', '/so-lenh', '/bao-cao/hieu-qua', '/bao-cao/lich-su', '/thuat-ngu', '/cai-dat', '/ban-lam-viec', '/van-hanh', '/cau-hinh', '/cau-hinh/luat', '/so-lenh?tab=thoa-thuan']
    await navigate(page, '/so-lenh')
    const firstRow = page.locator('[data-demo-id^="order-row-"]').first()
    await expect(firstRow).toBeVisible()
    paths.push(`/so-lenh/${await firstRow.getAttribute('data-order-id')}`)
    for (const path of paths) {
      await navigate(page, path)
      const last = page.getByRole('navigation', { name: 'Vị trí' }).getByRole('listitem').last()
      await expect(last).toBeVisible()
      const clipped = await last.evaluate((element) => element.scrollWidth - element.clientWidth)
      expect(clipped, `${path}: "${await last.innerText()}" bị cắt ${clipped}px`).toBeLessThanOrEqual(0)
    }
  })
})
