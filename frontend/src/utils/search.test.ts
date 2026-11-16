import { describe, expect, it } from 'vitest'
import { STRATEGY_TEMPLATES } from '@/config/strategyTemplates'
import { makeOrder } from '@/test/fixtures'
import type { DemoUser } from '@/types'
import { pushRecent, readRecent, RECENT_LIMIT } from './recentItems'
import { buildSearchIndex, scoreText, search, type SearchItem } from './search'
import { getVisibleTemplates } from './strategyTemplates'
import { normalizeVi } from './text'

const CUSTOMER: DemoUser = { username: 'kh01', display_name: 'Khách 1', role: 'CUSTOMER', accounts: ['A1'] }
const OPS: DemoUser = { username: 'ops01', display_name: 'Vận hành', role: 'OPS', accounts: [] }

const ORDERS = [
  makeOrder('PO-1', { account_no: 'A1', symbol: 'HPG', status: 'PAUSED_USER' }),
  makeOrder('PO-2', { account_no: 'A2', symbol: 'FPT', strategy_type: 'VWAP' }),
  makeOrder('PO-3', { account_no: 'A1', symbol: 'MWG', status: 'COMPLETED' }),
]

const index = (user: DemoUser, canDemo = false) =>
  buildSearchIndex({ user, orders: ORDERS, symbols: ['FPT', 'HPG', 'MWG'], templates: getVisibleTemplates(user.role, undefined), canDemo })

const ids = (items: SearchItem[]) => items.map((item) => item.id)
const flat = (sections: ReturnType<typeof search>) => sections.flatMap((section) => section.items)

describe('bỏ dấu', () => {
  it('chuẩn hóa tiếng Việt', () => {
    expect(normalizeVi('Dừng lại')).toBe('dung lai')
    expect(normalizeVi('  ĐẶT   LỆNH ')).toBe('dat lenh')
    expect(normalizeVi('Giá trần')).toBe('gia tran')
  })

  it('"dung lai" khớp lệnh đang dừng lại', () => {
    const results = flat(search(index(CUSTOMER), 'dung lai'))
    expect(ids(results)).toContain('order:PO-1')
  })

  it('"hpg" ra lệnh HPG và mã HPG', () => {
    const sections = search(index(CUSTOMER), 'hpg')
    expect(sections.map((section) => section.group)).toEqual(expect.arrayContaining(['ORDER', 'SYMBOL']))
    expect(ids(flat(sections))).toEqual(expect.arrayContaining(['order:PO-1', 'symbol:HPG:ticket', 'symbol:HPG:book']))
  })

  it('"gia tran" ra thuật ngữ Giá trần', () => {
    expect(ids(flat(search(index(CUSTOMER), 'gia tran')))).toContain('term:ceiling')
  })
})

describe('chấm điểm', () => {
  it('khớp đầu chuỗi cao hơn khớp đầu từ, cao hơn khớp giữa', () => {
    expect(scoreText('Sổ lệnh', 'so')).toBeGreaterThan(scoreText('Mở sổ lệnh', 'so'))
    expect(scoreText('Mở sổ lệnh', 'so')).toBeGreaterThan(scoreText('Bonsoir', 'so'))
    expect(scoreText('Bonsoir', 'so')).toBe(30)
    expect(scoreText('VWAP', 'vwap')).toBe(100)
    expect(scoreText('FPT', 'xyz')).toBe(0)
  })

  it('trong một nhóm, mục khớp đầu chuỗi đứng trước', () => {
    const screens = search(index(OPS), 'so').find((section) => section.group === 'SCREEN')!.items
    expect(screens[0].title).toBe('Sổ lệnh')
  })

  it('câu nhiều từ: mọi từ phải khớp', () => {
    expect(ids(flat(search(index(CUSTOMER), 'hpg tam dung')))).toContain('order:PO-1')
    expect(ids(flat(search(index(CUSTOMER), 'hpg vwap')))).not.toContain('order:PO-1')
  })

  it('câu rỗng không trả kết quả', () => {
    expect(search(index(CUSTOMER), '   ')).toEqual([])
  })
})

describe('lọc theo vai trò', () => {
  it('khách hàng không thấy lệnh của tài khoản khác', () => {
    const items = index(CUSTOMER)
    expect(ids(items)).toContain('order:PO-1')
    expect(ids(items)).not.toContain('order:PO-2')
    expect(ids(flat(search(items, 'fpt')))).not.toContain('order:PO-2')
  })

  it('khách hàng không thấy màn Vận hành, vận hành thì thấy', () => {
    expect(ids(index(CUSTOMER))).not.toContain('screen:/van-hanh')
    expect(ids(index(CUSTOMER))).not.toContain('screen:/cau-hinh')
    expect(flat(search(index(CUSTOMER), 'giam sat')).map((item) => item.title)).not.toContain('Giám sát hệ thống')
    expect(ids(index(OPS))).toContain('screen:/van-hanh')
    expect(ids(index(OPS))).toContain('order:PO-2')
  })

  it('"Chạy Demo" chỉ có khi được phép', () => {
    expect(ids(index(CUSTOMER, false))).not.toContain('action:demo')
    expect(ids(index(OPS, true))).toContain('action:demo')
  })

  it('thao tác "Dùng mẫu" theo mẫu vai trò được thấy', () => {
    const visible = getVisibleTemplates('CUSTOMER', undefined).map((template) => `action:template:${template.id}`)
    const hidden = STRATEGY_TEMPLATES.filter((template) => !visible.includes(`action:template:${template.id}`))
    expect(ids(index(CUSTOMER))).toEqual(expect.arrayContaining(visible))
    for (const template of hidden) expect(ids(index(CUSTOMER))).not.toContain(`action:template:${template.id}`)
  })
})

describe('mở gần đây', () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial }
    return { getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => void (data[key] = value) }
  }

  it('nhớ tối đa 5 mục, mục mới nhất lên đầu, không trùng', () => {
    const storage = memoryStorage()
    const items = index(OPS).slice(0, 7)
    for (const item of items) pushRecent(item, storage)
    pushRecent(items[3], storage)
    const recent = readRecent(storage)
    expect(recent).toHaveLength(RECENT_LIMIT)
    expect(recent[0].id).toBe(items[3].id)
    expect(new Set(recent.map((item) => item.id)).size).toBe(RECENT_LIMIT)
  })

  it('storage lỗi hoặc dữ liệu hỏng: không ném lỗi', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readRecent(broken)).toEqual([])
    expect(() => pushRecent(index(OPS)[0], broken)).not.toThrow()
    expect(readRecent(memoryStorage({ 'oms-palette-recent': '{not json' }))).toEqual([])
  })
})
