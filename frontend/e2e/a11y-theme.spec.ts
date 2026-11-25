import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { demoId, expect, loginAs, navigate, seedAppearance, test } from './fixtures'

/**
 * axe (chỉ luật color-contrast, WCAG AA) trên các màn chính, ở 4 theme và bảng màu mù màu.
 * Tỷ lệ của từng cặp token đã kiểm bằng Vitest (src/theme/contrast.test.ts); ở đây bắt các chỗ ghép màu thực tế
 * trên giao diện (lớp token đặt sai nền, opacity, nhãn nằm trên nền nhấn…).
 */
const VARIANTS = [
  { name: 'Sáng', settings: { mode: 'light' }, theme: 'light', palette: 'default' },
  { name: 'Tối', settings: { mode: 'dark' }, theme: 'dark', palette: 'default' },
  { name: 'Tương phản cao tối', settings: { mode: 'dark', highContrast: true }, theme: 'hc-dark', palette: 'default' },
  { name: 'Tương phản cao sáng', settings: { mode: 'light', highContrast: true }, theme: 'hc-light', palette: 'default' },
  { name: 'Mù màu (sáng)', settings: { mode: 'light', palette: 'cvd' }, theme: 'light', palette: 'cvd' },
  { name: 'Mù màu (tối)', settings: { mode: 'dark', palette: 'cvd' }, theme: 'dark', palette: 'cvd' },
] as const


async function settle(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
  await page.clock.runFor(1_000)
}

async function expectNoContrastIssues(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  const details = violations.flatMap((violation) =>
    violation.nodes.map((node) => `${node.target.join(' ')} → ${node.any.map((check) => check.message).join('; ')}`),
  )
  expect(details, `${where}: vi phạm tương phản`).toEqual([])
}

for (const variant of VARIANTS) {
  test(`axe color-contrast · ${variant.name}: Trung tâm lệnh, Đặt lệnh, Sổ lệnh, Chi tiết, Báo cáo, Lịch sử/Đối soát, Cài đặt, Demo`, async ({
    page,
  }, testInfo) => {
    // Màu không phụ thuộc bề ngang: chạy một khổ màn là đủ.
    test.skip(testInfo.project.name !== 'desktop-1440', 'chỉ chạy ở desktop-1440')
    test.setTimeout(180_000)
    // Giảm chuyển động: nền nhấp nháy giá không bị bắt giữa chừng (nền nháy đã kiểm riêng trong Vitest).
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedAppearance(page, variant.settings)
    await loginAs(page, 'OPS')
    await expect(page.locator('html')).toHaveAttribute('data-theme', variant.theme)
    await expect(page.locator('html')).toHaveAttribute('data-palette', variant.palette)

    await settle(page)
    await expectNoContrastIssues(page, 'Trung tâm lệnh')

    await navigate(page, '/dat-lenh')
    await expect(demoId(page, 'orderbook3')).toBeVisible()
    await settle(page)
    await expectNoContrastIssues(page, 'Đặt lệnh')

    await navigate(page, '/so-lenh')
    const firstRow = page.locator('[data-demo-id^="order-row-"]').first()
    await expect(firstRow).toBeVisible()
    const detailPath = `/so-lenh/${await firstRow.getAttribute('data-order-id')}`
    await settle(page)
    await expectNoContrastIssues(page, 'Sổ lệnh')

    await navigate(page, detailPath)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Chi tiết lệnh')
    await settle(page)
    await expectNoContrastIssues(page, 'Chi tiết lệnh')

    await navigate(page, '/bao-cao/hieu-qua')
    await settle(page)
    await expectNoContrastIssues(page, 'Báo cáo hiệu quả')

    await navigate(page, '/bao-cao/lich-su')
    await settle(page)
    await expectNoContrastIssues(page, 'Lịch sử')

    await navigate(page, '/bao-cao/lich-su?tab=doi-soat')
    await settle(page)
    await expectNoContrastIssues(page, 'Đối soát')

    // Cài đặt: khung xem trước lồng theme khác (sáng trong tối, tương phản cao…) cũng phải đạt.
    await navigate(page, '/cai-dat')
    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expectNoContrastIssues(page, 'Cài đặt giao diện')

    // Demo: một bước đang chạy (thanh Demo, bảng điều kiện, vùng tô sáng).
    await navigate(page, '/trung-tam')
    await page.getByRole('button', { name: 'Demo', exact: true }).click()
    await page.getByRole('dialog', { name: 'Chọn kịch bản Demo' }).getByRole('button', { name: /^Scenario 1 ·/ }).click()
    const controller = demoId(page, 'demo-controller')
    const pause = controller.getByRole('button', { name: 'Tạm dừng' })
    if (await pause.isVisible()) await pause.click()
    await controller.getByRole('button', { name: 'Bước tiếp' }).click()
    await page.clock.runFor(1_000)
    await expectNoContrastIssues(page, 'Demo')
  })
}
