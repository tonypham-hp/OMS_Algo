import { chooseStrategy, demoId, expect, loginAs, navigate, runUntilSession, test } from './fixtures'

/** "118.300" → 118300 */
const toNumber = (text: string) => Number(text.replace(/\./g, ''))

test('HUNT: khung quét hiện từng mức, không vượt giá tối đa', async ({ page }) => {
  await loginAs(page, 'CUSTOMER')
  await runUntilSession(page, 'Khớp lệnh liên tục')
  await navigate(page, '/dat-lenh')
  await chooseStrategy(page, 'HUNT')
  // Dừng đồng hồ để sổ lệnh không đổi giữa lúc đọc giá và lúc đặt lệnh.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000)

  // Giá tối đa = mức bán 2: các mức cao hơn phải bị bỏ qua.
  const askPrice = async (level: number) => {
    const label = await page.getByRole('button', { name: new RegExp(`^Bán ${level}: giá`) }).getAttribute('aria-label')
    return toNumber(/giá ([\d.]+)/.exec(label!)![1])
  }
  const ask1 = await askPrice(1)
  const ask2 = await askPrice(2)
  const fmt = (value: number) => value.toLocaleString('vi-VN')

  await page.getByRole('textbox', { name: 'Khối lượng', exact: true }).fill('200.000')
  await page.getByRole('textbox', { name: 'Giá săn' }).fill(fmt(ask1))
  await page.getByRole('textbox', { name: 'Thời gian chờ tối đa' }).fill('30')
  await page.getByRole('textbox', { name: 'Giá giới hạn' }).fill(fmt(ask2))
  await page.getByRole('textbox', { name: 'Số mức quét tối đa' }).fill('3')
  await page.getByRole('button', { name: 'Đặt lệnh', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Xác nhận đặt lệnh' }).click()
  await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
  await dialog.getByRole('link', { name: 'Xem chi tiết lệnh' }).click()

  await page.clock.resume()
  const sweep = demoId(page, 'hunt-sweep')
  await expect(sweep.getByRole('heading', { name: 'HUNT quét từng mức' })).toBeVisible()
  const steps = sweep.getByRole('list', { name: 'Các bước quét' }).locator('[data-demo-id^="hunt-step-"]')
  // Tối đa 3 mức; mức nào cũng có chữ mô tả và nhãn trạng thái. Mức được quét không vượt giá tối đa,
  // mức vượt giá tối đa phải ghi rõ "vượt giới hạn giá". Sổ lệnh có thể dịch trước lúc kích hoạt nên không cố định giá từng mức.
  await expect(steps.first()).toBeVisible()
  const texts = await steps.allInnerTexts()
  expect(texts.length).toBeGreaterThan(0)
  expect(texts.length).toBeLessThanOrEqual(3)
  let swept = 0
  for (const text of texts) {
    const price = toNumber(/[Mm]ức ([\d.]+)/.exec(text)![1])
    if (text.includes('Quét mức')) {
      swept += 1
      expect(price, text).toBeLessThanOrEqual(ask2)
      expect(text).toMatch(/Đã khớp|Đang chờ|Đã hủy/)
    } else if (text.includes('vượt giới hạn giá')) {
      expect(price, text).toBeGreaterThan(ask2)
      expect(text).toContain('Vượt giới hạn giá')
    }
  }
  expect(swept).toBeGreaterThan(0)

  // Không lần khớp nào cao hơn giá tối đa.
  const rows = demoId(page, 'executions').getByRole('row')
  await expect(rows.nth(1)).toBeVisible()
  // Cột "Giá" là cột thứ 3 của bảng khớp.
  const prices = (await demoId(page, 'executions').locator('tbody tr td:nth-child(3)').allInnerTexts()).map(toNumber)
  expect(prices.length).toBeGreaterThan(0)
  for (const price of prices) {
    expect(price, 'giá khớp không vượt giá tối đa').toBeLessThanOrEqual(ask2)
    expect(price).toBeGreaterThanOrEqual(ask1)
  }
})
