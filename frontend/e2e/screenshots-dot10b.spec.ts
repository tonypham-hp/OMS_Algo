import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, loginAs, navigate, runUntilSession, test } from './fixtures'

/**
 * Ảnh nghiệm thu Đợt 10B (đa cửa sổ): bàn làm việc + cửa sổ tách đặt cạnh nhau (ghép 2 ảnh bằng canvas trong trình duyệt,
 * không thêm gói), phiếu mini nổi trên cùng (nếu trình duyệt có Document Picture-in-Picture).
 * Không nằm trong test:e2e; chạy bằng `npm run screenshots:dot10b`.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'dot10b')

/** Ghép các ảnh PNG theo hàng ngang, khoảng cách 16 px trên nền tối, lưu ra file. */
async function sideBySide(page: Page, images: Buffer[], file: string) {
  const dataUrls = images.map((image) => `data:image/png;base64,${image.toString('base64')}`)
  const png = await page.evaluate(async (urls) => {
    const loaded = await Promise.all(
      urls.map(
        (url) =>
          new Promise<HTMLImageElement>((resolve) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.src = url
          }),
      ),
    )
    const gap = 16
    const canvas = document.createElement('canvas')
    canvas.width = loaded.reduce((sum, image) => sum + image.width, 0) + gap * (loaded.length + 1)
    canvas.height = Math.max(...loaded.map((image) => image.height)) + gap * 2
    const context = canvas.getContext('2d')!
    context.fillStyle = getComputedStyle(document.body).backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
    let x = gap
    for (const image of loaded) {
      context.drawImage(image, x, gap)
      x += image.width + gap
    }
    return canvas.toDataURL('image/png').split(',')[1]
  }, dataUrls)
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(OUT, file), Buffer.from(png, 'base64'))
}

async function openWorkspace(page: Page) {
  test.setTimeout(180_000)
  await loginAs(page, 'DEALER')
  await runUntilSession(page, 'Khớp lệnh liên tục')
  await page.clock.runFor(10_000)
  await navigate(page, '/ban-lam-viec')
  await expect(page.getByRole('heading', { level: 1, name: 'Bàn làm việc' })).toBeVisible()
  await page.clock.runFor(2_000)
}

test('bàn làm việc + cửa sổ tách cạnh nhau', async ({ page, context }) => {
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Tùy chọn panel Phiếu lệnh' }).click()
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('menuitem', { name: 'Tách ra cửa sổ riêng' }).click()])
  await popup.setViewportSize({ width: 560, height: 900 })
  await expect(popup.locator('[data-ws-kind="ticket"]')).toBeVisible()
  await page.locator('[data-ws-kind="watchlist"]').getByRole('button', { name: 'HPG', exact: true }).click()
  await page.clock.runFor(1_000)
  await expect(popup.getByRole('combobox', { name: 'Mã' })).toHaveText('HPG')
  await sideBySide(page, [await page.screenshot(), await popup.screenshot()], 'ban-lam-viec-va-cua-so-tach.png')
})

test('phiếu mini nổi trên cùng', async ({ page, context }) => {
  await openWorkspace(page)
  test.skip(!(await page.evaluate(() => 'documentPictureInPicture' in window)), 'Không có Document Picture-in-Picture')
  const [mini] = await Promise.all([context.waitForEvent('page'), page.getByTestId('open-mini-ticket').click()])
  await mini.setViewportSize({ width: 400, height: 640 })
  await expect(mini.getByTestId('mini-ticket')).toBeVisible()
  await sideBySide(page, [await page.screenshot(), await mini.screenshot()], 'phieu-mini-noi.png')
})
