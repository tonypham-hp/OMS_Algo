import { describe, expect, it } from 'vitest'
import { iso, makeChild, makeExecution, makeOrder, TODAY } from '@/test/fixtures'
import { CSV_BOM, escapeCsvCell, toCsv, toCsvNumber } from './csv'
import { DEFAULT_REPORT_FILTERS, filterReportRows, getExecQuality, sortReportRows } from './execQuality'
import { buildReportCsv } from './reportCsv'

const parse = (csv: string) => csv.slice(1).trimEnd().split('\r\n').map((line) => line.split(';'))

describe('toCsv', () => {
  it('bắt đầu bằng BOM, ngăn cột bằng ";", xuống dòng \\r\\n', () => {
    const csv = toCsv(['Mã', 'Giá'], [['FPT', '118000,5']])
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toBe(`${CSV_BOM}Mã;Giá\r\nFPT;118000,5\r\n`)
  })

  it('escape ô có dấu ";", ngoặc kép, xuống dòng; null là ô trống', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"')
    expect(escapeCsvCell('nói "có"')).toBe('"nói ""có"""')
    expect(escapeCsvCell('dòng 1\ndòng 2')).toBe('"dòng 1\ndòng 2"')
    expect(escapeCsvCell(null)).toBe('')
  })

  it('số dùng dấu phẩy thập phân, không phân cách hàng nghìn', () => {
    expect(toCsvNumber(-0.129729)).toBe('-0,13')
    expect(toCsvNumber(118_400, 0)).toBe('118400')
    expect(toCsvNumber(null)).toBeNull()
    expect(toCsvNumber(Number.NaN)).toBeNull()
  })
})

describe('buildReportCsv', () => {
  const snapshot = { arrival_price: 100_000, arrival_bid: 100_000, arrival_ask: 100_000, arrival_timestamp: iso(TODAY, '09:30:00') }
  const make = (id: string, status: 'COMPLETED' | 'ACTIVE', price: number | null) => {
    const order = makeOrder(id, { status, updated_at: iso(TODAY, '11:00:00') })
    const fills = price === null ? [] : [makeExecution(`X-${id}`, `${id}1`, id, 1_000, price)]
    return getExecQuality(order, [makeChild(`${id}1`, id)], fills, snapshot, { volume: 40_000, value: 4_000_000_000 })
  }
  const rows = [make('PO-1', 'COMPLETED', 99_870), make('PO-2', 'COMPLETED', null), make('PO-3', 'ACTIVE', 100_100)]

  it('đúng thứ tự cột của bảng, đúng số dòng theo bộ lọc', () => {
    const shown = filterReportRows(rows, DEFAULT_REPORT_FILTERS, TODAY)
    const lines = parse(buildReportCsv(shown))
    expect(lines[0]).toEqual([
      'Mã lệnh',
      'Mã CK',
      'Chiều',
      'Chiến lược',
      'Giá BQ',
      'Arrival',
      'VWAP',
      'So arrival (%)',
      'So VWAP (%)',
      'Tham gia (%)',
    ])
    expect(lines).toHaveLength(shown.length + 1)
    expect(lines[1]).toEqual(['PO-1', 'FPT', 'Mua', 'Iceberg', '99870,00', '100000', '100000,00', '-0,13', '-0,13', '2,50'])
    // Lệnh chưa khớp: các ô chỉ số để trống, không ghi NaN.
    expect(lines[2]).toEqual(['PO-2', 'FPT', 'Mua', 'Iceberg', '', '100000', '100000,00', '', '', ''])
  })

  it('theo thứ tự dòng đang sắp xếp và gồm cả lệnh đang chạy khi chọn', () => {
    const shown = sortReportRows(
      filterReportRows(rows, { ...DEFAULT_REPORT_FILTERS, status: 'COMPLETED_AND_LIVE' }, TODAY),
      'parent_order_id',
      'desc',
    )
    expect(parse(buildReportCsv(shown)).slice(1).map((line) => line[0])).toEqual(['PO-3', 'PO-2', 'PO-1'])
  })
})
