import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, loginAs, navigate, runUntilSession, seedAppearance, test, USERNAMES, type Role } from './fixtures'

/**
 * Ảnh nghiệm thu Đợt 10A (Bàn làm việc), 1440×900: bố cục Cơ bản, Chuyên nghiệp (tối, sáng), nhóm liên kết màu,
 * hộp giữ bản nháp, bảng phím tắt. Không nằm trong test:e2e; chạy bằng `npm run screenshots:dot10a`.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'dot10a')

async function shot(page: Page, name: string) {
  await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

async function openWorkspace(page: Page, role: Role, mode: 'dark' | 'light' = 'dark') {
  test.setTimeout(180_000)
  await seedAppearance(page, { mode }, USERNAMES[role])
  await loginAs(page, role)
  // Khớp liên tục: giá đã chạy, sổ lệnh 3 mức có chênh lệch mua bán thật.
  await runUntilSession(page, 'Khớp lệnh liên tục')
  await page.clock.runFor(10_000)
  await navigate(page, '/ban-lam-viec')
  await expect(page.getByRole('heading', { level: 1, name: 'Bàn làm việc' })).toBeVisible()
  await page.clock.runFor(2_000)
}

const panel = (page: Page, id: string) => page.locator(`[data-ws-panel="${id}"]`)

test('bố cục Cơ bản (khách hàng)', async ({ page }) => {
  await openWorkspace(page, 'CUSTOMER')
  await shot(page, 'co-ban')
})

for (const mode of ['dark', 'light'] as const) {
  test(`bố cục Chuyên nghiệp · ${mode === 'dark' ? 'tối' : 'sáng'}`, async ({ page }) => {
    await openWorkspace(page, 'DEALER', mode)
    await panel(page, 'watchlist-1').getByRole('button', { name: 'HPG', exact: true }).click()
    await page.clock.runFor(1_000)
    await shot(page, `chuyen-nghiep-${mode === 'dark' ? 'toi' : 'sang'}`)
  })
}

test('nhóm liên kết màu: Nhóm 1 theo MWG, Nhóm 2 giữ HPG', async ({ page }) => {
  await openWorkspace(page, 'DEALER')
  // Thông báo → Nhóm 3; thêm Sổ lệnh 3 mức vào nhóm cuối và đưa sang Nhóm 2; Chi tiết lệnh → Không nhóm.
  await page.getByRole('button', { name: 'Tùy chọn panel Thông báo' }).click()
  await page.getByRole('menuitemradio', { name: 'Nhóm 3' }).click()
  await page.getByRole('button', { name: 'Thêm panel vào nhóm này' }).last().click()
  await page.getByRole('menuitem', { name: /Sổ lệnh 3 mức/ }).click()
  await page.locator('[data-ws-tab="depth-2"]').getByRole('button', { name: /Tùy chọn panel/ }).click()
  await page.getByRole('menuitemradio', { name: 'Nhóm 2' }).click()
  await page.getByRole('button', { name: 'Tùy chọn panel Chi tiết lệnh' }).click()
  await page.getByRole('menuitemradio', { name: 'Không nhóm' }).click()
  await panel(page, 'watchlist-1').getByRole('button', { name: 'MWG', exact: true }).click()
  await page.clock.runFor(1_000)
  await shot(page, 'nhom-lien-ket')
})

test('hộp giữ bản nháp khi nhóm đổi mã', async ({ page }) => {
  await openWorkspace(page, 'DEALER')
  await panel(page, 'ticket-1').getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('2.000')
  await panel(page, 'watchlist-1').getByRole('button', { name: 'HPG', exact: true }).click()
  await expect(page.getByTestId('draft-dialog')).toBeVisible()
  await shot(page, 'giu-ban-nhap')
})

test('bảng phím tắt', async ({ page }) => {
  await openWorkspace(page, 'DEALER')
  await page.getByRole('heading', { level: 1, name: 'Bàn làm việc' }).click()
  await page.keyboard.press('Shift+Slash')
  await expect(page.getByTestId('shortcut-sheet')).toBeVisible()
  await shot(page, 'bang-phim-tat')
})
