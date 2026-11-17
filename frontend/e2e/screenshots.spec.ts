import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { demoId, e2eQuery, expect, loginAs, navigate, prepare, runUntilSession, test } from './fixtures'

/**
 * Bộ ảnh tài liệu cho bản v0.1.0. Không nằm trong test:e2e; chạy riêng bằng `npm run screenshots`
 * (chỉ project 1440×900). Dữ liệu cố định nhờ seed và đồng hồ giả lập.
 */
const OUT = join(import.meta.dirname, '..', '..', 'docs', 'screenshots', 'v0.1.0')

async function shot(page: Page, name: string) {
  // Chờ hiệu ứng mở/đóng và lần làm mới dữ liệu kế tiếp.
  await page.clock.runFor(1_500)
  await expect(page.getByRole('status').filter({ hasText: /^Đang tải/ })).toHaveCount(0)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

async function firstOrderWith(page: Page, status: string | RegExp) {
  await navigate(page, '/so-lenh')
  const row = page.locator('[data-demo-id^="order-row-"]').filter({ hasText: status }).first()
  await expect(row).toBeVisible()
  return (await row.getAttribute('data-order-id'))!
}

test.describe.configure({ mode: 'serial' })

test('đăng nhập', async ({ page }) => {
  await prepare(page)
  await page.goto(`/login${e2eQuery()}`)
  await expect(page.getByRole('radio').first()).toBeVisible()
  await shot(page, '01-dang-nhap')
})

test('các màn của vận hành', async ({ page }) => {
  test.setTimeout(180_000)
  await loginAs(page, 'OPS')
  await runUntilSession(page, 'Khớp lệnh liên tục')

  await navigate(page, '/trung-tam')
  await expect(demoId(page, 'kpi-running')).toBeVisible()
  await shot(page, '02-trung-tam')

  await navigate(page, '/dat-lenh')
  await expect(page.getByRole('combobox', { name: 'Mã' })).toHaveText('FPT')
  await demoId(page, 'template-iceberg-quiet').click()
  await shot(page, '03-dat-lenh')

  await navigate(page, '/mau-chien-luoc')
  await expect(demoId(page, 'template-grid')).toBeVisible()
  await shot(page, '04-mau-chien-luoc')

  await navigate(page, '/so-lenh')
  await expect(page.locator('[data-demo-id^="order-row-"]').first()).toBeVisible()
  await shot(page, '05-so-lenh')

  const paused = await firstOrderWith(page, 'Hệ thống tạm dừng')
  await navigate(page, `/so-lenh/${paused}`)
  await expect(demoId(page, 'explain-card')).toBeVisible()
  await shot(page, '06-chi-tiet-paused-system')

  const hunt = await firstOrderWith(page, /HUNT/)
  await navigate(page, `/so-lenh/${hunt}`)
  await expect(demoId(page, 'exec-quality')).toBeVisible()
  await shot(page, '07-chi-tiet-hieu-qua')

  await navigate(page, '/bao-cao/hieu-qua')
  await expect(page.getByRole('heading', { name: 'Chi tiết theo lệnh' })).toBeVisible()
  await shot(page, '08-bao-cao')

  await navigate(page, '/van-hanh')
  await expect(page.getByRole('heading', { name: 'Kill switch' })).toBeVisible()
  await shot(page, '09-van-hanh')

  await navigate(page, '/cau-hinh')
  await expect(page.locator('[data-parameter="MAX_CONSECUTIVE_REJECTS"]')).toBeVisible()
  await shot(page, '10-cau-hinh')

  await navigate(page, '/thuat-ngu')
  await expect(page.locator('[data-demo-id^="glossary-"]').first()).toBeVisible()
  await shot(page, '11-thuat-ngu')

  await navigate(page, '/trung-tam')
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Tìm nhanh' }).fill('hpg')
  await expect(page.getByRole('listbox', { name: 'Kết quả' }).getByRole('option').first()).toBeVisible()
  await shot(page, '12-tim-nhanh')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Demo', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Scenario 4 ·/ }).click()
  const controller = demoId(page, 'demo-controller')
  await controller.getByRole('button', { name: 'Tạm dừng' }).click()
  await controller.getByRole('button', { name: 'Bước tiếp' }).click()
  await controller.getByRole('button', { name: 'Bước tiếp' }).click()
  await shot(page, '13-demo-dang-chay')

  await controller.getByRole('group', { name: 'Tốc độ Demo' }).getByRole('button', { name: 'x4' }).click()
  await controller.getByRole('button', { name: 'Phát' }).click()
  const result = demoId(page, 'demo-result')
  await expect(async () => {
    await page.clock.runFor(2_000)
    await expect(result).toBeVisible({ timeout: 200 })
  }).toPass({ timeout: 60_000 })
  await shot(page, '14-demo-ket-qua')
  await result.getByRole('button', { name: 'Thoát Demo' }).click()
})

test('tour lần đầu', async ({ page }) => {
  await loginAs(page, 'CUSTOMER', { showTour: true })
  await expect(demoId(page, 'tour')).toBeVisible()
  await shot(page, '15-tour')
})
