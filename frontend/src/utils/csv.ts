// Xuất CSV cho Excel tiếng Việt, không dùng thư viện.
// Excel đọc UTF-8 đúng dấu tiếng Việt khi file bắt đầu bằng BOM. Máy cài vùng Việt Nam dùng dấu phẩy thập phân
// và dấu chấm phẩy ngăn cột, nên mặc định ngăn cột bằng ";". Không ghi dòng "sep=;" vì có dòng đó Excel bỏ qua BOM.

export const CSV_BOM = '﻿'
export const CSV_DELIMITER = ';'

export type CsvCell = string | number | null

/** Bọc ngoặc kép khi ô chứa dấu ngăn cột, ngoặc kép hoặc xuống dòng; ngoặc kép bên trong nhân đôi (RFC 4180). */
export function escapeCsvCell(value: CsvCell, delimiter = CSV_DELIMITER): string {
  if (value === null) return ''
  const text = String(value)
  return text.includes(delimiter) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Nội dung CSV: BOM, dòng tiêu đề, rồi từng dòng dữ liệu; xuống dòng kiểu \r\n. */
export function toCsv(headers: string[], rows: CsvCell[][], delimiter = CSV_DELIMITER): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter))
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`
}

/** Số cho Excel tiếng Việt: dấu phẩy thập phân, không phân cách hàng nghìn. null → ô trống. */
export function toCsvNumber(value: number | null, fractionDigits = 2): string | null {
  if (value === null || !Number.isFinite(value)) return null
  return value.toFixed(fractionDigits).replace('.', ',')
}

/** Tải file về máy bằng Blob và thẻ <a download>. */
export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
