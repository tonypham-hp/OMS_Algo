import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { toCsv, toCsvNumber, type CsvCell } from './csv'
import { REPORT_COLUMNS, type ExecQualityRow, type ReportSortKey } from './execQuality'

/** Tiêu đề cột trong file: như bảng, cột tỷ lệ ghi rõ đơn vị %. */
const CSV_LABELS: Partial<Record<ReportSortKey, string>> = {
  vsArrivalPct: 'So arrival (%)',
  vsVwapPct: 'So VWAP (%)',
  participation: 'Tham gia (%)',
}

function toCell(row: ExecQualityRow, key: ReportSortKey): CsvCell {
  switch (key) {
    case 'parent_order_id':
    case 'symbol':
      return row.order[key]
    case 'side':
      return SIDE_LABELS[row.order.side]
    case 'strategy_type':
      return row.templateName
        ? `${STRATEGIES[row.order.strategy_type].label} (mẫu: ${row.templateName})`
        : STRATEGIES[row.order.strategy_type].label
    case 'avgPrice':
    case 'vwap':
      return toCsvNumber(row[key])
    case 'arrivalPrice':
      return toCsvNumber(row.arrivalPrice, 0)
    case 'vsArrivalPct':
    case 'vsVwapPct':
      return toCsvNumber(row[key])
    case 'participation':
      return toCsvNumber(row.participation === null ? null : row.participation * 100)
  }
}

/** CSV đúng các cột và đúng thứ tự dòng của bảng đang hiển thị (đã lọc, đã sắp xếp). */
export function buildReportCsv(rows: ExecQualityRow[]): string {
  return toCsv(
    REPORT_COLUMNS.map((column) => CSV_LABELS[column.key] ?? column.label),
    rows.map((row) => REPORT_COLUMNS.map((column) => toCell(row, column.key))),
  )
}

/** "hieu-qua-thuc-hien-2026-11-11.csv" */
export function getReportFilename(tradingDate: string): string {
  return `hieu-qua-thuc-hien-${tradingDate}.csv`
}
