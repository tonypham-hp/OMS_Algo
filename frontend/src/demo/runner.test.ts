import { describe, expect, it } from 'vitest'
import { orderDataFingerprint } from './actions'
import { createDemoEnv } from './env'
import { createRunner, DEFAULT_WAIT_MS, type RunnerSnapshot } from './runner'
import { SCENARIOS } from './scenarios'
import type { Scenario } from './types'

const iceberg = SCENARIOS[0]

function setup(scenario: Scenario = iceberg) {
  const env = createDemoEnv()
  const routes: string[] = []
  const snapshots: RunnerSnapshot[] = []
  const runner = createRunner({ scenario, env, navigate: (route) => routes.push(route), onChange: (s) => snapshots.push(s) })
  return { env, runner, routes, snapshots }
}

/** Phát tới hết bằng advanceClock theo khung hình 16 ms, như UI. */
function playToEnd(runner: ReturnType<typeof createRunner>) {
  runner.play()
  for (let frame = 0; frame < 100_000 && runner.getSnapshot().status !== 'finished'; frame += 1) runner.advanceClock(16)
}

describe('runner', () => {
  it('mới tạo: chưa chạy bước nào, mọi điều kiện ở trạng thái CHỜ, sổ lệnh trống', () => {
    const { env, runner } = setup()
    const snapshot = runner.getSnapshot()
    expect(snapshot).toMatchObject({ status: 'idle', executed: 0, total: iceberg.steps.length, currentStep: null })
    expect(snapshot.checks.every((check) => check.status === 'pending')).toBe(true)
    expect(env.engine.listOrders()).toEqual([])
    expect(env.simulator.isScripted()).toBe(true)
  })

  it('play chạy bước 1 ngay; chưa đủ thời gian chờ thì chưa sang bước 2', () => {
    const { runner } = setup()
    runner.play()
    expect(runner.getSnapshot().executed).toBe(1)
    runner.advanceClock(DEFAULT_WAIT_MS - 1)
    expect(runner.getSnapshot().executed).toBe(1)
    runner.advanceClock(1)
    expect(runner.getSnapshot().executed).toBe(2)
  })

  it('pause dừng ở bước hiện tại dù thời gian trôi; next chạy đúng một bước rồi giữ tạm dừng', () => {
    const { runner } = setup()
    runner.play()
    runner.pause()
    runner.advanceClock(60_000)
    expect(runner.getSnapshot()).toMatchObject({ status: 'paused', executed: 1 })
    runner.next()
    expect(runner.getSnapshot()).toMatchObject({ status: 'paused', executed: 2 })
  })

  it('bước có route: điều hướng tới màn đã thay mã lệnh thật; highlight cũng được thay mã', () => {
    const { runner, routes } = setup()
    runner.next()
    const id = runner.getSnapshot().results[0] && routes.at(-1)
    expect(id).toMatch(/^\/so-lenh\/PO-\d{8}-0001$/)
    expect(runner.getSnapshot().highlight).toMatch(/^child-PO-\d{8}-0001-CH001$/)
  })

  it('reset về bước 0 và dữ liệu về đúng như lúc bắt đầu', () => {
    const { env, runner } = setup()
    const initial = orderDataFingerprint(env)
    runner.next()
    runner.next()
    expect(orderDataFingerprint(env)).not.toBe(initial)
    runner.reset()
    expect(runner.getSnapshot()).toMatchObject({ status: 'idle', executed: 0, results: [] })
    expect(orderDataFingerprint(env)).toBe(initial)
  })

  it('tốc độ x1 và x4 cho cùng kết quả; x4 cần ít thời gian thật hơn', () => {
    const slow = setup()
    const fast = setup()
    fast.runner.setSpeed(4)
    let slowFrames = 0
    let fastFrames = 0
    slow.runner.play()
    while (slow.runner.getSnapshot().status !== 'finished') {
      slow.runner.advanceClock(16)
      slowFrames += 1
    }
    fast.runner.play()
    while (fast.runner.getSnapshot().status !== 'finished') {
      fast.runner.advanceClock(16)
      fastFrames += 1
    }
    expect(fast.runner.getResult()).toEqual(slow.runner.getResult())
    expect(orderDataFingerprint(fast.env)).toBe(orderDataFingerprint(slow.env))
    expect(fastFrames).toBeLessThan(slowFrames / 3)
  })

  it('phát bằng nhịp khung hình cho cùng kết quả như runToEnd', () => {
    const played = setup()
    playToEnd(played.runner)
    const direct = setup()
    direct.runner.runToEnd()
    expect(played.runner.getResult()).toEqual(direct.runner.getResult())
  })

  it('đã xong thì play, next không làm gì; check chung ĐẠT sau khi chạy', () => {
    const { runner } = setup()
    runner.runToEnd()
    runner.play()
    runner.next()
    const snapshot = runner.getSnapshot()
    expect(snapshot.status).toBe('finished')
    expect(snapshot.checks.filter((check) => check.stepIndex === null).every((check) => check.status === 'pass')).toBe(true)
  })

  it('action lỗi (kịch bản sai) ghi lỗi vào kết quả, không làm hỏng runner', () => {
    const broken: Scenario = {
      ...iceberg,
      id: 'broken',
      steps: [{ id: 'bad', caption: 'Khớp lệnh con của một lệnh chưa đặt.', action: { type: 'coreFill', params: { order: 'missing', child: 1 } } }],
    }
    const { runner } = setup(broken)
    runner.runToEnd()
    const result = runner.getResult()
    expect(result.rows[0].error).toContain('missing')
    expect(result.failed.some((item) => item.label.includes('Lỗi khi chạy bước'))).toBe(true)
  })
})
