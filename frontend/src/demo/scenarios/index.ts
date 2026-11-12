import type { Scenario } from '../types'
import { coreAckLost } from './coreAckLost'
import { huntSweep } from './huntSweep'
import { icebergSuccess } from './icebergSuccess'
import { omsRestart } from './omsRestart'
import { povAdjust } from './povAdjust'
import { stopToIceberg } from './stopToIceberg'

/** 6 kịch bản E2E theo docs/test-cases/TC-E2E.md, theo thứ tự Scenario 1 → 6. */
export const SCENARIOS: ReadonlyArray<Scenario> = [
  icebergSuccess,
  stopToIceberg,
  povAdjust,
  huntSweep,
  coreAckLost,
  omsRestart,
]

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id)
}
