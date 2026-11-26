import type { Locator, Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, test } from './fixtures'

/** Khung của một panel theo id (dockview: `<loại>-<n>`). */
const panel = (page: Page, id: string) => page.locator(`[data-ws-panel="${id}"]`)
const tab = (page: Page, id: string) => page.locator(`[data-ws-tab="${id}"]`)

async function openWorkspace(page: Page, role: 'DEALER' | 'OPS' | 'CUSTOMER' = 'DEALER') {
  await loginAs(page, role)
  await navigate(page, '/ban-lam-viec')
  await expect(page.getByRole('heading', { level: 1, name: 'Bàn làm việc' })).toBeVisible()
  await expect(panel(page, 'watchlist-1').getByRole('button', { name: 'FPT', exact: true })).toBeVisible()
}

/** Mở menu Bố cục rồi chọn một mục (chờ menu mở hẳn: bấm lúc menu trước còn đang đóng sẽ đóng luôn). */
async function layoutMenu(page: Page, item: string) {
  await expect(async () => {
    if (!(await page.getByRole('menu').isVisible())) await page.getByTestId('ws-layout-menu').click()
    await page.getByRole('menuitem', { name: item, exact: true }).click({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
}

/** Chọn loại lệnh trên phiếu của panel (bàn làm việc có thể có nhiều ô "Mã"/"Loại lệnh"). */
async function chooseTicketStrategy(ticket: Locator, label: string) {
  const page = ticket.page()
  const combobox = ticket.getByRole('combobox', { name: /^Loại lệnh/ })
  await expect(async () => {
    if ((await combobox.getAttribute('aria-expanded')) !== 'true') await combobox.click()
    await page.getByRole('option', { name: label, exact: true }).click({ timeout: 2_000 })
    await expect(combobox).toHaveText(label, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

/** Mã đang hiện ở ô "Mã" của phiếu lệnh. */
const ticketSymbol = (page: Page) => panel(page, 'ticket-1').getByRole('combobox', { name: 'Mã' })
/** Mã ở góc tiêu đề của sổ lệnh 3 mức. */
async function depthSymbol(depth: Locator) {
  return (await depth.locator('[data-demo-id="orderbook3"]').innerText()).split('\n')[1]
}

test.describe('Bàn làm việc (/ban-lam-viec)', () => {
  test('kéo panel sang vị trí khác → tải lại → bố cục giữ nguyên', async ({ page }) => {
    await openWorkspace(page)
    const depthTab = tab(page, 'depth-1')
    const before = await depthTab.boundingBox()
    // Thả tab Sổ lệnh 3 mức vào giữa nhóm Sổ lệnh (hàng dưới): gộp thành tab cùng nhóm.
    await depthTab.dragTo(panel(page, 'blotter-1'))
    await expect.poll(async () => (await depthTab.boundingBox())!.y).toBeGreaterThan(before!.y + 200)
    const moved = await depthTab.boundingBox()
    // Chờ tự lưu (0,5 giây sau thay đổi cuối).
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('oms-workspace:dealer') ?? '{}').active))
      .toBe('Mặc định')
    await page.waitForTimeout(800)

    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'Bàn làm việc' })).toBeVisible()
    await expect.poll(async () => Math.round((await tab(page, 'depth-1').boundingBox())!.y)).toBe(Math.round(moved!.y))
  })

  test('chọn mã ở Danh mục: Phiếu lệnh, Sổ lệnh 3 mức cùng nhóm đổi mã; panel nhóm khác giữ nguyên', async ({ page }) => {
    await openWorkspace(page)
    // Thêm một sổ lệnh 3 mức thứ hai và đưa sang Nhóm 2 (một loại panel mở được nhiều lần).
    // Thêm vào nhóm cuối (Thông báo) để Danh mục vẫn hiện.
    await page.getByRole('button', { name: 'Thêm panel vào nhóm này' }).last().click()
    await page.getByRole('menuitem', { name: /Sổ lệnh 3 mức/ }).click()
    await expect(tab(page, 'depth-2')).toBeVisible()
    await tab(page, 'depth-2').getByRole('button', { name: 'Tùy chọn panel Sổ lệnh 3 mức' }).click()
    await page.getByRole('menuitemradio', { name: 'Nhóm 2' }).click()
    await expect(tab(page, 'depth-2').locator('[data-link-group="2"]')).toBeVisible()
    await expect(tab(page, 'depth-2')).toContainText('Nhóm 2')

    await panel(page, 'watchlist-1').getByRole('button', { name: 'MWG', exact: true }).click()
    await expect(ticketSymbol(page)).toHaveText('MWG')
    await expect.poll(() => depthSymbol(panel(page, 'depth-1'))).toBe('MWG')
    // Nhóm 2 vẫn ở mã mặc định của nhóm (HPG).
    await tab(page, 'depth-2').click()
    await expect.poll(() => depthSymbol(panel(page, 'depth-2'))).toBe('HPG')
  })

  test('gõ "B" trong ô nhập hoặc ô tìm kiếm không mở phiếu; B ngoài ô nhập mở phiếu Mua và vẫn phải Xác nhận mới gửi', async ({ page }) => {
    await openWorkspace(page)
    const ticket = panel(page, 'ticket-1')
    const buy = ticket.getByRole('button', { name: 'Mua', exact: true })
    const sell = ticket.getByRole('button', { name: 'Bán', exact: true })
    await sell.click()
    await expect(sell).toHaveClass(/bg-sell/)

    // Gõ B trong ô Khối lượng: không đổi chiều.
    const qty = ticket.getByRole('textbox', { name: 'Khối lượng', exact: true })
    await qty.click()
    await page.keyboard.press('b')
    await expect(sell).toHaveClass(/bg-sell/)
    // Gõ B trong ô tìm nhanh (Ctrl+K): không mở phiếu. (Ctrl+K không mở khi đang gõ trong ô nhập: bấm ra ngoài trước.)
    await page.getByRole('heading', { level: 1, name: 'Bàn làm việc' }).click()
    await page.keyboard.press('Control+k')
    const search = page.getByRole('combobox', { name: 'Tìm nhanh' })
    await expect(search).toBeFocused()
    await search.press('b')
    await expect(search).toHaveValue('b')
    await search.press('Escape')
    await expect(sell).toHaveClass(/bg-sell/)
    await expect(search).toHaveCount(0)

    // B ngoài ô nhập: phiếu Mua, con trỏ vào ô Khối lượng.
    await panel(page, 'watchlist-1').focus()
    await page.keyboard.press('b')
    await expect(buy).toHaveClass(/bg-buy/)
    await expect(qty).toBeFocused()

    // Điền lệnh LO; không phím nào gửi lệnh: vẫn qua Đặt lệnh → Xác nhận.
    const blotterRows = panel(page, 'blotter-1').locator('[data-order-id]')
    const countBefore = await blotterRows.count()
    await chooseTicketStrategy(ticket, 'Lệnh giới hạn (LO)')
    await qty.fill('1.000')
    await ticket.getByRole('textbox', { name: 'Giá giới hạn' }).fill('118.000')
    await ticket.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()
    // Hộp xác nhận đang mở: phím tắt không chạy, chưa có lệnh nào được gửi.
    await page.keyboard.press('s')
    await expect(blotterRows).toHaveCount(countBefore)
    await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
    await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
    // Xem chi tiết: mở ở panel Chi tiết lệnh cùng nhóm, không rời bàn làm việc.
    await dialog.getByRole('button', { name: 'Xem chi tiết lệnh' }).click()
    await expect(page).toHaveURL(/\/ban-lam-viec$/)
    await expect(panel(page, 'order-detail-1').getByRole('heading', { name: /Chi tiết lệnh PO-/ })).toBeVisible()
    await expect(blotterRows).toHaveCount(countBefore + 1)
  })

  test('đang nhập dở mà nhóm đổi mã: hỏi giữ bản nháp, không xóa trắng', async ({ page }) => {
    await openWorkspace(page)
    const qty = panel(page, 'ticket-1').getByRole('textbox', { name: 'Khối lượng', exact: true })
    await qty.fill('2.000')
    await panel(page, 'watchlist-1').getByRole('button', { name: 'HPG', exact: true }).click()
    const dialog = page.getByTestId('draft-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Giữ bản nháp cho FPT' }).click()
    await expect(qty).toHaveValue('2.000')
    await expect(ticketSymbol(page)).toHaveText('FPT')
    await expect(page.getByTestId('draft-held')).toContainText('Bản nháp FPT · nhóm đang ở HPG')

    // Chuyển sang mã mới: phiếu trống, theo mã của nhóm.
    await page.getByTestId('draft-held').getByRole('button', { name: 'Chuyển sang HPG' }).click()
    await page.getByTestId('draft-dialog').getByRole('button', { name: /Chuyển sang HPG/ }).click()
    await expect(ticketSymbol(page)).toHaveText('HPG')
    await expect(qty).toHaveValue('')

    // Khóa mã: nhóm đổi mã thì phiếu bỏ qua, không hỏi.
    await panel(page, 'ticket-1').getByRole('checkbox', { name: /Khóa mã/ }).click()
    await panel(page, 'watchlist-1').getByRole('button', { name: 'SSI', exact: true }).click()
    await expect(page.getByTestId('draft-dialog')).toHaveCount(0)
    await expect(ticketSymbol(page)).toHaveText('HPG')
  })

  test('duyệt hết panel chỉ bằng bàn phím: Alt+1…n, Tab vào bảng, mũi tên, Enter', async ({ page }) => {
    await openWorkspace(page)
    // Mọi panel kể cả panel đang ẩn sau tab khác (Thuật toán đang chạy nằm sau tab Sổ lệnh).
    const visible = await page.locator('[data-ws-tab]').count()
    expect(visible).toBe(7)
    const focusedPanel = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.closest('[data-ws-panel]')?.getAttribute('data-ws-panel'))
    const seen = new Set<string>()
    let previous: string | null | undefined = null
    for (let index = 1; index <= visible; index += 1) {
      await page.keyboard.press(`Alt+${index}`)
      // Focus chuyển sau khi dockview hiện panel (vài khung hình): chờ tới khi khác panel trước.
      // (panel bị che bởi tab vừa mở có thể rời DOM, focus thoáng về <body>: chờ tới panel thật).
      await expect.poll(async () => { const id = await focusedPanel(); return id && id !== previous ? id : null }).not.toBeNull()
      previous = await focusedPanel()
      seen.add(previous!)
    }
    expect(seen.size).toBe(visible)

    // Danh mục: một điểm dừng Tab, đi bằng mũi tên, Enter chọn mã cho cả nhóm.
    await page.keyboard.press('Alt+1')
    await expect.poll(focusedPanel).toBe('watchlist-1')
    await page.keyboard.press('Tab')
    await expect(panel(page, 'watchlist-1').locator('[tabindex="0"]')).toHaveCount(1)
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(ticketSymbol(page)).toHaveText('HPG')
    await page.keyboard.press('Control+End')
    await expect(page.evaluate(() => document.activeElement?.closest('tr') === document.activeElement?.closest('tbody')?.lastElementChild)).resolves.toBe(true)

    // Bảng phím tắt mở bằng "?" và đóng bằng Esc.
    await page.keyboard.press('Shift+Slash')
    await expect(page.getByTestId('shortcut-sheet')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0)
  })

  test('bố cục đã lưu bị hỏng: dùng bố cục mặc định, báo nhẹ; lưu bố cục có tên và đổi qua lại', async ({ page }) => {
    await loginAs(page, 'DEALER')
    await page.evaluate(() => localStorage.setItem('oms-workspace:dealer', '{hỏng'))
    await navigate(page, '/ban-lam-viec')
    await expect(page.getByRole('status').filter({ hasText: 'bị hỏng' })).toBeVisible()
    await expect(page.locator('[data-ws-panel]')).toHaveCount(6)

    await layoutMenu(page, 'Lưu thành bố cục mới…')
    await page.getByLabel('Tên bố cục').fill('Theo dõi HUNT')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await layoutMenu(page, 'Cơ bản')
    await expect(page.locator('[data-ws-panel]')).toHaveCount(3)

    await layoutMenu(page, 'Mặc định')
    await expect(page.locator('[data-ws-panel]')).toHaveCount(6)
    await expect(page.getByTestId('ws-layout-menu')).toContainText('Mặc định')
  })

  test('khách hàng: bố cục Cơ bản; phím tắt tắt được trong Cài đặt', async ({ page }) => {
    await openWorkspace(page, 'CUSTOMER')
    await expect(page.locator('[data-ws-panel]')).toHaveCount(3)
    await navigate(page, '/cai-dat')
    await page.getByLabel('Bật phím tắt').click()
    await navigate(page, '/ban-lam-viec')
    const sell = panel(page, 'ticket-1').getByRole('button', { name: 'Bán', exact: true })
    await sell.click()
    await panel(page, 'watchlist-1').focus()
    await page.keyboard.press('b')
    await expect(sell).toHaveClass(/bg-sell/)
  })

  test('Demo kịch bản 13 "Dealer dùng bàn làm việc": mọi điều kiện ĐẠT; phím tắt không chạy khi đang Demo', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAs(page, 'OPS')
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.getByRole('dialog', { name: 'Chọn kịch bản Demo' }).getByRole('button', { name: /^Scenario 13 ·/ }).click()
    const controller = demoId(page, 'demo-controller')
    await expect(page).toHaveURL(/\/ban-lam-viec$/)
    await controller.getByRole('group', { name: 'Tốc độ Demo' }).getByRole('button', { name: 'x4' }).click()
    const play = controller.getByRole('button', { name: 'Phát' })
    if (await play.isVisible()) await play.click()
    const result = demoId(page, 'demo-result')
    await expect(async () => {
      await page.clock.runFor(2_000)
      await expect(result).toBeVisible({ timeout: 200 })
    }).toPass({ timeout: 90_000 })
    await expect(result).toContainText('Mọi điều kiện kiểm tra đều ĐẠT.')
    await result.getByRole('button', { name: 'Thoát Demo' }).click()
    await expect(demoId(page, 'demo-badge')).toHaveCount(0)
  })
})
