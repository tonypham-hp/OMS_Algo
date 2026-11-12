import { formatClock } from '@/lib/format'
import { runAction } from './actions'
import { GENERAL_CHECKS } from './checks'
import { createDemoContext, createEmptySeed, createLcg } from './env'
import { readState, resolveTemplate } from './state'
import type { DemoContext, DemoEnv, Scenario, Step } from './types'

// Bộ chạy kịch bản: thuần logic, không phụ thuộc React, không dùng setTimeout.
// Thời gian chờ giữa các bước do bên ngoài cấp qua advanceClock(ms thật); mọi thứ xảy ra trong engine
// đi theo đồng hồ giả lập, nên kết quả không phụ thuộc tốc độ phát hay máy chạy nhanh chậm.

export type RunnerStatus = 'idle' | 'playing' | 'paused' | 'finished'
export type DemoSpeed = 1 | 2 | 4
export type CheckStatus = 'pending' | 'pass' | 'fail'

export const DEMO_SPEEDS: ReadonlyArray<DemoSpeed> = [1, 2, 4]
/** Thời gian chờ mặc định sau mỗi bước, ms thật ở x1. */
export const DEFAULT_WAIT_MS = 4000
/** Số nhịp giả lập tối đa chờ engine ổn định. */
export const DEFAULT_SETTLE_TICKS = 120
/** Ổn định: số event không đổi trong bấy nhiêu nhịp liền. */
const STABLE_TICKS = 3

export interface CheckView {
  /** "g0".."g5" cho check chung, "s<bước>-<thứ tự>" cho check của bước. */
  key: string
  label: string
  /** Bước (từ 0) có check này; null với check chung. */
  stepIndex: number | null
  status: CheckStatus
}

export interface StepCheckResult {
  label: string
  passed: boolean
}

export interface StepResult {
  stepIndex: number
  stepId: string
  caption: string
  /** Giờ giả lập lúc bước chạy xong, hh:mm:ss. */
  simTime: string
  checks: StepCheckResult[]
  /** Lỗi khi chạy action (kịch bản sai, engine từ chối). */
  error: string | null
}

export interface RunnerSnapshot {
  scenarioId: string
  status: RunnerStatus
  /** Số bước đã chạy. */
  executed: number
  total: number
  speed: DemoSpeed
  /** Bước vừa chạy (null khi chưa chạy bước nào). */
  currentStep: Step | null
  /** Route và data-demo-id của bước vừa chạy, đã thay mã thật. */
  route: string | null
  highlight: string | null
  checks: CheckView[]
  results: StepResult[]
  simStartSeconds: number
  simNowSeconds: number
}

export interface DemoResult {
  scenarioId: string
  title: string
  steps: number
  executed: number
  checksPassed: number
  checksTotal: number
  /** Thời gian giả lập đã chạy, giây. */
  simElapsedSeconds: number
  failed: Array<{ step: number | null; label: string }>
  rows: StepResult[]
}

interface RunnerOptions {
  scenario: Scenario
  env: DemoEnv
  /** Gọi khi bước cần mở một màn. */
  navigate?: (route: string) => void
  /** Gọi mỗi khi trạng thái thay đổi (UI vẽ lại). */
  onChange?: (snapshot: RunnerSnapshot) => void
}

/**
 * Đưa môi trường về đầu kịch bản: sổ lệnh trống, random có seed, giá và giờ do kịch bản điều khiển.
 * Gọi lại được nhiều lần (Làm lại) và luôn cho cùng điểm xuất phát.
 */
export function prepareScenario(env: DemoEnv, scenario: Scenario) {
  env.engine.load(createEmptySeed())
  env.engine.setRandom(createLcg(scenario.seed))
  env.simulator.setScripted(true)
  env.simulator.setFeedStale(false)
  env.simulator.reset()
  env.tape.reset()
  scenario.setup(env)
}

/** Chạy từng nhịp 1 giây giả lập tới khi không còn event mới trong STABLE_TICKS nhịp, tối đa `maxTicks` nhịp. */
export function settle(env: DemoEnv, maxTicks: number) {
  let stable = 0
  let count = env.engine.listEvents().length
  for (let tick = 0; tick < maxTicks && stable < STABLE_TICKS; tick += 1) {
    env.simulator.advance(1)
    const next = env.engine.listEvents().length
    stable = next === count ? stable + 1 : 0
    count = next
  }
}

export function createRunner({ scenario, env, navigate, onChange }: RunnerOptions) {
  let status: RunnerStatus = 'idle'
  let speed: DemoSpeed = 1
  let executed = 0
  let elapsedMs = 0
  let ctx: DemoContext = createDemoContext()
  let results: StepResult[] = []
  /** Kết quả từng lần chạy check chung (mỗi bước một lần). */
  let generalRuns: boolean[][] = []
  let route: string | null = null
  let highlight: string | null = null
  let simStartSeconds = 0

  function start() {
    prepareScenario(env, scenario)
    ctx = createDemoContext()
    results = []
    generalRuns = []
    executed = 0
    elapsedMs = 0
    route = null
    highlight = null
    simStartSeconds = env.simulator.getState().sim_seconds
  }

  function checkViews(): CheckView[] {
    const stepViews = scenario.steps.flatMap((step, stepIndex) =>
      (step.checks ?? []).map((check, index): CheckView => {
        const result = results[stepIndex]?.checks[index]
        return {
          key: `s${stepIndex}-${index}`,
          label: check.label,
          stepIndex,
          status: result === undefined ? 'pending' : result.passed ? 'pass' : 'fail',
        }
      }),
    )
    const generalViews = GENERAL_CHECKS.map((check, index): CheckView => {
      const runs = generalRuns.map((run) => run[index])
      const status: CheckStatus = runs.length === 0 ? 'pending' : runs.every(Boolean) ? 'pass' : 'fail'
      return { key: `g${index}`, label: check.label, stepIndex: null, status }
    })
    return [...stepViews, ...generalViews]
  }

  function getSnapshot(): RunnerSnapshot {
    return {
      scenarioId: scenario.id,
      status,
      executed,
      total: scenario.steps.length,
      speed,
      currentStep: executed > 0 ? scenario.steps[executed - 1] : null,
      route,
      highlight,
      checks: checkViews(),
      results,
      simStartSeconds,
      simNowSeconds: env.simulator.getState().sim_seconds,
    }
  }

  function emit() {
    onChange?.(getSnapshot())
  }

  /** Mở màn của bước. Route còn chỗ chưa có mã (lệnh chưa tạo) thì đợi chạy action xong rồi mới mở. */
  function openRoute(step: Step): boolean {
    if (!step.route) return true
    const resolved = resolveTemplate(step.route, readState(env, ctx))
    if (resolved === null) return false
    route = resolved
    navigate?.(resolved)
    return true
  }

  /** Điều hướng → action → chờ ổn định → check → ghi kết quả. */
  function runStep(index: number) {
    const step = scenario.steps[index]
    const opened = openRoute(step)
    let error: string | null = null
    try {
      runAction(env, ctx, step.action)
      const maxTicks = step.settle ?? DEFAULT_SETTLE_TICKS
      if (maxTicks > 0) settle(env, maxTicks)
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught)
    }
    if (!opened) openRoute(step)

    const state = readState(env, ctx)
    const runCheck = (fn: (value: typeof state) => boolean) => {
      try {
        return error === null && fn(state)
      } catch {
        return false
      }
    }
    generalRuns.push(GENERAL_CHECKS.map((check) => runCheck(check.fn)))
    results.push({
      stepIndex: index,
      stepId: step.id,
      caption: step.caption,
      simTime: formatClock(state.simSeconds),
      checks: (step.checks ?? []).map((check) => ({ label: check.label, passed: runCheck(check.fn) })),
      error,
    })
    highlight = step.highlight ? resolveTemplate(step.highlight, state) : null
    executed = index + 1
    elapsedMs = 0
  }

  function finish() {
    status = 'finished'
    emit()
  }

  start()

  return {
    getSnapshot,

    play() {
      if (status === 'finished') return
      status = 'playing'
      // Bước đầu tiên chạy ngay khi bấm Phát, không bắt người xem chờ.
      if (executed === 0) runStep(0)
      emit()
    },

    pause() {
      if (status !== 'playing') return
      status = 'paused'
      emit()
    },

    /** Chạy đúng một bước. Đang phát thì chuyển sang tạm dừng để người trình bày tự bấm tiếp. */
    next() {
      if (status === 'finished') return
      if (executed >= scenario.steps.length) return finish()
      runStep(executed)
      status = 'paused'
      emit()
    },

    reset() {
      start()
      status = 'idle'
      emit()
    },

    setSpeed(next: DemoSpeed) {
      speed = next
      emit()
    },

    /**
     * UI gọi theo nhịp khung hình với số ms thật đã trôi qua. Đủ thời gian chờ của bước vừa chạy (chia theo tốc độ)
     * thì sang bước sau; bước cuối chờ xong thì kết thúc.
     */
    advanceClock(realMs: number) {
      if (status !== 'playing') return
      elapsedMs += realMs * speed
      const wait = scenario.steps[executed - 1]?.waitMs ?? DEFAULT_WAIT_MS
      if (elapsedMs < wait) return
      if (executed >= scenario.steps.length) return finish()
      runStep(executed)
      emit()
    },

    /** Chạy hết các bước còn lại ngay (test, chạy headless). */
    runToEnd() {
      while (executed < scenario.steps.length) runStep(executed)
      finish()
    },

    getResult(): DemoResult {
      const views = checkViews()
      const failed = views
        .filter((view) => view.status === 'fail')
        .map((view) => ({ step: view.stepIndex === null ? null : view.stepIndex + 1, label: view.label }))
      for (const result of results) {
        if (result.error) failed.push({ step: result.stepIndex + 1, label: `Lỗi khi chạy bước: ${result.error}` })
      }
      return {
        scenarioId: scenario.id,
        title: scenario.title,
        steps: scenario.steps.length,
        executed,
        checksPassed: views.filter((view) => view.status === 'pass').length,
        checksTotal: views.length,
        simElapsedSeconds: env.simulator.getState().sim_seconds - simStartSeconds,
        failed,
        rows: results,
      }
    },
  }
}

export type DemoRunner = ReturnType<typeof createRunner>
