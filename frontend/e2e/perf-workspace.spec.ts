import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, loginAs, navigate, test } from './fixtures'

/**
 * Đo hiệu năng Bàn làm việc (Đợt 10A), không nằm trong test:all; chạy bằng `npm run perf:workspace`.
 * Bố cục Chuyên nghiệp (7 panel), giá tua x60, đo 30 giây thật:
 * - long-animation-frame (LoAF) > 50 ms: số lần, dài nhất;
 * - khoảng cách giữa các khung hình (requestAnimationFrame): trung vị, p95, lớn nhất.
 * Kết quả in ra console và ghi test-results/perf-workspace.json để chép vào docs/quality-report.md.
 */
const MEASURE_MS = 30_000

test('Bàn làm việc Chuyên nghiệp, giá x60: không có khung hình > 50 ms kéo dài', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  await loginAs(page, 'OPS')
  await navigate(page, '/ban-lam-viec')
  await expect(page.locator('[data-ws-panel]')).toHaveCount(6)
  await page.getByRole('group', { name: 'Tốc độ giả lập' }).getByRole('button', { name: 'x60', exact: true }).click()

  await page.evaluate(() => {
    const store = { loaf: [] as number[], frames: [] as number[] }
    ;(window as unknown as { __perf: typeof store }).__perf = store
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) store.loaf.push(entry.duration)
      }).observe({ type: 'long-animation-frame', buffered: false })
    } catch {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) store.loaf.push(entry.duration)
      }).observe({ type: 'longtask', buffered: false })
    }
    let last = performance.now()
    const loop = (now: number) => {
      store.frames.push(now - last)
      last = now
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
  // Đồng hồ trình duyệt chạy theo thời gian thật trong lúc đo (bộ giả lập tick mỗi giây, mỗi tick = 60 giây giả lập).
  await page.waitForTimeout(MEASURE_MS)

  const raw = await page.evaluate(() => (window as unknown as { __perf: { loaf: number[]; frames: number[] } }).__perf)
  const sorted = [...raw.frames].sort((a, b) => a - b)
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
  const long = raw.loaf.filter((duration) => duration > 50)
  const result = {
    measuredSeconds: MEASURE_MS / 1000,
    project: testInfo.project.name,
    frames: raw.frames.length,
    frameMedianMs: Number(pick(0.5).toFixed(1)),
    frameP95Ms: Number(pick(0.95).toFixed(1)),
    frameMaxMs: Number((sorted.at(-1) ?? 0).toFixed(1)),
    longFramesOver50ms: long.length,
    longestLongFrameMs: Number((Math.max(0, ...raw.loaf)).toFixed(1)),
  }
  console.log('PERF', JSON.stringify(result))
  writeFileSync(join(testInfo.project.outputDir, 'perf-workspace.json'), JSON.stringify(result, null, 2))
  // "Không có frame > 50 ms kéo dài": cho phép vài khung hình dài lẻ tẻ (đổi phiên, GC), không cho kéo dài.
  expect(result.frameP95Ms).toBeLessThan(50)
  expect(result.longFramesOver50ms).toBeLessThanOrEqual(5)
})
