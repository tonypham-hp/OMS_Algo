import { describe, expect, it } from 'vitest'
import type { ParentOrderStatus, SessionCode } from '@/types'
import { getAllowedActions, type OrderAction } from './orderActions'

const ALL_STATUSES: ParentOrderStatus[] = [
  'DRAFT',
  'ACTIVE',
  'PARTIALLY_EXECUTED',
  'PAUSED_USER',
  'PAUSED_SYSTEM',
  'CANCEL_PENDING',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]

function allowedStatuses(action: OrderAction, session: SessionCode) {
  return ALL_STATUSES.filter((status) => getAllowedActions(status, session)[action].allowed)
}

describe('bảng hành động trong phiên liên tục', () => {
  it('Sửa: ACTIVE, PARTIALLY_EXECUTED, PAUSED_USER', () => {
    expect(allowedStatuses('edit', 'CONTINUOUS')).toEqual(['ACTIVE', 'PARTIALLY_EXECUTED', 'PAUSED_USER'])
  })

  it('Hủy: mọi trạng thái chưa kết thúc, trừ lệnh đang hủy', () => {
    expect(allowedStatuses('cancel', 'CONTINUOUS')).toEqual([
      'DRAFT',
      'ACTIVE',
      'PARTIALLY_EXECUTED',
      'PAUSED_USER',
      'PAUSED_SYSTEM',
    ])
  })

  it('Tạm dừng: ACTIVE, PARTIALLY_EXECUTED', () => {
    expect(allowedStatuses('pause', 'CONTINUOUS')).toEqual(['ACTIVE', 'PARTIALLY_EXECUTED'])
  })

  it('Tiếp tục: chỉ PAUSED_USER, không gồm PAUSED_SYSTEM', () => {
    expect(allowedStatuses('resume', 'CONTINUOUS')).toEqual(['PAUSED_USER'])
  })
})

describe('PAUSED_SYSTEM do giá ngoài biên độ', () => {
  const OUT_OF_BAND = 'PRICE_OUT_OF_BAND' as const

  it('được Sửa, vẫn được Hủy, không được Tiếp tục hay Tạm dừng', () => {
    const actions = getAllowedActions('PAUSED_SYSTEM', 'CONTINUOUS', OUT_OF_BAND)
    expect(actions.edit.allowed).toBe(true)
    expect(actions.cancel.allowed).toBe(true)
    expect(actions.resume.allowed).toBe(false)
    expect(actions.pause.allowed).toBe(false)
  })

  it('Sửa vẫn bị khóa trong ATO và ATC', () => {
    expect(getAllowedActions('PAUSED_SYSTEM', 'ATO', OUT_OF_BAND).edit.allowed).toBe(false)
    expect(getAllowedActions('PAUSED_SYSTEM', 'ATC', OUT_OF_BAND).edit.reason).toContain('ATC')
  })

  it('PAUSED_SYSTEM vì lý do khác thì không được Sửa', () => {
    expect(getAllowedActions('PAUSED_SYSTEM', 'CONTINUOUS').edit.allowed).toBe(false)
    expect(getAllowedActions('PAUSED_SYSTEM', 'CONTINUOUS', null).edit.allowed).toBe(false)
  })

  it('reason_code còn sót ở trạng thái khác không mở thêm quyền', () => {
    expect(getAllowedActions('COMPLETED', 'CONTINUOUS', OUT_OF_BAND).edit.allowed).toBe(false)
  })
})

describe('khóa theo phiên', () => {
  it.each(['ATO', 'ATC'] as const)('%s khóa Sửa và Hủy, kèm lý do', (session) => {
    expect(allowedStatuses('edit', session)).toEqual([])
    expect(allowedStatuses('cancel', session)).toEqual([])
    expect(getAllowedActions('ACTIVE', session).edit.reason).toContain(session)
  })

  it.each(['ATO', 'ATC'] as const)('%s vẫn cho Tạm dừng và Tiếp tục', (session) => {
    expect(allowedStatuses('pause', session)).toEqual(['ACTIVE', 'PARTIALLY_EXECUTED'])
    expect(allowedStatuses('resume', session)).toEqual(['PAUSED_USER'])
  })

  it.each(['PRE_OPEN', 'LUNCH', 'CLOSED'] as const)('%s không khóa Sửa và Hủy', (session) => {
    expect(getAllowedActions('ACTIVE', session).edit.allowed).toBe(true)
    expect(getAllowedActions('ACTIVE', session).cancel.allowed).toBe(true)
  })
})
