import { describe, expect, it } from 'vitest'
import { createOrderEngine } from './engine'
import {
  clearConfigState,
  clearSimState,
  CONFIG_STATE_KEY,
  loadConfigState,
  loadSimState,
  saveConfigState,
  saveSimState,
  SIM_STATE_KEY,
} from './persistence'
import { createSeedData } from './seedOrders'
import { createMarketSimulator } from './simulator'
import { createConfigStore } from './systemConfig'

function fakeStorage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[SIM_STATE_KEY, initial]])
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
  }
}

function currentStates() {
  const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 6) })
  const engine = createOrderEngine()
  engine.load(createSeedData(new Date(2026, 10, 6)))
  engine.onMarketTick(simulator.getState())
  return { market: simulator.exportState(), engine: engine.exportState() }
}

const throwingStorage = () => {
  throw new Error('Trình duyệt chặn localStorage')
}

describe('lưu trạng thái giả lập', () => {
  it('lưu rồi đọc lại đúng dữ liệu', () => {
    const storage = fakeStorage()
    const { market, engine } = currentStates()

    expect(saveSimState(market, engine, () => storage)).toBe(true)
    const loaded = loadSimState(() => storage)
    expect(loaded?.market).toEqual(JSON.parse(JSON.stringify(market)))
    expect(loaded?.engine).toEqual(JSON.parse(JSON.stringify(engine)))
  })

  it('chưa có dữ liệu thì trả về null', () => {
    const storage = fakeStorage()
    expect(loadSimState(() => storage)).toBeNull()
  })

  it.each([
    ['JSON hỏng', '{khong-phai-json'],
    ['null', 'null'],
    ['sai phiên bản', JSON.stringify({ version: 999, market: {}, engine: {} })],
    ['bản lưu cũ', JSON.stringify({ version: 1, market: { trading_date: '2026-11-06', sim_seconds: 1, quotes: [] }, engine: {} })],
    ['bản lưu trước khi tách kịch bản timeout', JSON.stringify({ version: 4, market: { trading_date: '2026-11-06', sim_seconds: 1, quotes: [] }, engine: {} })],
    ['thiếu dữ liệu', JSON.stringify({ version: 5, market: { trading_date: '2026-11-06' }, engine: {} })],
    ['sai kiểu', JSON.stringify({ version: 5, market: { trading_date: 1, sim_seconds: 'x', quotes: 1 }, engine: { parents: 1 } })],
  ])('dữ liệu hỏng (%s) trả về null để nạp lại dữ liệu mẫu', (_, raw) => {
    const storage = fakeStorage(raw)
    expect(loadSimState(() => storage)).toBeNull()
  })

  it('hết dung lượng khi lưu: trả về false, không ném lỗi', () => {
    const { market, engine } = currentStates()     
    const fullStorage = {
      ...fakeStorage(),
      setItem: () => {
        throw new DOMException('Hết dung lượng', 'QuotaExceededError')
      },
    }
    expect(saveSimState(market, engine, () => fullStorage)).toBe(false)
  })

  it('trình duyệt chặn localStorage: mọi thao tác đều không ném lỗi', () => {
    const { market, engine } = currentStates()
    expect(loadSimState(throwingStorage)).toBeNull()
    expect(saveSimState(market, engine, throwingStorage)).toBe(false)
    expect(() => clearSimState(throwingStorage)).not.toThrow()
  })

  it('xóa thì không còn dữ liệu', () => {
    const storage = fakeStorage('{}')
    clearSimState(() => storage)
    expect(storage.data.has(SIM_STATE_KEY)).toBe(false)
  })
})

describe('lưu cấu hình hệ thống', () => {
  function changedConfig() {
    const store = createConfigStore({ now: () => '2026-11-06T10:00:00' })
    const request = store.createRequest({ parameter_code: 'MAX_CONSECUTIVE_REJECTS', new_value: 3, reason: 'A' }, 'vanhanh')
    store.approveRequest(request.request_id, 'OK', 'vanhanh2')
    return store.exportState()
  }

  it('lưu riêng khóa của cấu hình, đọc lại đúng giá trị và lịch sử', () => {
    const storage = fakeStorage()
    const config = changedConfig()
    expect(saveConfigState(config, () => storage)).toBe(true)
    expect([...storage.data.keys()]).toEqual([CONFIG_STATE_KEY])
    expect(loadConfigState(() => storage)).toEqual(JSON.parse(JSON.stringify(config)))
  })

  it('chưa có, hỏng, sai phiên bản hoặc bị chặn thì trả về null; xóa thì không còn', () => {
    const storage = fakeStorage()
    expect(loadConfigState(() => storage)).toBeNull()
    storage.setItem(CONFIG_STATE_KEY, '{hỏng')
    expect(loadConfigState(() => storage)).toBeNull()
    storage.setItem(CONFIG_STATE_KEY, JSON.stringify({ version: 99, config: changedConfig() }))
    expect(loadConfigState(() => storage)).toBeNull()
    expect(loadConfigState(throwingStorage)).toBeNull()
    expect(saveConfigState(changedConfig(), throwingStorage)).toBe(false)

    saveConfigState(changedConfig(), () => storage)
    clearConfigState(() => storage)
    expect(loadConfigState(() => storage)).toBeNull()
    expect(() => clearConfigState(throwingStorage)).not.toThrow()
  })
})
