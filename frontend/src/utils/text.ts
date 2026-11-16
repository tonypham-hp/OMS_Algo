/**
 * Chuẩn hóa để tìm không dấu: bỏ dấu tiếng Việt (kể cả đ → d), chữ thường, gộp khoảng trắng.
 * "Dừng lại" → "dung lai", "ĐẶT LỆNH" → "dat lenh".
 */
export function normalizeVi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
