import { describe, expect, it } from 'vitest'
import { FIELD_TERMS, GLOSSARY, getGlossaryEntry, REPORT_COLUMN_TERMS, STRATEGY_TERMS } from './glossary'

/** Mã nguồn dạng chữ của mọi file .tsx (trừ test), đọc qua Vite để không cần kiểu của Node trong tsconfig app. */
const SOURCES = import.meta.glob(['/src/**/*.tsx', '!/src/**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

/** Thuật ngữ tối thiểu theo yêu cầu Đợt 5. */
const REQUIRED = [
  'arrival', 'vwap', 'twap', 'pov', 'iceberg', 'hunt', 'stop', 'stop-limit', 'take-profit', 'trailing-stop', 'oco', 'bracket',
  'slippage', 'participation', 'bps', 'parent-order', 'child-order', 'unknown', 'reconciliation', 'ato', 'atc', 'mtl', 'lo',
  'ceiling', 'floor', 'ref-price', 'tick-size', 'lot', 'paused-system', 'persistence-mode',
]

describe('từ điển thuật ngữ', () => {
  it('có đủ các thuật ngữ bắt buộc, mỗi mục có nghĩa ngắn và giải thích', () => {
    for (const id of REQUIRED) expect(getGlossaryEntry(id), id).toBeDefined()
    for (const entry of GLOSSARY) {
      expect(entry.short.length, entry.id).toBeGreaterThan(10)
      expect(entry.detail.length, entry.id).toBeGreaterThan(10)
    }
  })

  it('mã thuật ngữ không trùng', () => {
    expect(new Set(GLOSSARY.map((entry) => entry.id)).size).toBe(GLOSSARY.length)
  })

  it('mọi <Term id="…"> trong mã nguồn đều có trong từ điển', () => {
    const used = new Map<string, string>()
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50)
    for (const [file, source] of Object.entries(SOURCES)) {
      for (const match of source.matchAll(/<Term\s+id="([^"]+)"/g)) used.set(match[1], file)
    }
    // Kiểm tra phép quét có chạy: hiện có ít nhất 8 mã viết thẳng (mã động nằm ở test bên dưới).
    expect(used.size).toBeGreaterThanOrEqual(8)
    for (const [id, file] of used) expect(getGlossaryEntry(id), `${id} ở ${file}`).toBeDefined()
  })

  it('các bảng mã thuật ngữ dùng động (loại lệnh, ô tham số, cột báo cáo) đều có trong từ điển', () => {
    for (const id of [...Object.values(STRATEGY_TERMS), ...Object.values(FIELD_TERMS), ...Object.values(REPORT_COLUMN_TERMS)]) {
      expect(getGlossaryEntry(id!), id).toBeDefined()
    }
  })

  it('ví dụ dùng số của lệnh đang xem, thiếu số thì không có ví dụ', () => {
    const ceiling = getGlossaryEntry('ceiling')!
    expect(ceiling.example?.({ symbol: 'FPT', ref_price: 128_500 })).toBe('FPT hôm nay: tham chiếu 128.500 → trần 137.400.')
    expect(ceiling.example?.({})).toBeNull()
    expect(getGlossaryEntry('tick-size')!.example?.({ limit_price: 27_550 })).toBe('Giá 27.550 có bước giá 50 đ.')
  })
})
