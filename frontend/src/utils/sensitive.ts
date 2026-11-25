/** Ký tự che khi trình chiếu (Cài đặt › Ẩn số tiền và bps). */
export const MASK = '•••'

/** Che giữa số tài khoản, giữ 4 ký tự đầu và 3 ký tự cuối: 058C123456 → 058C•••456. Chuỗi quá ngắn thì che hết. */
export function maskAccount(account: string): string {
  if (account.length <= 7) return MASK
  return `${account.slice(0, 4)}${MASK}${account.slice(-3)}`
}
