import type { Page } from '@playwright/test'
import { expect, loginAs, test } from './fixtures'

/** Thông tin phần tử đang có focus: tên truy cập gần đúng, id, và có đang hiện viền focus không. */
async function focused(page: Page) {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element || element === document.body) return { id: '', name: '', visible: false, tag: 'BODY' }
    const style = getComputedStyle(element)
    const hasRing =
      (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || (style.boxShadow !== 'none' && style.boxShadow !== '')
    const labelledBy = element.getAttribute('aria-labelledby')
    const label =
      element.getAttribute('aria-label') ??
      (labelledBy ? document.getElementById(labelledBy)?.textContent : null) ??
      (element.id ? document.querySelector(`label[for="${element.id}"]`)?.textContent : null) ??
      element.textContent ??
      ''
    return { id: element.id, name: label.trim(), visible: element.matches(':focus-visible') && hasRing, tag: element.tagName }
  })
}

/** Bấm Tab tới khi focus vào phần tử thỏa điều kiện; mỗi điểm dừng phải có viền focus nhìn thấy được. */
async function tabTo(page: Page, match: (item: Awaited<ReturnType<typeof focused>>) => boolean, maxStops = 80) {
  for (let stop = 0; stop < maxStops; stop += 1) {
    await page.keyboard.press('Tab')
    const item = await focused(page)
    expect(item.visible, `Phần tử nhận focus phải có viền nhìn thấy: ${item.tag}#${item.id} "${item.name}"`).toBe(true)
    if (match(item)) return item
  }
  throw new Error('Không Tab tới được phần tử cần tìm')
}

test('đặt lệnh Iceberg chỉ bằng bàn phím (Tab, Enter, Esc)', async ({ page }) => {
  await loginAs(page, 'CUSTOMER')
  await expect(page.locator('[data-demo-id="kpi-running"]')).toBeVisible()

  // Vào màn Đặt lệnh từ thanh bên bằng Tab + Enter.
  await tabTo(page, (item) => item.name === 'Đặt lệnh' && item.tag === 'A')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/dat-lenh$/)
  await expect(page.getByRole('combobox', { name: 'Mã' })).toHaveText('FPT')

  // Loại lệnh: mở bằng Enter, chọn bằng phím mũi tên / gõ chữ đầu, Enter để chọn.
  await tabTo(page, (item) => item.id === 'strategy_type')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toBeVisible()
  await page.keyboard.type('Iceberg')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: /^Loại lệnh/ })).toHaveText('Iceberg')

  await tabTo(page, (item) => item.id === 'total_qty')
  await page.keyboard.type('5000')
  await tabTo(page, (item) => item.id === 'slice_qty')
  await page.keyboard.type('1000')
  await tabTo(page, (item) => item.id === 'limit_price')
  await page.keyboard.type('118000')
  // Enter trong ô nhập gửi form → hộp xác nhận.
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()

  // Esc đóng hộp xác nhận, form giữ nguyên giá trị.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Khối lượng', exact: true })).toHaveValue('5.000')

  // Mở lại, Tab tới nút xác nhận rồi Enter.
  await tabTo(page, (item) => item.name === 'Đặt lệnh' && item.tag === 'BUTTON')
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('heading', { name: 'Xác nhận đặt lệnh' })).toBeVisible()
  await tabTo(page, (item) => item.name === 'Xác nhận đặt lệnh', 10)
  await page.keyboard.press('Enter')
  await expect(dialog.getByRole('heading', { name: 'Đặt lệnh thành công' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
