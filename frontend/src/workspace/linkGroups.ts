// Nhóm liên kết theo màu (Đợt 10A): hàm thuần, dùng cho panel, tab và test.
import type { GroupState } from '@/store/workspace.store'
import type { LinkGroup, PanelParams } from './panelTypes'

/** Nhãn chữ luôn đi kèm chấm màu (không chỉ dựa vào màu). */
export const LINK_GROUP_LABELS: Record<LinkGroup, string> = {
  none: 'Không nhóm',
  '1': 'Nhóm 1',
  '2': 'Nhóm 2',
  '3': 'Nhóm 3',
  '4': 'Nhóm 4',
}

/** Lớp token cho chấm (nền) và nhãn (chữ) của từng nhóm. Màu ở src/config/theme.ts (link-1..4), đã kiểm tương phản. */
export const LINK_GROUP_CLASSES: Record<LinkGroup, { dot: string; text: string }> = {
  none: { dot: 'border-border-strong border bg-transparent', text: 'text-muted-foreground' },
  '1': { dot: 'bg-link-1', text: 'text-link-1' },
  '2': { dot: 'bg-link-2', text: 'text-link-2' },
  '3': { dot: 'bg-link-3', text: 'text-link-3' },
  '4': { dot: 'bg-link-4', text: 'text-link-4' },
}

export const LINK_GROUP_OPTIONS: ReadonlyArray<LinkGroup> = ['none', '1', '2', '3', '4']

const FALLBACK_SYMBOL = 'FPT'

/**
 * Mã đang chọn của một panel: panel thuộc nhóm 1–4 dùng mã chung của nhóm; panel "Không nhóm" dùng mã riêng
 * trong params. Đổi mã của nhóm 1 vì vậy chỉ đổi panel nhóm 1.
 */
export function symbolForPanel(params: Pick<PanelParams, 'group' | 'symbol'>, groups: Record<Exclude<LinkGroup, 'none'>, Pick<GroupState, 'symbol'>>): string {
  if (params.group === 'none') return params.symbol ?? FALLBACK_SYMBOL
  return groups[params.group]?.symbol ?? FALLBACK_SYMBOL
}

/** Lệnh đang xem của panel (Chi tiết lệnh): theo nhóm, hoặc riêng của panel "Không nhóm". */
export function orderForPanel(params: Pick<PanelParams, 'group' | 'orderId'>, groups: Record<Exclude<LinkGroup, 'none'>, Pick<GroupState, 'orderId'>>): string | null {
  if (params.group === 'none') return params.orderId ?? null
  return groups[params.group]?.orderId ?? null
}

/** Đổi nhóm của một panel: sang "Không nhóm" thì giữ lại mã/lệnh đang thấy làm mã riêng của panel. */
export function changePanelGroup(
  params: PanelParams,
  next: LinkGroup,
  groups: Record<Exclude<LinkGroup, 'none'>, Pick<GroupState, 'symbol' | 'orderId'>>,
): PanelParams {
  if (next === params.group) return params
  if (next === 'none') return { ...params, group: 'none', symbol: symbolForPanel(params, groups), orderId: orderForPanel(params, groups) }
  return { ...params, group: next }
}
