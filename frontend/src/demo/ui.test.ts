import { describe, expect, it } from 'vitest'
import { CSV_BOM } from '@/utils/csv'
import { canUseDemo } from './access'
import { createDemoEnv } from './env'
import { EDGE_MARGIN, placeController } from './position'
import { buildResultCsv, formatSimElapsed, RESULT_CSV_HEADERS } from './resultCsv'
import { createRunner } from './runner'
import { SCENARIOS } from './scenarios'

describe('ai thấy nút Demo', () => {
  it('vận hành luôn thấy; vai trò khác chỉ khi VITE_DEMO_MODE=true; chưa đăng nhập thì không', () => {
    expect(canUseDemo('OPS', undefined)).toBe(true)
    expect(canUseDemo('CUSTOMER', undefined)).toBe(false)
    expect(canUseDemo('DEALER', 'false')).toBe(false)
    expect(canUseDemo('CUSTOMER', 'true')).toBe(true)
    expect(canUseDemo(undefined, 'true')).toBe(false)
  })
})

describe('vị trí khung điều khiển khi kéo', () => {
  const viewport = { width: 1440, height: 900 }
  const box = { width: 640, height: 220 }

  it('giữ trọn trong khung nhìn và dưới thanh trên', () => {
    expect(placeController({ ...box, x: -500, y: 400 }, viewport, 56).x).toBe(EDGE_MARGIN)
    expect(placeController({ ...box, x: 400, y: -50 }, viewport, 56).y).toBeGreaterThanOrEqual(56)
  })

  it('thả gần góc thì bám góc; thả giữa màn thì giữ nguyên chỗ', () => {
    expect(placeController({ ...box, x: 1440 - 640 - 40, y: 900 - 220 - 30 }, viewport, 56)).toEqual({
      x: 1440 - 640 - EDGE_MARGIN,
      y: 900 - 220 - EDGE_MARGIN,
    })
    expect(placeController({ ...box, x: 50, y: 100 }, viewport, 56)).toEqual({ x: EDGE_MARGIN, y: 56 + EDGE_MARGIN })
    expect(placeController({ ...box, x: 400, y: 330 }, viewport, 56)).toEqual({ x: 400, y: 330 })
  })
})

describe('xuất kết quả Demo', () => {
  it('CSV có BOM, đúng cột, mỗi điều kiện của từng bước một dòng, thêm các quy tắc chung', () => {
    const runner = createRunner({ scenario: SCENARIOS[4], env: createDemoEnv() })
    runner.runToEnd()
    const result = runner.getResult()
    const general = runner.getSnapshot().checks.filter((check) => check.stepIndex === null)
    const csv = buildResultCsv(result, general)
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toBe(RESULT_CSV_HEADERS.join(';'))
    const stepChecks = result.rows.reduce((sum, row) => sum + row.checks.length, 0)
    expect(lines).toHaveLength(1 + stepChecks + general.length)
    expect(lines.slice(1).every((line) => line.includes('ĐẠT'))).toBe(true)
    expect(lines.at(-1)).toContain('Mọi bước')
  })

  it('thời gian giả lập hiển thị hh:mm:ss', () => {
    expect(formatSimElapsed(125)).toBe('00:02:05')
    expect(formatSimElapsed(-3)).toBe('00:00:00')
  })
})
