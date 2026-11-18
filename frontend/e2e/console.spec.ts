import { expect, loginAs, test, type Role } from './fixtures'

/** Mọi route của app, kèm vai trò được vào. Route bị cấm phải về /403 sạch sẽ, không lỗi. */
const ROUTES: ReadonlyArray<{ path: string; title: RegExp; roles: Role[] }> = [
  { path: '/trung-tam', title: /Trung tâm lệnh/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/dat-lenh', title: /Đặt lệnh nâng cao/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/mau-chien-luoc', title: /Mẫu chiến lược/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/so-lenh', title: /Sổ lệnh/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/bao-cao/hieu-qua', title: /Hiệu quả thực hiện/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/bao-cao/lich-su', title: /Lịch sử và đối soát/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/bao-cao/lich-su?tab=nhat-ky', title: /Lịch sử và đối soát/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  // Khách hàng không có tab Đối soát: ở lại màn, về tab Lịch sử lệnh (không phải 403).
  { path: '/bao-cao/lich-su?tab=doi-soat', title: /Lịch sử và đối soát/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/thuat-ngu', title: /Thuật ngữ/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
  { path: '/van-hanh', title: /Màn vận hành/, roles: ['OPS'] },
  { path: '/cau-hinh', title: /Cấu hình chiến lược/, roles: ['OPS'] },
  { path: '/khong-ton-tai', title: /404|Không tìm thấy/, roles: ['CUSTOMER', 'DEALER', 'OPS'] },
]

for (const role of ['CUSTOMER', 'DEALER', 'OPS'] as Role[]) {
  test(`mọi route với vai trò ${role}: không lỗi console, không request lỗi, không tràn ngang`, async ({ page, problems }) => {
    test.setTimeout(120_000)
    await loginAs(page, role)

    // Thêm một trang chi tiết lệnh (lệnh đầu tiên vai trò này thấy).
    await page.goto('/so-lenh')
    const firstRow = page.locator('[data-demo-id^="order-row-"]').first()
    await expect(firstRow).toBeVisible()
    const detailPath = `/so-lenh/${await firstRow.getAttribute('data-order-id')}`
    const routes = [...ROUTES, { path: detailPath, title: /Chi tiết lệnh/, roles: [role] }]

    for (const route of routes) {
      await page.goto(route.path)
      if (route.roles.includes(role)) {
        await expect(page, route.path).toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
        await expect(page.getByRole('heading', { level: 1 }), route.path).toHaveText(route.title)
      } else {
        await expect(page, route.path).toHaveURL(/\/403$/)
        await expect(page.getByRole('heading', { level: 1 })).toContainText('403')
      }
      // Chờ một nhịp làm mới dữ liệu để bắt lỗi xảy ra sau lần vẽ đầu.
      await page.clock.runFor(2_000)
      await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)

      // Nút, liên kết đang hiện đều có tên truy cập (nút chỉ có icon phải có aria-label).
      const unnamed = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('button, a[href], [role="button"], [role="link"]'))
          .filter((element) => element.offsetParent !== null || element.getClientRects().length > 0)
          .filter((element) => {
            const labelledBy = element.getAttribute('aria-labelledby')
            const name =
              element.getAttribute('aria-label') ??
              (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ??
              element.textContent ??
              element.getAttribute('title') ??
              ''
            return name.trim() === '' && !element.querySelector('img[alt]:not([alt=""])')
          })
          .map((element) => element.outerHTML.slice(0, 120)),
      )
      expect(unnamed, `${route.path}: nút/link thiếu tên`).toEqual([])

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${route.path} tràn ngang ${overflow}px`).toBeLessThanOrEqual(0)
      expect(problems.console, `${route.path}: lỗi console`).toEqual([])
      expect(problems.requests, `${route.path}: request lỗi`).toEqual([])
    }
  })
}
