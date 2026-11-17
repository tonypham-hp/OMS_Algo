import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { expect, loginAs, navigate, test } from './fixtures'

const toNumber = (text: string) => Number(text.replace(/\./g, '').replace(',', '.').replace('−', '-'))

async function selectFilter(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await expect(page.getByRole('combobox', { name: label })).toHaveText(option)
}

const detailTable = (page: Page) => page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: /Mã lệnh/ }) })

async function rowCount(page: Page) {
  const description = page.getByText(/^\d+ lệnh\. Bấm một dòng/)
  return Number(/^(\d+)/.exec(await description.innerText())![1])
}

test.describe('Báo cáo hiệu quả thực hiện', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'OPS')
    await navigate(page, '/bao-cao/hieu-qua')
    await expect(detailTable(page)).toBeVisible()
  })

  test('lọc theo chiều: bảng chỉ còn lệnh đúng chiều', async ({ page }) => {
    const total = await rowCount(page)
    await selectFilter(page, 'Chiều', 'Mua')
    const buys = await rowCount(page)
    expect(buys).toBeLessThanOrEqual(total)
    const sides = await detailTable(page).locator('tbody tr td:nth-child(3)').allInnerTexts()
    expect(sides.length).toBe(buys)
    expect(new Set(sides)).toEqual(new Set(['Mua']))

    await page.getByRole('button', { name: 'Bỏ lọc' }).click()
    await expect.poll(() => rowCount(page)).toBe(total)
  })

  test('sắp xếp theo Giá BQ tăng rồi giảm', async ({ page }) => {
    const header = detailTable(page).getByRole('columnheader', { name: /Giá BQ/ })
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'ascending')
    const ascending = (await detailTable(page).locator('tbody tr td:nth-child(5)').allInnerTexts()).map(toNumber)
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b))

    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    const descending = (await detailTable(page).locator('tbody tr td:nth-child(5)').allInnerTexts()).map(toNumber)
    expect(descending).toEqual([...descending].sort((a, b) => b - a))
  })

  test('xuất CSV: có BOM, dấu ; và đúng số dòng của bảng đang lọc', async ({ page }) => {
    await selectFilter(page, 'Trạng thái', 'Gồm cả đang chạy')
    const rows = await rowCount(page)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Xuất Excel' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^hieu-qua-thuc-hien-\d{4}-\d{2}-\d{2}\.csv$/)

    const content = await readFile((await download.path())!, 'utf8')
    expect(content.charCodeAt(0)).toBe(0xfeff)
    const lines = content.slice(1).split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(rows + 1)
    expect(lines[0]).toContain('Mã lệnh;')
    // Dòng đầu tiên của file trùng mã lệnh ở dòng đầu của bảng.
    const firstId = await detailTable(page).locator('tbody tr').first().locator('td').first().innerText()
    expect(lines[1].startsWith(firstId.trim())).toBe(true)
  })
})
