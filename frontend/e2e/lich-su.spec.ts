import { readFile } from 'node:fs/promises'
import { demoId, expect, loginAs, navigate, placeIceberg, runUntilSession, test, type Role } from './fixtures'

const PATH = '/bao-cao/lich-su'

const tabList = (page: import('@playwright/test').Page) => page.getByRole('tablist')

test.describe('Lịch sử và đối soát', () => {
  for (const [role, tabs] of [
    ['CUSTOMER', ['Lịch sử lệnh', 'Nhật ký kiểm toán']],
    ['DEALER', ['Lịch sử lệnh', 'Nhật ký kiểm toán', 'Đối soát']],
    ['OPS', ['Lịch sử lệnh', 'Nhật ký kiểm toán', 'Đối soát']],
  ] as Array<[Role, string[]]>) {
    test(`${role}: thấy ${tabs.length} tab, mỗi tab có dữ liệu, tab nhớ trên URL`, async ({ page }) => {
      await loginAs(page, role)
      // Mở từ thanh bên: mục không còn "Sắp có".
      await page.getByRole('link', { name: 'Lịch sử và đối soát' }).click()
      await expect(page).toHaveURL(new RegExp(`${PATH}$`))
      await expect(page.getByRole('heading', { level: 1, name: 'Lịch sử và đối soát' })).toBeVisible()
      await expect(tabList(page).getByRole('tab')).toHaveText(tabs)

      await expect(demoId(page, 'history-table').locator('tbody tr').first()).toBeVisible()
      await expect(demoId(page, 'history-totals')).toContainText(/Tổng theo bộ lọc: \d+ lệnh/)

      await tabList(page).getByRole('tab', { name: 'Nhật ký kiểm toán' }).click()
      await expect(page).toHaveURL(/\?tab=nhat-ky$/)
      await expect(demoId(page, 'audit-table').locator('tbody tr').first()).toBeVisible()
      await expect(page.getByRole('button', { name: /Sửa|Xóa/ })).toHaveCount(0)

      if (tabs.includes('Đối soát')) {
        await tabList(page).getByRole('tab', { name: 'Đối soát' }).click()
        await expect(page).toHaveURL(/\?tab=doi-soat$/)
        await expect(demoId(page, 'recon-table').locator('tbody tr').first()).toBeVisible()
        await expect(demoId(page, 'recon-kpi-open')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Đánh dấu đã xử lý' })).toHaveCount(role === 'OPS' ? 4 : 0)
        // Tải lại trang vẫn đứng ở tab Đối soát.
        await page.reload()
        await expect(tabList(page).getByRole('tab', { name: 'Đối soát' })).toHaveAttribute('aria-selected', 'true')
      } else {
        // Khách hàng gõ thẳng ?tab=doi-soat: về Lịch sử lệnh, không lộ tab Đối soát.
        await navigate(page, `${PATH}?tab=doi-soat`)
        await expect(tabList(page).getByRole('tab', { name: 'Lịch sử lệnh' })).toHaveAttribute('aria-selected', 'true')
        await expect(page.getByRole('tab', { name: 'Đối soát' })).toHaveCount(0)
      }
    })
  }

  test('khách hàng thấy "Người dùng khác" thay cho user_id của người khác', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await navigate(page, `${PATH}?tab=nhat-ky`)
    await page.getByRole('combobox', { name: 'Người thực hiện' }).click()
    await expect(page.getByRole('option', { name: 'Người dùng khác' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'dealer' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('searchbox', { name: 'Tìm (không dấu)' }).fill('huy')
    await expect(demoId(page, 'audit-table')).toContainText('Người dùng khác')
  })

  test('xuất CSV lịch sử: có BOM và đúng số dòng của bộ lọc', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await navigate(page, PATH)
    const rows = demoId(page, 'history-table').locator('tbody tr')
    await expect(rows.first()).toBeVisible()
    const count = await rows.count()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Xuất CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^lich-su-lenh-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/)
    const content = await readFile((await download.path())!, 'utf8')
    expect(content.charCodeAt(0)).toBe(0xfeff)
    expect(content.trimEnd().split('\r\n')).toHaveLength(count + 1)
  })

  test('OPS: bơm lỗi mất ACK → UNKNOWN_OPEN → Đối soát ngay → UNKNOWN_RESOLVED "Core có lệnh"', async ({ page }) => {
    test.slow()
    await loginAs(page, 'OPS')
    // Nạp trước màn đối soát (tải chunk) khi đồng hồ còn chạy.
    await navigate(page, `${PATH}?tab=doi-soat`)
    await expect(demoId(page, 'recon-table')).toBeVisible()

    await runUntilSession(page, 'Khớp lệnh liên tục')
    // Iceberg giá trần: mỗi phần khớp ngay nên lệnh con kế tiếp được gửi sớm và nhận lỗi đã bơm.
    const id = await placeIceberg(page, { qty: '20.000', slice: '1.000', price: '126.200' })
    await navigate(page, '/van-hanh')
    await page.getByRole('combobox', { name: /^Lệnh áp dụng/ }).click()
    await page.getByRole('option', { name: new RegExp(`^${id}`) }).click()
    await page.getByRole('row').filter({ hasText: 'TC-E2E-141' }).getByRole('button', { name: 'Bơm lỗi' }).click()
    await expect(page.getByText(`Đã bơm: lệnh con tiếp theo của ${id} sẽ timeout, Core đã tạo lệnh.`)).toBeVisible()

    await page.getByRole('link', { name: 'Lịch sử và đối soát' }).click()
    await tabList(page).getByRole('tab', { name: 'Đối soát' }).click()
    const open = demoId(page, 'recon-row-UNKNOWN_OPEN').filter({ hasText: id })
    await expect(async () => {
      await page.clock.runFor(1_000)
      await expect(open).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 60_000 })
    // Dừng đồng hồ để engine không tự đối soát trước khi bấm nút.
    await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 50))
    await expect(open).toContainText('Mở')
    await expect(demoId(page, 'recon-kpi-open')).toHaveClass(/border-red/)

    await page.getByRole('button', { name: 'Đối soát ngay' }).click()
    // Đồng hồ đang dừng: nhích từng 20 ms để react-query phát cập nhật (setTimeout 0), chưa tới nhịp giả lập kế tiếp.
    await expect(async () => {
      await page.clock.runFor(20)
      await expect(demoId(page, 'recon-last-run')).toContainText('Lần chạy gần nhất', { timeout: 200 })
    }).toPass({ timeout: 10_000 })
    await expect(open).toHaveCount(0)
    const resolved = demoId(page, 'recon-row-UNKNOWN_RESOLVED').filter({ hasText: id })
    await expect(resolved).toContainText('Core có lệnh')
    await expect(resolved).toContainText('Đã xử lý')
  })

  test('OPS: Đánh dấu đã xử lý không lưu được khi thiếu ghi chú; có ghi chú thì Chờ duyệt', async ({ page }) => {
    await loginAs(page, 'OPS')
    await navigate(page, `${PATH}?tab=doi-soat`)
    const row = demoId(page, 'recon-row-QTY_MISMATCH').first()
    await row.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Đánh dấu đã xử lý' })).toBeVisible()
    const save = dialog.getByRole('button', { name: 'Lưu, chờ duyệt' })
    await expect(save).toBeDisabled()
    const note = dialog.getByRole('textbox', { name: /Ghi chú xử lý/ })
    await note.fill('   ')
    await note.blur()
    await expect(save).toBeDisabled()
    await expect(dialog.getByText('Vui lòng nhập ghi chú')).toBeVisible()

    await note.fill('Core xác nhận khớp 1.200 CP')
    await save.click()
    await expect(dialog).toHaveCount(0)
    await expect(row).toContainText('Chờ duyệt')
    await expect(row).toContainText('Chờ người vận hành khác duyệt')
    await expect(row.getByRole('button', { name: 'Duyệt' })).toHaveCount(0)
  })

  test('Trung tâm lệnh có "Xem đối soát" khi có chênh lệch mở; Ctrl+K "Đối soát ngay" chạy đối soát', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await expect(demoId(page, 'kpi-running')).toBeVisible()
    await demoId(page, 'attention-recon-link').click()
    await expect(page).toHaveURL(/\/bao-cao\/lich-su\?tab=doi-soat$/)
    await expect(demoId(page, 'recon-table')).toBeVisible()
    await expect(demoId(page, 'recon-last-run')).toContainText('Chưa chạy')

    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: 'Tìm nhanh' }).fill('doi soat ngay')
    await page.getByRole('listbox', { name: 'Kết quả' }).getByRole('option', { name: /Đối soát ngay/ }).click()
    await expect(demoId(page, 'recon-last-run')).toContainText('Lần chạy gần nhất')
    await expect(page).toHaveURL(/\?tab=doi-soat$/)
  })

  test('khách hàng: Trung tâm lệnh không có liên kết đối soát, Ctrl+K không có "Đối soát ngay"', async ({ page }) => {
    await loginAs(page, 'CUSTOMER')
    await expect(demoId(page, 'kpi-running')).toBeVisible()
    await expect(demoId(page, 'attention-recon-link')).toHaveCount(0)
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox', { name: 'Tìm nhanh' }).fill('doi soat')
    const results = page.getByRole('listbox', { name: 'Kết quả' })
    await expect(results.getByRole('option', { name: /Lịch sử và đối soát/ })).toBeVisible()
    await expect(results.getByRole('option', { name: /Đối soát ngay/ })).toHaveCount(0)
  })
})
