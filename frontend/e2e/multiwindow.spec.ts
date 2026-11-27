import { test as base, type BrowserContext, type Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, test, watchProblems } from './fixtures'

/**
 * Đa cửa sổ (Đợt 10B): tách panel của Bàn làm việc ra cửa sổ riêng (dockview popout), màn hình thứ hai, phiếu mini nổi.
 * Cửa sổ tách là một "page" mới của context (context.waitForEvent('page')). Lỗi console của cửa sổ tách cũng được kiểm.
 */

const panelIn = (page: Page, kind: string) => page.locator(`[data-ws-kind="${kind}"]`)

async function openWorkspace(page: Page) {
  await loginAs(page, 'DEALER')
  await navigate(page, '/ban-lam-viec')
  await expect(page.getByRole('heading', { level: 1, name: 'Bàn làm việc' })).toBeVisible()
  await expect(panelIn(page, 'watchlist').getByRole('button', { name: 'FPT', exact: true })).toBeVisible()
}

/** Tách panel qua menu "⋯" của tab; trả trang của cửa sổ tách (đã kèm bộ theo dõi lỗi console). */
async function popout(page: Page, context: BrowserContext, title: string) {
  await page.getByRole('button', { name: `Tùy chọn panel ${title}` }).click()
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('menuitem', { name: 'Tách ra cửa sổ riêng' }).click()])
  const problems = watchProblems(popup)
  await popup.waitForLoadState()
  await expect(popup.locator('[data-ws-panel]').first()).toBeVisible()
  return { popup, problems }
}

test.describe('Đa cửa sổ', () => {
  test('tách panel → cửa sổ thứ hai; đổi mã ở cửa sổ chính → cửa sổ tách cập nhật < 500 ms; đóng → panel về bàn làm việc', async ({
    page,
    context,
  }) => {
    await openWorkspace(page)
    const { popup, problems } = await popout(page, context, 'Sổ lệnh 3 mức')
    await expect(panelIn(popup, 'depth')).toHaveCount(1)
    await expect(panelIn(page, 'depth')).toHaveCount(0)
    await expect(popup.locator('[data-demo-id="orderbook3"]')).toContainText('FPT')

    await panelIn(page, 'watchlist').getByRole('button', { name: 'HPG', exact: true }).click()
    await expect(popup.locator('[data-demo-id="orderbook3"]')).toContainText('HPG', { timeout: 500 })

    await popup.close()
    await expect(panelIn(page, 'depth')).toHaveCount(1)
    await expect(panelIn(page, 'depth').locator('[data-demo-id="orderbook3"]')).toContainText('HPG')
    expect(problems.console, 'lỗi console ở cửa sổ tách').toEqual([])
  })

  test('đổi theme ở cửa sổ chính → cửa sổ tách đổi theo; Dialog, ô chọn, menu mở trong cửa sổ tách; đặt lệnh vẫn qua Xác nhận', async ({
    page,
    context,
  }) => {
    await openWorkspace(page)
    const { popup, problems } = await popout(page, context, 'Phiếu lệnh')
    await popup.setViewportSize({ width: 520, height: 900 })
    await expect(popup.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Đổi sang giao diện sáng' }).click()
    await expect(popup.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(popup.locator('body')).toHaveCSS('background-color', 'rgb(248, 250, 252)')

    // Ô chọn (Radix Select) mở trong cửa sổ tách.
    await popup.getByRole('combobox', { name: /^Loại lệnh/ }).click()
    await expect(popup.getByRole('listbox')).toBeVisible()
    await expect(page.getByRole('listbox')).toHaveCount(0)
    await popup.getByRole('option', { name: 'Lệnh giới hạn (LO)', exact: true }).click()

    // Đặt lệnh: Dialog Xác nhận hiện ở cửa sổ tách, chưa xác nhận thì chưa có lệnh.
    await popup.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('1.000')
    await popup.getByRole('textbox', { name: 'Giá giới hạn' }).fill('118.000')
    await popup.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
    const dialog = popup.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const rows = panelIn(page, 'blotter').locator('[data-order-id]')
    const before = await rows.count()
    await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
    await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
    await expect(rows).toHaveCount(before + 1)
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click()

    // Menu "⋯" của tab trong cửa sổ tách cũng mở tại đó, có "Đưa về bàn làm việc".
    await popup.getByRole('button', { name: 'Tùy chọn panel Phiếu lệnh' }).click()
    await expect(popup.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menu')).toHaveCount(0)
    const closed = popup.waitForEvent('close')
    await popup.getByRole('menuitem', { name: 'Đưa về bàn làm việc' }).click()
    await closed
    await expect(panelIn(page, 'ticket')).toHaveCount(1)
    expect(problems.console, 'lỗi console ở cửa sổ tách').toEqual([])
  })

  test('phím tắt trong cửa sổ tách: B mở phiếu Mua ở chính cửa sổ đó, ? mở bảng phím tắt tại đó', async ({ page, context }) => {
    await openWorkspace(page)
    const { popup } = await popout(page, context, 'Phiếu lệnh')
    const sell = popup.getByRole('button', { name: 'Bán', exact: true })
    await sell.click()
    await expect(sell).toHaveClass(/bg-sell/)
    await popup.locator('[data-ws-panel]').first().focus()
    await popup.keyboard.press('b')
    await expect(popup.getByRole('button', { name: 'Mua', exact: true })).toHaveClass(/bg-buy/)
    await expect(popup.locator('#total_qty')).toBeFocused()
    await popup.locator('[data-ws-panel]').first().focus()
    await popup.keyboard.press('Shift+Slash')
    await expect(popup.getByTestId('shortcut-sheet')).toBeVisible()
    await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0)
  })

  test('tải lại cửa sổ chính: panel đang tách về bàn làm việc, có nút mở lại (một cú bấm mở một cửa sổ)', async ({ page, context }) => {
    await openWorkspace(page)
    await popout(page, context, 'Sổ lệnh 3 mức')
    // Chờ tự lưu bố cục (0,5 giây) rồi tải lại.
    await expect
      .poll(() => page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('oms-workspace:dealer') ?? '{}').layouts?.['Mặc định']?.dock?.popoutGroups ?? [])))
      .toContain('depth-1')
    await page.reload()
    const notice = page.getByTestId('ws-returned')
    await expect(notice).toContainText('1 panel đang ở cửa sổ tách đã được đưa về bàn làm việc')
    await expect(panelIn(page, 'depth')).toHaveCount(1)
    const [popup] = await Promise.all([context.waitForEvent('page'), notice.getByRole('button', { name: /Mở lại cửa sổ tách/ }).click()])
    await expect(panelIn(popup, 'depth')).toHaveCount(1)
    await expect(notice).toHaveCount(0)
  })

  test('đăng xuất ở cửa sổ chính đóng mọi cửa sổ tách; đang Demo thì khóa tách cửa sổ', async ({ page, context }) => {
    await openWorkspace(page)
    const { popup } = await popout(page, context, 'Sổ lệnh 3 mức')
    const closed = popup.waitForEvent('close')
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click()
    await closed

    await loginAs(page, 'OPS')
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.getByRole('dialog', { name: 'Chọn kịch bản Demo' }).getByRole('button', { name: /^Scenario 13 ·/ }).click()
    await expect(page).toHaveURL(/\/ban-lam-viec$/)
    await expect(demoId(page, 'ws-depth')).toBeVisible()
    await page.getByRole('button', { name: 'Tùy chọn panel Sổ lệnh 3 mức' }).click()
    await expect(page.getByRole('menuitem', { name: /Tách ra cửa sổ riêng/ })).toBeDisabled()
  })

  test('màn hình thứ hai (Window Management API giả lập): chọn màn hình → cửa sổ đặt đúng vị trí, nhớ trong bố cục', async ({ page, context }) => {
    await page.addInitScript(() => {
      const screens = [
        { label: 'Built-in', availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040, isPrimary: true },
        { label: 'DELL U2720Q', availLeft: 1920, availTop: 0, availWidth: 2560, availHeight: 1400, isPrimary: false },
      ]
      ;(window as unknown as { getScreenDetails: () => Promise<unknown> }).getScreenDetails = async () => ({ screens, currentScreen: screens[0] })
      const open = window.open.bind(window)
      ;(window as unknown as { __features: string[] }).__features = []
      window.open = (url, target, features) => {
        ;(window as unknown as { __features: string[] }).__features.push(String(features))
        return open(url, target, features)
      }
    })
    await openWorkspace(page)
    await page.getByRole('button', { name: 'Tùy chọn panel Sổ lệnh 3 mức' }).click()
    await page.getByRole('menuitem', { name: 'Mở trên màn hình khác…' }).click()
    const picker = page.getByTestId('screen-picker')
    await expect(picker.getByRole('radio', { name: /DELL U2720Q/ })).toBeChecked()
    const [popup] = await Promise.all([context.waitForEvent('page'), picker.getByRole('button', { name: 'Mở' }).click()])
    await expect(panelIn(popup, 'depth')).toHaveCount(1)
    expect(await page.evaluate(() => (window as unknown as { __features: string[] }).__features)).toEqual(['top=340,left=2720,width=960,height=720'])
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('oms-workspace:dealer') ?? '{}').layouts?.['Mặc định']?.dock?.panels?.['depth-1']?.params?.screen?.label))
      .toBe('DELL U2720Q · 2560×1400')
  })

  test('không có Window Management API: không có mục "màn hình khác", tách vẫn mở cửa sổ thường', async ({ page, context }) => {
    await page.addInitScript(() => {
      delete (window as unknown as { getScreenDetails?: unknown }).getScreenDetails
    })
    await openWorkspace(page)
    await page.getByRole('button', { name: 'Tùy chọn panel Sổ lệnh 3 mức' }).click()
    await expect(page.getByRole('menuitem', { name: 'Mở trên màn hình khác…' })).toHaveCount(0)
    const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('menuitem', { name: 'Tách ra cửa sổ riêng' }).click()])
    await expect(panelIn(popup, 'depth')).toHaveCount(1)
  })

  test('phiếu mini nổi trên cùng (Document Picture-in-Picture): theo nhóm, đặt lệnh vẫn qua Xác nhận', async ({ page, context }) => {
    await openWorkspace(page)
    const supported = await page.evaluate(() => 'documentPictureInPicture' in window)
    test.skip(!supported, 'Trình duyệt này không có Document Picture-in-Picture: nút bị ẩn, không giả lập')
    const [mini] = await Promise.all([context.waitForEvent('page'), page.getByTestId('open-mini-ticket').click()])
    const problems = watchProblems(mini)
    await expect(mini.getByTestId('mini-ticket')).toBeVisible()
    await panelIn(page, 'watchlist').getByRole('button', { name: 'HPG', exact: true }).click()
    await expect(mini.getByRole('combobox', { name: 'Mã' })).toHaveText('HPG', { timeout: 500 })
    await mini.getByRole('combobox', { name: /^Loại lệnh/ }).click()
    await mini.getByRole('option', { name: 'Lệnh giới hạn (LO)', exact: true }).click()
    await mini.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('1.000')
    await mini.getByRole('textbox', { name: 'Giá giới hạn' }).fill('27.000')
    await mini.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
    await expect(mini.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()
    await mini.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
    await expect(mini.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
    expect(problems.console).toEqual([])
  })
})

// Ca popup bị chặn: dockview tự ghi console.error khi trình duyệt chặn cửa sổ – lỗi có chủ đích, nên không dùng bộ kiểm
// lỗi console chung; mọi lỗi KHÁC vẫn phải bằng 0.
base('trình duyệt chặn popup: panel ở lại bàn làm việc, hiện hướng dẫn cho phép popup bằng tiếng Việt', async ({ page }) => {
  const problems = watchProblems(page)
  await page.addInitScript(() => {
    window.open = () => null
  })
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Tùy chọn panel Sổ lệnh 3 mức' }).click()
  await page.getByRole('menuitem', { name: 'Tách ra cửa sổ riêng' }).click()
  const dialog = page.getByTestId('popup-blocked')
  await expect(dialog).toContainText('Trình duyệt đang chặn cửa sổ bật lên')
  await expect(dialog).toContainText('Luôn cho phép cửa sổ bật lên')
  await expect(panelIn(page, 'depth')).toHaveCount(1)
  expect(problems.console.filter((message) => !message.includes('perhaps you need to allow pop-ups'))).toEqual([])
})
