import { describe, expect, it } from 'vitest'
import { orderDataFingerprint } from './actions'
import { createDemoEnv } from './env'
import { createRunner, type DemoResult } from './runner'
import { SCENARIOS } from './scenarios'

function runHeadless(scenarioIndex: number) {
  const env = createDemoEnv()
  const runner = createRunner({ scenario: SCENARIOS[scenarioIndex], env })
  runner.runToEnd()
  return { result: runner.getResult(), data: orderDataFingerprint(env), snapshot: runner.getSnapshot() }
}

describe('6 kịch bản E2E chạy headless', () => {
  it('đủ 6 kịch bản, đánh số 1 → 6, mỗi kịch bản có mã TC và ít nhất 5 bước có chú thích', () => {
    expect(SCENARIOS.map((scenario) => scenario.number)).toEqual([1, 2, 3, 4, 5, 6])
    for (const scenario of SCENARIOS) {
      expect(scenario.tcRefs.length).toBeGreaterThan(0)
      expect(scenario.steps.length).toBeGreaterThanOrEqual(5)
      expect(scenario.steps.every((step) => step.caption.length > 20)).toBe(true)
      expect(new Set(scenario.steps.map((step) => step.id)).size).toBe(scenario.steps.length)
    }
  })

  it.each(SCENARIOS.map((scenario, index) => [scenario.number, scenario.title, index] as const))(
    'Scenario %i (%s): chạy hết các bước, mọi điều kiện ĐẠT',
    (_number, _title, index) => {
      const { result, snapshot } = runHeadless(index)
      expect(result.failed).toEqual([])
      expect(result.executed).toBe(result.steps)
      expect(result.checksPassed).toBe(result.checksTotal)
      expect(snapshot.status).toBe('finished')
      expect(result.rows.every((row) => row.error === null)).toBe(true)
    },
  )

  it.each(SCENARIOS.map((scenario, index) => [scenario.number, index] as const))(
    'Scenario %i chạy 2 lần cho kết quả và dữ liệu giống hệt nhau',
    (_number, index) => {
      const first = runHeadless(index)
      const second = runHeadless(index)
      expect(second.result).toEqual<DemoResult>(first.result)
      expect(second.data).toBe(first.data)
    },
  )
})
