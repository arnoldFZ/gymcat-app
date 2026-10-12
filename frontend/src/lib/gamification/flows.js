// GYMPACT — the handful of state transitions the UI performs, kept in one pure,
// testable place instead of scattered through React.
//
// Each function returns a NEW ledger; the caller folds it into `S.gam.ledger` inside
// the store's `update()`. Pulling them out of the components is what lets the
// integration tests replay the exact sequence a user triggers (finish → bonus →
// correct → delete, or a double-tapped redeem) without a DOM.

import { applyEvents, compensateEvents, reconcileSessionEvents } from './ledger.js'
import { eventsForFinishedWorkout, compensationForWorkout } from './events.js'
import { rulesOf } from './rules.js'
import { tryRedeem } from './rewards.js'

const ledgerOf = S => (S && S.gam && S.gam.ledger) || []

// Score a just-finished session. `S.workouts` must already include `workout`.
export function ledgerAfterFinish(S, workout, now) {
  return applyEvents(ledgerOf(S), eventsForFinishedWorkout(S, workout), now == null ? workout.end : now)
}

// Compensate a deleted session (net of its whole family).
export function ledgerAfterDelete(S, workout, now) {
  const ledger = ledgerOf(S)
  return applyEvents(ledger, compensateEvents(ledger, compensationForWorkout(workout), now))
}

// Reconcile a corrected session (a set marked done/undone) to its new validity.
export function ledgerAfterCorrect(S, workout, now) {
  const ledger = ledgerOf(S)
  return applyEvents(ledger, reconcileSessionEvents(ledger, workout, rulesOf(S), now))
}

// Redeem a reward. Returns { ok, duplicate?, reason?, ledger }. `ledger` is present
// only when ok, and is a no-op change when the redemption id was already applied —
// so a double tap can never charge twice.
export function redeem(S, rewardId, redemptionId, now) {
  const res = tryRedeem(S, rewardId, redemptionId)
  if (!res.ok) return res
  return { ...res, ledger: applyEvents(ledgerOf(S), res.events, now) }
}
