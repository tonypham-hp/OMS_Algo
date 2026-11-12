import { formatClock } from '@/lib/format'
import { toCsv, type CsvCell } from '@/utils/csv'
import type { CheckView, DemoResult } from './runner'

export const RESULT_CSV_HEADERS = ['Kịch bản', 'Bước', 'Chú thích', 'Điều kiện', 'Kết quả', 'Giờ giả lập']

const STATUS_TEXT = { pass: 'ĐẠT', fail: 'KHÔNG ĐẠT', pending: 'CHỜ' } as const

/** "02:05" → thời gian giả lập đã chạy, dạng hh:mm:ss. */
export function formatSimElapsed(seconds: number) {
  return formatClock(Math.max(0, seconds))
}

/**
 * Kết quả một kịch bản ra CSV (UTF-8 có BOM, mở được bằng Excel tiếng Việt):
 * mỗi điều kiện của từng bước một dòng, lỗi khi chạy bước (nếu có) một dòng, rồi các quy tắc chung.
 */
export function buildResultCsv(result: DemoResult, generalChecks: CheckView[]): string {
  const scenario = result.title
  const rows: CsvCell[][] = []
  for (const row of result.rows) {
    for (const check of row.checks) {
      rows.push([scenario, row.stepIndex + 1, row.caption, check.label, check.passed ? 'ĐẠT' : 'KHÔNG ĐẠT', row.simTime])
    }
    if (row.error) rows.push([scenario, row.stepIndex + 1, row.caption, `Lỗi khi chạy bước: ${row.error}`, 'KHÔNG ĐẠT', row.simTime])
  }
  const lastTime = result.rows.at(-1)?.simTime ?? ''
  for (const check of generalChecks) {
    rows.push([scenario, 'Mọi bước', 'Quy tắc lõi', check.label, STATUS_TEXT[check.status], lastTime])
  }
  return toCsv(RESULT_CSV_HEADERS, rows)
}

/** "demo-scenario-5-ket-qua.csv" */
export function getResultFilename(scenarioNumber: number | null) {
  return `demo-scenario-${scenarioNumber ?? 'x'}-ket-qua.csv`
}
