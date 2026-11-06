import { describe, expect, it } from 'vitest'
import type { Notification, NotificationType } from '@/types'
import { getPauseReason } from './pauseReason'

const notification = (notification_type: NotificationType, message: string): Notification => ({
  notification_type,
  parent_order_id: 'PO-1',
  message,
  sent_at: '2026-11-09T09:10:00',
})

describe('lý do tạm dừng', () => {
  it('không có thông báo thì trả về null', () => {
    expect(getPauseReason([])).toBeNull()
    expect(getPauseReason([notification('PARENT_ACTIVATED', 'kích hoạt')])).toBeNull()
  })

  it('lấy thông báo tạm dừng mới nhất, bỏ qua loại khác', () => {
    expect(
      getPauseReason([
        notification('PARENT_PAUSED', 'lần đầu'),
        notification('PARENT_PAUSED', 'lần sau'),
        notification('CHILD_REJECTED', 'lệnh con bị từ chối'),
      ]),
    ).toBe('lần sau')
  })
})
