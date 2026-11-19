import { STO_EXPERIMENTAL_NO_LUNCH } from './packs/experimental-no-lunch'
import { STO_KRX_2025 } from './packs/sto-krx-2025'
import { STX_KRX_2025 } from './packs/stx-krx-2025'
import { UPX_KRX_2025 } from './packs/upx-krx-2025'
import type { Board, RulePack } from './types'

/** Mọi pack có hiệu lực theo ngày. Thêm luật mới (đổi giờ, đổi biên) là thêm một pack vào đây. */
const PACKS: readonly RulePack[] = [STO_KRX_2025, STX_KRX_2025, UPX_KRX_2025]
/** Pack thử nghiệm: chỉ dùng khi được nạp ở trang Luật giao dịch. */
const EXPERIMENTAL_PACKS: readonly RulePack[] = [STO_EXPERIMENTAL_NO_LUNCH]

let experimental: RulePack | null = null
const listeners = new Set<() => void>()

export function listPacks(): RulePack[] {
  return [...PACKS, ...EXPERIMENTAL_PACKS]
}

export function getPack(id: string): RulePack | undefined {
  return listPacks().find((pack) => pack.id === id)
}

function isEffective(pack: RulePack, date: string) {
  return pack.effectiveFrom <= date && (pack.effectiveTo === undefined || date <= pack.effectiveTo)
}

/**
 * Pack của bảng `board` có hiệu lực ngày `simDate`. Có pack thử nghiệm đang nạp cho bảng đó thì dùng nó.
 * Trả về null khi bảng không có pack nào hiệu lực ngày đó (ví dụ STX sau 23/12/2026).
 */
export function resolveRules(board: Board, simDate: string): RulePack | null {
  if (experimental && experimental.board === board) return experimental
  const candidates = PACKS.filter((pack) => pack.board === board && isEffective(pack, simDate))
  // Nhiều pack cùng hiệu lực: pack bắt đầu muộn nhất thắng (luật mới đè luật cũ).
  return candidates.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null
}

/**
 * Như resolveRules nhưng luôn có kết quả: không có pack hiệu lực thì lấy pack gần nhất của bảng.
 * Dùng ở chỗ chỉ cần số để hiển thị (đồng hồ, câu giải thích), không dùng để kiểm tra lệnh.
 */
export function rulesFor(board: Board, simDate: string): RulePack {
  const exact = resolveRules(board, simDate)
  if (exact) return exact
  const ofBoard = PACKS.filter((pack) => pack.board === board).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  return ofBoard[0] ?? STO_KRX_2025
}

/** Luật HOSE mặc định, cho những chỗ chưa biết mã hay ngày (đồng hồ phiên chung, câu chữ trong thuật ngữ). */
export function defaultRules(): RulePack {
  return experimental && experimental.board === 'STO' ? experimental : STO_KRX_2025
}

/** Nạp pack thử nghiệm (đè pack theo ngày của bảng đó), hoặc null để bỏ. */
export function setExperimentalPack(id: string | null): RulePack | null {
  const pack = id === null ? null : (EXPERIMENTAL_PACKS.find((item) => item.id === id) ?? null)
  if (id !== null && !pack) throw new Error(`Không có pack thử nghiệm ${id}`)
  experimental = pack
  listeners.forEach((listener) => listener())
  return pack
}

export function getExperimentalPack(): RulePack | null {
  return experimental
}

/** Nghe khi pack thử nghiệm đổi. Trả về hàm hủy. */
export function subscribeRules(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
