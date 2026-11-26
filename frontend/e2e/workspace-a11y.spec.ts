import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, loginAs, navigate, seedAppearance, test } from './fixtures'

/** axe color-contrast trên Bàn làm việc (bố cục Chuyên nghiệp, đủ 7 panel) ở 4 theme và bảng màu mù màu. */
const VARIANTS = [
  { name: 'Sáng', settings: { mode: 'light' }, theme: 'light' },
  { name: 'Tối', settings: { mode: 'dark' }, theme: 'dark' },
  { name: 'Tương phản cao tối', settings: { mode: 'dark', highContrast: true }, theme: 'hc-dark' },
  { name: 'Tương phản cao sáng', settings: { mode: 'light', highContrast: true }, theme: 'hc-light' },
  { name: 'Mù màu (tối)', settings: { mode: 'dark', palette: 'cvd' }, theme: 'dark' },
] as const

async function expectNoContrastIssues(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  const details = violations.flatMap((violation) =>
    violation.nodes.map((node) => `${node.target.join(' ')} → ${node.any.map((check) => check.message).join('; ')}`),
  )
  expect(details, `${where}: vi phạm tương phản`).toEqual([])
}

for (const variant of VARIANTS) {
  test(`axe color-contrast · Bàn làm việc · ${variant.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'chỉ chạy ở desktop-1440')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedAppearance(page, variant.settings)
    await loginAs(page, 'OPS')
    await navigate(page, '/ban-lam-viec')
    await expect(page.locator('html')).toHaveAttribute('data-theme', variant.theme)
    await expect(page.locator('[data-ws-panel]')).toHaveCount(6)
    await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
    await page.clock.runFor(1_000)
    // Một panel ở nhóm khác để có đủ nhãn màu nhóm trên tab.
    await page.getByRole('button', { name: 'Tùy chọn panel Thông báo' }).click()
    await page.getByRole('menuitemradio', { name: 'Nhóm 3' }).click()
    await expectNoContrastIssues(page, 'Bàn làm việc')

    await page.keyboard.press('Shift+Slash')
    await expect(page.getByTestId('shortcut-sheet')).toBeVisible()
    await expectNoContrastIssues(page, 'Bảng phím tắt')
  })
}
