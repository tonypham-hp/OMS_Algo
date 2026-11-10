import { describe, expect, it } from 'vitest'
import { iso, makeEvent, TODAY } from '@/test/fixtures'
import { useNotificationStore } from '@/store/notification.store'
import {
  countUnread,
  EMPTY_FEED,
  markAllRead,
  markRead,
  mergeNotifications,
  toNotification,
} from './notifications'

describe('toNotification', () => {
  it('ánh xạ OrderEvent sang đúng loại Notification trong spec', () => {
    const cases = [
      [makeEvent({ action: 'CREATE', new_value: 'ACTIVE' }), 'PARENT_ACTIVATED'],
      [makeEvent({ action: 'TRIGGER', old_value: 'CONDITION:STOP:ACTIVE', new_value: 'TRIGGERED' }), 'CONDITION_TRIGGERED'],
      [makeEvent({ action: 'REJECT', child_order_id: 'CO-1', old_value: 'SENDING', new_value: 'REJECTED' }), 'CHILD_REJECTED'],
      [makeEvent({ action: 'PAUSE', old_value: 'ACTIVE', new_value: 'PAUSED_SYSTEM' }), 'PARENT_PAUSED'],
      [makeEvent({ action: 'DECISION', old_value: 'PARTIALLY_EXECUTED', new_value: 'COMPLETED' }), 'PARENT_COMPLETED'],
      [makeEvent({ action: 'CANCEL', old_value: 'CANCEL_PENDING', new_value: 'CANCELLED' }), 'PARENT_CANCELLED'],
      [makeEvent({ action: 'DECISION', old_value: 'ACTIVE', new_value: 'EXPIRED' }), 'PARENT_EXPIRED'],
    ] as const
    for (const [event, type] of cases) expect(toNotification(event)?.notification_type).toBe(type)
  })

  it('bỏ qua event không thuộc loại nào: tạm dừng bởi người dùng, hủy điều kiện OCO, lệnh con khớp', () => {
    expect(toNotification(makeEvent({ action: 'PAUSE', old_value: 'ACTIVE', new_value: 'PAUSED_USER' }))).toBeNull()
    expect(
      toNotification(makeEvent({ action: 'CANCEL', old_value: 'CONDITION:TAKE_PROFIT:ACTIVE', new_value: 'CANCELLED' })),
    ).toBeNull()
    expect(
      toNotification(makeEvent({ action: 'CANCEL', child_order_id: 'CO-1', old_value: 'ACKNOWLEDGED', new_value: 'CANCELLED' })),
    ).toBeNull()
    expect(toNotification(makeEvent({ action: 'FILL', child_order_id: 'CO-1', new_value: 'FILLED' }))).toBeNull()
  })

  it('nội dung tiếng Việt có mã lệnh', () => {
    const event = makeEvent({ action: 'TRIGGER', parent_order_id: 'PO-9', old_value: 'CONDITION:STOP:ACTIVE' })
    expect(toNotification(event)?.message).toBe('Lệnh PO-9: điều kiện Stop đã kích hoạt')
  })
})

describe('mergeNotifications', () => {
  const created = makeEvent({ action: 'CREATE', new_value: 'ACTIVE', event_time: iso(TODAY, '09:15:00') })
  const fill = makeEvent({ action: 'FILL', child_order_id: 'CO-1', event_time: iso(TODAY, '09:16:00') })
  const paused = makeEvent({ action: 'PAUSE', old_value: 'ACTIVE', new_value: 'PAUSED_SYSTEM', event_time: iso(TODAY, '09:17:00') })

  it('sync lại cùng event không tạo trùng, mới nhất đứng đầu', () => {
    const once = mergeNotifications(EMPTY_FEED, [created, fill, paused])
    const twice = mergeNotifications(once, [created, fill, paused])
    expect(twice).toBe(once)
    expect(once.items.map((item) => item.notification_type)).toEqual(['PARENT_PAUSED', 'PARENT_ACTIVATED'])
  })

  it('giữ trạng thái đã đọc khi có event mới', () => {
    const first = mergeNotifications(EMPTY_FEED, [created])
    const read = { ...first, items: markRead(first.items, first.items[0].id) }
    const next = mergeNotifications(read, [created, paused])
    expect(next.items.map((item) => item.read)).toEqual([false, true])
  })

  it('mục bị cắt khỏi danh sách không quay lại ở lần sync sau', () => {
    const events = Array.from({ length: 5 }, (_, index) =>
      makeEvent({ action: 'CREATE', new_value: 'ACTIVE', parent_order_id: `PO-${index}` }),
    )
    const feed = mergeNotifications(EMPTY_FEED, events, 3)
    expect(feed.items.map((item) => item.parent_order_id)).toEqual(['PO-4', 'PO-3', 'PO-2'])
    expect(mergeNotifications(feed, events, 3)).toBe(feed)
  })

  it('event trùng event_id nhưng khác thời điểm (sau "Về đầu ngày") là event mới', () => {
    const before = makeEvent({ action: 'CREATE', new_value: 'ACTIVE', event_id: 'E-000001', event_time: iso(TODAY, '09:15:00') })
    const after = { ...before, event_time: iso(TODAY, '09:20:00') }
    const feed = mergeNotifications(mergeNotifications(EMPTY_FEED, [before]), [after])
    expect(feed.items).toHaveLength(2)
  })
})

describe('đếm và đánh dấu đã đọc', () => {
  const events = [
    makeEvent({ action: 'CREATE', new_value: 'ACTIVE' }),
    makeEvent({ action: 'REJECT', child_order_id: 'CO-1', new_value: 'REJECTED' }),
    makeEvent({ action: 'PAUSE', old_value: 'ACTIVE', new_value: 'PAUSED_SYSTEM' }),
  ]

  it('đếm chưa đọc, đánh dấu một mục, đánh dấu tất cả', () => {
    const { items } = mergeNotifications(EMPTY_FEED, events)
    expect(countUnread(items)).toBe(3)
    const one = markRead(items, items[1].id)
    expect(countUnread(one)).toBe(2)
    expect(one[1].read).toBe(true)
    expect(countUnread(markAllRead(one))).toBe(0)
  })

  it('store tách theo tài khoản và không trùng khi sync nhiều lần', () => {
    const store = useNotificationStore.getState()
    store.sync('khachhang', events)
    store.sync('khachhang', events)
    store.markRead('khachhang', useNotificationStore.getState().feeds.khachhang.items[0].id)
    store.sync('dealer', events.slice(0, 1))

    const { feeds } = useNotificationStore.getState()
    expect(feeds.khachhang.items).toHaveLength(3)
    expect(countUnread(feeds.khachhang.items)).toBe(2)
    expect(feeds.dealer.items).toHaveLength(1)

    useNotificationStore.getState().markAllRead('khachhang')
    expect(countUnread(useNotificationStore.getState().feeds.khachhang.items)).toBe(0)
    expect(countUnread(useNotificationStore.getState().feeds.dealer.items)).toBe(1)
  })
})
