import { GLOSSARY } from '@/config/glossary'
import { getNavSections } from '@/config/navigation'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { ROLE_PERMISSIONS } from '@/config/permissions'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import type { StrategyTemplate } from '@/config/strategyTemplates'
import { formatNumber } from '@/lib/format'
import { canSeeOrder } from '@/mocks/access'
import type { DemoUser, ParentOrder, ParentOrderStatus } from '@/types'
import { normalizeVi } from './text'

export type SearchGroup = 'ORDER' | 'SYMBOL' | 'SCREEN' | 'ACTION' | 'TERM'

/** Thứ tự nhóm trong hộp tìm. */
export const SEARCH_GROUPS: ReadonlyArray<SearchGroup> = ['ORDER', 'SYMBOL', 'SCREEN', 'ACTION', 'TERM']

export const SEARCH_GROUP_LABELS: Record<SearchGroup, string> = {
  ORDER: 'Lệnh',
  SYMBOL: 'Mã chứng khoán',
  SCREEN: 'Màn hình',
  ACTION: 'Thao tác',
  TERM: 'Thuật ngữ',
}

/** Mở một kết quả: điều hướng (kèm mã CK cần chọn, phần tử cần cuộn tới) hoặc mở hộp chọn kịch bản Demo. */
export type SearchTarget = { kind: 'navigate'; path: string; symbol?: string; scrollTo?: string } | { kind: 'demo' }

export interface SearchItem {
  /** Duy nhất trong chỉ mục, cũng là khóa lưu "mở gần đây". */
  id: string
  group: SearchGroup
  title: string
  subtitle?: string
  /** Các chuỗi được tìm, ngoài tiêu đề. */
  keywords: string[]
  target: SearchTarget
}

export interface SearchResult extends SearchItem {
  score: number
}

export interface SearchSection {
  group: SearchGroup
  label: string
  items: SearchResult[]
}

/** Từ khóa thêm cho trạng thái, để người dùng gõ cách nói thường ngày vẫn ra ("dừng lại" → lệnh tạm dừng). */
const STATUS_KEYWORDS: Partial<Record<ParentOrderStatus, string[]>> = {
  PAUSED_USER: ['dừng lại', 'tạm dừng'],
  PAUSED_SYSTEM: ['dừng lại', 'tạm dừng', 'hệ thống dừng'],
  CANCEL_PENDING: ['hủy'],
  CANCELLED: ['hủy'],
  EXPIRED: ['hết hạn', 'hết hiệu lực'],
  COMPLETED: ['xong', 'khớp đủ'],
  ACTIVE: ['đang chạy'],
  PARTIALLY_EXECUTED: ['đang chạy'],
}

export interface SearchIndexInput {
  user: DemoUser
  orders: ParentOrder[]
  symbols: string[]
  templates: StrategyTemplate[]
  /** Vai trò này có được chạy Chế độ Demo không (canUseDemo). */
  canDemo: boolean
}

/** Dựng chỉ mục tìm kiếm, đã lọc theo quyền của người dùng. Hàm thuần. */
export function buildSearchIndex({ user, orders, symbols, templates, canDemo }: SearchIndexInput): SearchItem[] {
  const permissions = ROLE_PERMISSIONS[user.role]
  const canPlace = permissions.includes('place_order')
  const canBook = permissions.includes('order_book')
  const items: SearchItem[] = []

  if (canBook) {
    for (const order of orders) {
      if (!canSeeOrder(user, order)) continue
      const status = PARENT_STATUS_STYLES[order.status].label
      const strategy = STRATEGIES[order.strategy_type].label
      items.push({
        id: `order:${order.parent_order_id}`,
        group: 'ORDER',
        title: `${order.parent_order_id} · ${order.symbol}`,
        subtitle: `${SIDE_LABELS[order.side]} ${strategy} · ${status} · ${formatNumber(order.executed_qty)}/${formatNumber(order.total_qty)} CP`,
        keywords: [
          order.parent_order_id,
          order.symbol,
          strategy,
          order.strategy_type,
          status,
          order.status,
          ...(STATUS_KEYWORDS[order.status] ?? []),
          ...(user.role === 'CUSTOMER' ? [] : [order.account_no]),
        ],
        target: { kind: 'navigate', path: `/so-lenh/${order.parent_order_id}` },
      })
    }
  }

  if (canPlace) {
    for (const symbol of symbols) {
      items.push({
        id: `symbol:${symbol}:ticket`,
        group: 'SYMBOL',
        title: symbol,
        subtitle: 'Mở Đặt lệnh với mã này',
        keywords: [symbol, 'đặt lệnh'],
        target: { kind: 'navigate', path: '/dat-lenh', symbol },
      })
      items.push({
        id: `symbol:${symbol}:book`,
        group: 'SYMBOL',
        title: `${symbol} · Sổ lệnh 3 mức`,
        subtitle: 'Xem 3 mức giá mua, bán tốt nhất',
        keywords: [symbol, 'sổ lệnh', 'độ sâu'],
        target: { kind: 'navigate', path: '/dat-lenh', symbol, scrollTo: 'orderbook3' },
      })
    }
  }

  for (const section of getNavSections(user.role)) {
    for (const item of section.items) {
      if (item.comingSoon || !item.path) continue
      items.push({
        id: `screen:${item.path}`,
        group: 'SCREEN',
        title: item.label,
        subtitle: section.title ?? undefined,
        keywords: [item.label, section.title ?? '', item.path],
        target: { kind: 'navigate', path: item.path },
      })
    }
  }
  items.push({
    id: 'screen:/thuat-ngu',
    group: 'SCREEN',
    title: 'Thuật ngữ',
    subtitle: 'Tra cứu',
    keywords: ['thuật ngữ', 'từ điển', 'glossary'],
    target: { kind: 'navigate', path: '/thuat-ngu' },
  })

  if (canPlace) {
    items.push({
      id: 'action:new-order',
      group: 'ACTION',
      title: 'Đặt lệnh mới',
      keywords: ['đặt lệnh', 'lệnh mới', 'mua', 'bán'],
      target: { kind: 'navigate', path: '/dat-lenh' },
    })
    for (const template of templates) {
      items.push({
        id: `action:template:${template.id}`,
        group: 'ACTION',
        title: `Dùng mẫu ${template.name}`,
        subtitle: STRATEGIES[template.strategy_type].label,
        keywords: [template.name, 'mẫu', STRATEGIES[template.strategy_type].label],
        target: { kind: 'navigate', path: `/dat-lenh?mau=${template.id}` },
      })
    }
  }
  if (canDemo) {
    items.push({
      id: 'action:demo',
      group: 'ACTION',
      title: 'Chạy Demo',
      subtitle: 'Chọn kịch bản trình diễn',
      keywords: ['demo', 'kịch bản', 'trình diễn'],
      target: { kind: 'demo' },
    })
  }

  for (const entry of GLOSSARY) {
    items.push({
      id: `term:${entry.id}`,
      group: 'TERM',
      title: entry.term,
      subtitle: entry.short,
      keywords: [entry.term, entry.id],
      target: { kind: 'navigate', path: `/thuat-ngu?q=${encodeURIComponent(entry.term)}` },
    })
  }

  return items
}

/**
 * Điểm khớp của một chuỗi với câu tìm (cả hai đã bỏ dấu). 0 là không khớp.
 * Khớp cả chuỗi 100, đầu chuỗi 80, đầu một từ 60, nằm giữa 30.
 */
export function scoreText(text: string, query: string): number {
  if (query === '') return 0
  const value = normalizeVi(text)
  if (value === query) return 100
  if (value.startsWith(query)) return 80
  if (value.includes(` ${query}`) || value.includes(`-${query}`) || value.includes(`·${query}`)) return 60
  if (value.includes(query)) return 30
  return 0
}

/** Điểm của một mục: tiêu đề nặng hơn từ khóa; câu nhiều từ thì mọi từ phải khớp ở đâu đó. */
export function scoreItem(item: SearchItem, rawQuery: string): number {
  const query = normalizeVi(rawQuery)
  if (query === '') return 0
  const fields = [item.title, ...item.keywords]
  const whole = Math.max(scoreText(item.title, query) + 5, ...item.keywords.map((keyword) => scoreText(keyword, query)))
  if (whole > 5) return whole
  const tokens = query.split(' ')
  if (tokens.length < 2) return 0
  let total = 0
  for (const token of tokens) {
    const best = Math.max(...fields.map((field) => scoreText(field, token)))
    if (best === 0) return 0
    total += best
  }
  return Math.round(total / tokens.length / 2)
}

/** Tìm trong chỉ mục: nhóm theo loại, trong nhóm xếp điểm cao trước, mỗi nhóm tối đa `perGroup` mục. */
export function search(items: SearchItem[], query: string, perGroup = 5): SearchSection[] {
  const scored = items
    .map((item) => ({ ...item, score: scoreItem(item, query) }))
    .filter((item) => item.score > 0)
  return SEARCH_GROUPS.map((group) => ({
    group,
    label: SEARCH_GROUP_LABELS[group],
    items: scored
      .filter((item) => item.group === group)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'vi'))
      .slice(0, perGroup),
  })).filter((section) => section.items.length > 0)
}
