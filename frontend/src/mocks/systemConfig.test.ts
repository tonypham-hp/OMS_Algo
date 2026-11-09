import { describe, expect, it } from 'vitest'
import { canDecideRequest, SYSTEM_PARAM_DEFAULTS, SYSTEM_PARAMETERS, validateParameterValue } from '@/config/systemParams'
import { STRATEGY_TYPES } from '@/config/strategies'
import { createConfigStore } from './systemConfig'

function setup() {
  let clock = 0
  const store = createConfigStore({ now: () => `2026-11-06T10:00:${String(clock++).padStart(2, '0')}` })
  return { store }
}

const pendingOf = (store: ReturnType<typeof createConfigStore>, code: string) =>
  store.listParameters().find((item) => item.parameter_code === code)?.pending_request

describe('maker-checker', () => {
  it('không tự duyệt được: người tạo duyệt hoặc từ chối yêu cầu của mình bị từ chối 403, giá trị không đổi', () => {
    const { store } = setup()
    const request = store.createRequest(
      { parameter_code: 'MAX_CONSECUTIVE_REJECTS', new_value: 3, reason: 'Core hay từ chối lẻ tẻ' },
      'vanhanh',
    )

    expect(() => store.approveRequest(request.request_id, '', 'vanhanh')).toThrow(
      expect.objectContaining({ status: 403, message: expect.stringContaining('không được tự duyệt') }),
    )
    expect(() => store.rejectRequest(request.request_id, 'không', 'vanhanh')).toThrow(expect.objectContaining({ status: 403 }))
    expect(store.getValue('MAX_CONSECUTIVE_REJECTS')).toBe(2)
    expect(pendingOf(store, 'MAX_CONSECUTIVE_REJECTS')?.status).toBe('PENDING')
  })

  it('người khác duyệt: áp giá trị mới, ghi cũ → mới, người tạo, người duyệt, lý do, ghi chú', () => {
    const { store } = setup()
    const request = store.createRequest(
      { parameter_code: 'MAX_CONSECUTIVE_REJECTS', new_value: 3, reason: 'Core hay từ chối lẻ tẻ' },
      'vanhanh',
    )
    store.approveRequest(request.request_id, 'Đồng ý', 'vanhanh2')

    expect(store.getValue('MAX_CONSECUTIVE_REJECTS')).toBe(3)
    expect(store.listRequests()[0]).toMatchObject({
      status: 'APPROVED',
      old_value: 2,
      new_value: 3,
      maker: 'vanhanh',
      checker: 'vanhanh2',
      reason: 'Core hay từ chối lẻ tẻ',
      note: 'Đồng ý',
    })
    const parameter = store.listParameters().find((item) => item.parameter_code === 'MAX_CONSECUTIVE_REJECTS')
    expect(parameter).toMatchObject({
      value: 3,
      updated_by: 'vanhanh',
      approved_by: 'vanhanh2',
      updated_at: request.decided_at,
      pending_request: null,
    })
  })

  it('từ chối: giá trị không đổi, bắt buộc ghi chú', () => {
    const { store } = setup()
    const request = store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 10, reason: 'Thử' }, 'vanhanh')

    expect(() => store.rejectRequest(request.request_id, '  ', 'vanhanh2')).toThrow('ghi chú')
    store.rejectRequest(request.request_id, 'Quá dài', 'vanhanh2')

    expect(store.getValue('ACK_TIMEOUT_SECONDS')).toBe(SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS)
    expect(store.listRequests()[0]).toMatchObject({ status: 'REJECTED', checker: 'vanhanh2', note: 'Quá dài' })
    expect(store.listParameters().find((item) => item.parameter_code === 'ACK_TIMEOUT_SECONDS')?.updated_by).toBeNull()
  })

  it('yêu cầu đã xử lý thì không duyệt lại được', () => {
    const { store } = setup()
    const request = store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 10, reason: 'Thử' }, 'vanhanh')
    store.approveRequest(request.request_id, '', 'vanhanh2')
    expect(() => store.rejectRequest(request.request_id, 'muộn', 'vanhanh2')).toThrow('đã được xử lý')
    expect(() => store.approveRequest('CR-9999', '', 'vanhanh2')).toThrow(expect.objectContaining({ status: 404 }))
  })
})

describe('một yêu cầu chờ duyệt cho mỗi tham số', () => {
  it('tham số đang có yêu cầu chờ thì không tạo thêm được (409), kể cả người khác tạo', () => {
    const { store } = setup()
    store.createRequest({ parameter_code: 'MAX_DATA_DELAY_SECONDS', new_value: 10, reason: 'Feed chậm' }, 'vanhanh')

    expect(() =>
      store.createRequest({ parameter_code: 'MAX_DATA_DELAY_SECONDS', new_value: 8, reason: 'Khác' }, 'vanhanh2'),
    ).toThrow(expect.objectContaining({ status: 409, message: expect.stringContaining('đang có một yêu cầu chờ duyệt') }))
    expect(store.listRequests({ status: 'PENDING' })).toHaveLength(1)
  })

  it('tham số khác vẫn tạo được; duyệt hoặc từ chối xong thì tạo được yêu cầu mới', () => {
    const { store } = setup()
    const first = store.createRequest({ parameter_code: 'MAX_DATA_DELAY_SECONDS', new_value: 10, reason: 'Feed chậm' }, 'vanhanh')
    store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 5, reason: 'Core chậm' }, 'vanhanh')
    expect(store.listRequests({ status: 'PENDING' })).toHaveLength(2)

    store.rejectRequest(first.request_id, 'Chưa cần', 'vanhanh2')
    const second = store.createRequest({ parameter_code: 'MAX_DATA_DELAY_SECONDS', new_value: 8, reason: 'Lần hai' }, 'vanhanh2')
    store.approveRequest(second.request_id, '', 'vanhanh')
    expect(store.getValue('MAX_DATA_DELAY_SECONDS')).toBe(8)
    store.createRequest({ parameter_code: 'MAX_DATA_DELAY_SECONDS', new_value: 9, reason: 'Lần ba' }, 'vanhanh')
    expect(pendingOf(store, 'MAX_DATA_DELAY_SECONDS')?.new_value).toBe(9)
  })
})

describe('kiểm tra giá trị', () => {
  it('theo min, max, bội số, kèm lỗi tiếng Việt', () => {
    const { store } = setup()
    const create = (parameter_code: 'MAX_CONSECUTIVE_REJECTS' | 'ICEBERG_MIN_SLICE' | 'POV_MAX_PARTICIPATION_PCT', new_value: number) =>
      () => store.createRequest({ parameter_code, new_value, reason: 'Thử' }, 'vanhanh')

    expect(create('MAX_CONSECUTIVE_REJECTS', 0)).toThrow('Giá trị nhỏ nhất là 1 lần')
    expect(create('MAX_CONSECUTIVE_REJECTS', 11)).toThrow('Giá trị lớn nhất là 10 lần')
    expect(create('MAX_CONSECUTIVE_REJECTS', 2.5)).toThrow('số nguyên')
    expect(create('ICEBERG_MIN_SLICE', 150)).toThrow('bội số của 100')
    expect(create('POV_MAX_PARTICIPATION_PCT', 101)).toThrow('Giá trị lớn nhất là 100 %')
    expect(store.listRequests()).toEqual([])
  })

  it('slice tối thiểu không vượt tối đa đang áp dụng, và ngược lại', () => {
    const { store } = setup()
    const request = store.createRequest({ parameter_code: 'ICEBERG_MAX_SLICE', new_value: 10_000, reason: 'Giảm' }, 'vanhanh')
    store.approveRequest(request.request_id, '', 'vanhanh2')

    expect(() =>
      store.createRequest({ parameter_code: 'ICEBERG_MIN_SLICE', new_value: 20_000, reason: 'Tăng' }, 'vanhanh'),
    ).toThrow('Không được lớn hơn KL mỗi phần tối đa')
  })

  it('lúc duyệt kiểm lại theo giá trị đang áp dụng: tham số liên quan đã đổi thì không duyệt được', () => {
    const { store } = setup()
    const min = store.createRequest({ parameter_code: 'ICEBERG_MIN_SLICE', new_value: 5_000, reason: 'Tăng min' }, 'vanhanh')
    const max = store.createRequest({ parameter_code: 'ICEBERG_MAX_SLICE', new_value: 1_000, reason: 'Giảm max' }, 'vanhanh')
    store.approveRequest(max.request_id, '', 'vanhanh2')

    expect(() => store.approveRequest(min.request_id, '', 'vanhanh2')).toThrow('Không được lớn hơn')
    expect(store.getValue('ICEBERG_MIN_SLICE')).toBe(100)
    expect(pendingOf(store, 'ICEBERG_MIN_SLICE')?.status).toBe('PENDING')
  })

  it('danh sách loại lệnh: phải bật ít nhất một loại, không lạ, không trùng', () => {
    const current = SYSTEM_PARAM_DEFAULTS
    expect(validateParameterValue('ENABLED_STRATEGIES', [], current)).toBe('Phải bật ít nhất một loại lệnh')
    expect(validateParameterValue('ENABLED_STRATEGIES', ['ABC'], current)).toBe('Danh sách loại lệnh không hợp lệ')
    expect(validateParameterValue('ENABLED_STRATEGIES', ['TWAP', 'TWAP'], current)).toBe('Danh sách loại lệnh bị trùng')
    expect(validateParameterValue('ENABLED_STRATEGIES', ['TWAP'], current)).toBeNull()
  })

  it('bắt buộc lý do, không nhận giá trị trùng giá trị đang áp dụng, không nhận tham số lạ', () => {
    const { store } = setup()
    expect(() => store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 5, reason: ' ' }, 'vanhanh')).toThrow('lý do')
    expect(() =>
      store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: SYSTEM_PARAM_DEFAULTS.ACK_TIMEOUT_SECONDS, reason: 'x' }, 'vanhanh'),
    ).toThrow('trùng giá trị đang áp dụng')
    expect(() =>
      store.createRequest({ parameter_code: 'ENABLED_STRATEGIES', new_value: [...STRATEGY_TYPES].reverse(), reason: 'x' }, 'vanhanh'),
    ).toThrow('trùng giá trị đang áp dụng')
    expect(() =>
      store.createRequest({ parameter_code: 'KHONG_CO' as 'ACK_TIMEOUT_SECONDS', new_value: 5, reason: 'x' }, 'vanhanh'),
    ).toThrow(expect.objectContaining({ status: 404 }))
  })

  it('giá trị mặc định đều hợp lệ theo chính luật của nó', () => {
    for (const definition of SYSTEM_PARAMETERS) {
      expect(validateParameterValue(definition.code, SYSTEM_PARAM_DEFAULTS[definition.code], SYSTEM_PARAM_DEFAULTS)).toBeNull()
    }
  })
})

describe('lịch sử thay đổi', () => {
  function withHistory() {
    const { store } = setup()
    const a = store.createRequest({ parameter_code: 'MAX_CONSECUTIVE_REJECTS', new_value: 3, reason: 'A' }, 'vanhanh')
    store.approveRequest(a.request_id, '', 'vanhanh2')
    const b = store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 10, reason: 'B' }, 'vanhanh2')
    store.rejectRequest(b.request_id, 'Không', 'vanhanh')
    store.createRequest({ parameter_code: 'MAX_CONSECUTIVE_REJECTS', new_value: 4, reason: 'C' }, 'vanhanh2')
    return store
  }

  it('mới nhất trước, lọc theo tham số, người (tạo hoặc duyệt), trạng thái', () => {
    const store = withHistory()
    expect(store.listRequests().map((item) => item.reason)).toEqual(['C', 'B', 'A'])
    expect(store.listRequests({ parameter_code: 'MAX_CONSECUTIVE_REJECTS' }).map((item) => item.reason)).toEqual(['C', 'A'])
    expect(store.listRequests({ status: 'REJECTED' }).map((item) => item.reason)).toEqual(['B'])
    expect(store.listRequests({ user: 'vanhanh' }).map((item) => item.reason)).toEqual(['B', 'A'])
    expect(store.listRequests({ user: 'vanhanh2', status: 'PENDING' }).map((item) => item.reason)).toEqual(['C'])
  })

  it('lưu rồi nạp lại giữ nguyên giá trị, người sửa và lịch sử; reset về mặc định', () => {
    const store = withHistory()
    const restored = createConfigStore()
    restored.importState(JSON.parse(JSON.stringify(store.exportState())))

    expect(restored.listParameters()).toEqual(store.listParameters())
    expect(restored.listRequests()).toEqual(store.listRequests())
    const next = restored.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 7, reason: 'D' }, 'vanhanh')
    expect(next.request_id).toBe('CR-0004')

    restored.reset()
    expect(restored.getValue('MAX_CONSECUTIVE_REJECTS')).toBe(2)
    expect(restored.listRequests()).toEqual([])
  })
})

describe('nút Duyệt / Từ chối trên màn cấu hình', () => {
  it('người tạo không thấy nút cho yêu cầu của mình; người khác thấy; yêu cầu đã xử lý thì không ai thấy', () => {
    const { store } = setup()
    const request = store.createRequest({ parameter_code: 'ACK_TIMEOUT_SECONDS', new_value: 5, reason: 'x' }, 'vanhanh')

    expect(canDecideRequest(request, 'vanhanh')).toBe(false)
    expect(canDecideRequest(request, 'vanhanh2')).toBe(true)
    expect(canDecideRequest(request, undefined)).toBe(false)

    store.approveRequest(request.request_id, '', 'vanhanh2')
    expect(canDecideRequest(request, 'vanhanh2')).toBe(false)
  })
})
