import type { Scenario } from '../types'
import { amendPriority } from './amendPriority'
import { coreAckLost } from './coreAckLost'
import { haltResume } from './haltResume'
import { hnxToHose } from './hnxToHose'
import { huntSweep } from './huntSweep'
import { icebergSuccess } from './icebergSuccess'
import { oddLotAtc } from './oddLotAtc'
import { omsRestart } from './omsRestart'
import { povAdjust } from './povAdjust'
import { putThroughAfterHours } from './putThroughAfterHours'
import { restrictedAuction } from './restrictedAuction'
import { stopToIceberg } from './stopToIceberg'

/**
 * 6 kịch bản E2E theo docs/test-cases/TC-E2E.md (Scenario 1 → 6), 3 kịch bản luật KRX của Đợt 8A (7 → 9)
 * và 3 kịch bản phiên đặc biệt của Đợt 8B (10 → 12).
 */
export const SCENARIOS: ReadonlyArray<Scenario> = [
  icebergSuccess,
  stopToIceberg,
  povAdjust,
  huntSweep,
  coreAckLost,
  omsRestart,
  amendPriority,
  oddLotAtc,
  hnxToHose,
  restrictedAuction,
  haltResume,
  putThroughAfterHours,
]

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id)
}
