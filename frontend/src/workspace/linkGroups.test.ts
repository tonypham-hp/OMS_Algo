import { beforeEach, describe, expect, it } from 'vitest'
import { initialGroups, useWorkspaceStore } from '@/store/workspace.store'
import { changePanelGroup, orderForPanel, symbolForPanel } from './linkGroups'
import type { PanelParams } from './panelTypes'
import { resolveTicketSymbolChange } from './ticketSymbol'

beforeEach(() => useWorkspaceStore.setState({ groups: initialGroups() }))

/** Mã mà từng panel đang thấy, đọc theo đúng cách PanelScope đọc. */
const seen = (panels: Record<string, PanelParams>) =>
  Object.fromEntries(Object.entries(panels).map(([id, params]) => [id, symbolForPanel(params, useWorkspaceStore.getState().groups)]))

describe('nhóm liên kết theo màu', () => {
  const panels: Record<string, PanelParams> = {
    'watchlist-1': { group: '1' },
    'ticket-1': { group: '1' },
    'depth-1': { group: '1' },
    'depth-2': { group: '2' },
    'blotter-9': { group: 'none', symbol: 'VNM' },
  }

  it('chọn mã ở nhóm 1: mọi panel nhóm 1 đổi theo; nhóm 2 và "Không nhóm" giữ nguyên', () => {
    const before = seen(panels)
    useWorkspaceStore.getState().setGroupSymbol('1', 'MWG')
    const after = seen(panels)
    expect(after['watchlist-1']).toBe('MWG')
    expect(after['ticket-1']).toBe('MWG')
    expect(after['depth-1']).toBe('MWG')
    expect(after['depth-2']).toBe(before['depth-2'])
    expect(after['blotter-9']).toBe('VNM')
  })

  it('bấm một lệnh: chỉ Chi tiết lệnh cùng nhóm mở lệnh đó', () => {
    useWorkspaceStore.getState().setGroupOrder('2', 'PO-7')
    const groups = useWorkspaceStore.getState().groups
    expect(orderForPanel({ group: '2' }, groups)).toBe('PO-7')
    expect(orderForPanel({ group: '1' }, groups)).toBeNull()
    expect(orderForPanel({ group: 'none', orderId: 'PO-1' }, groups)).toBe('PO-1')
  })

  it('giá bấm trên sổ lệnh 3 mức chỉ tới phiếu cùng nhóm; nonce tăng cả khi bấm lại cùng giá', () => {
    const { pickGroupPrice } = useWorkspaceStore.getState()
    pickGroupPrice('1', 118_000)
    pickGroupPrice('1', 118_000)
    const groups = useWorkspaceStore.getState().groups
    expect(groups['1'].pickedPrice).toEqual({ price: 118_000, nonce: 2 })
    expect(groups['2'].pickedPrice).toBeNull()
  })

  it('đặt lại cùng mã không tạo trạng thái mới (không vẽ lại panel vô ích)', () => {
    const before = useWorkspaceStore.getState().groups
    useWorkspaceStore.getState().setGroupSymbol('1', before['1'].symbol)
    expect(useWorkspaceStore.getState().groups).toBe(before)
  })

  it('chuyển panel sang "Không nhóm" giữ mã và lệnh đang thấy làm của riêng panel', () => {
    useWorkspaceStore.getState().setGroupSymbol('3', 'SSI')
    useWorkspaceStore.getState().setGroupOrder('3', 'PO-3')
    const next = changePanelGroup({ group: '3' }, 'none', useWorkspaceStore.getState().groups)
    expect(next).toEqual({ group: 'none', symbol: 'SSI', orderId: 'PO-3' })
    useWorkspaceStore.getState().setGroupSymbol('3', 'FPT')
    expect(symbolForPanel(next, useWorkspaceStore.getState().groups)).toBe('SSI')
  })

  it('khôi phục nhóm từ bố cục đã lưu; nhóm thiếu về mặc định', () => {
    useWorkspaceStore.getState().loadGroups({ '2': { symbol: 'TCB', orderId: 'PO-9' } })
    const groups = useWorkspaceStore.getState().groups
    expect(groups['2']).toMatchObject({ symbol: 'TCB', orderId: 'PO-9' })
    expect(groups['1'].symbol).toBe(initialGroups()['1'].symbol)
  })
})

describe('giữ bản nháp trên Phiếu lệnh khi nhóm đổi mã', () => {
  it('phiếu trống: đổi theo nhóm ngay', () => {
    expect(resolveTicketSymbolChange({ current: 'FPT', next: 'HPG', dirty: false, locked: false })).toBe('follow')
  })
  it('đang có bản nháp: hỏi, KHÔNG xóa trắng', () => {
    expect(resolveTicketSymbolChange({ current: 'FPT', next: 'HPG', dirty: true, locked: false })).toBe('ask')
  })
  it('khóa mã: bỏ qua thay đổi của nhóm (kể cả khi có bản nháp)', () => {
    expect(resolveTicketSymbolChange({ current: 'FPT', next: 'HPG', dirty: false, locked: true })).toBe('ignore')
    expect(resolveTicketSymbolChange({ current: 'FPT', next: 'HPG', dirty: true, locked: true })).toBe('ignore')
  })
  it('cùng mã: không làm gì', () => {
    expect(resolveTicketSymbolChange({ current: 'FPT', next: 'FPT', dirty: true, locked: false })).toBe('none')
  })
})
