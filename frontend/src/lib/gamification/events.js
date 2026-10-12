// GYMPACT — the events the app emits, and the idempotency keys that make them safe
// to process more than once.
//
// An event is a plain object describing *something that happened* and how many
// points it is worth. It is NOT yet a ledger entry (the ledger adds an id and a
// timestamp, and drops events whose key it has already seen). Two devices that
// both compute "session X happened" produce the same key, so the second one is a
// no-op instead of a duplicate 100 points.

import { rulesOf, isValidSession, targetForWeek } from './rules.js'
import {
  instantOf, sessionWeekKey, fulfilledWeekKeys
} from './weekly-goals.js'
import { consecutiveEndingAt } from './streaks.js'

export const EVENT = {
  SESSION: 'session',
  WEEK_BONUS: 'week_bonus',
  CYCLE_BONUS: 'cycle_bonus',
  REDEEM: 'redeem',
  COMPENSATION: 'compensation'
}

// One logical event == one key, forever. These strings are a contract: changing
// them would let an already-awarded event be granted a second time.
export const sessionKey = workoutId => 'session:' + workoutId
export const weekBonusKey = weekKey => 'week:' + weekKey + ':bonus'
export const cycleBonusKey = weekKey => 'cycle:' + weekKey
export const redeemKey = redemptionId => 'redeem:' + redemptionId
export const compensationKey = key => 'comp:' + key

function event(type, delta, key, ref, meta, rules) {
  return { type, delta, key, ref: ref || {}, meta: { ruleVersion: rules && rules.ruleVersion, ...(meta || {}) } }
}

export function sessionEvent(w, rules) {
  return event(EVENT.SESSION, rules.sessionPoints, sessionKey(w.id), { workoutId: w.id }, { d: w.d }, rules)
}
export function weekBonusEvent(weekKey, rules) {
  return event(EVENT.WEEK_BONUS, rules.weeklyBonus, weekBonusKey(weekKey), { weekKey }, {}, rules)
}
export function cycleBonusEvent(weekKey, rules) {
  return event(EVENT.CYCLE_BONUS, rules.cycleBonus, cycleBonusKey(weekKey), { weekKey }, {}, rules)
}
export function redeemEvent(reward, redemptionId) {
  return event(EVENT.REDEEM, -Math.max(0, reward.cost), redeemKey(redemptionId),
    { rewardId: reward.id, redemptionId }, { name: reward.name })
}

// All events a just-finished workout should produce. `S` must already contain the
// finished workout in `S.workouts`. Returns [] for an invalid session (nothing
// logged) so an empty "finish anyway" workout can't mint points.
//
// Weekly/cycle bonuses are evaluated against the whole valid history in the zone,
// which is why they can be granted even if some of the week's sessions predate the
// feature — the *achievement* is the week reaching the target, not who awarded it.
export function eventsForFinishedWorkout(S, workout) {
  if (!isValidSession(workout)) return []
  const rules = rulesOf(S)
  const tz = rules.tz
  const out = [sessionEvent(workout, rules)]

  const wk = sessionWeekKey(workout, tz)
  const fulfilled = fulfilledWeekKeys(S.workouts, tz, k => targetForWeek(S, k))
  if (fulfilled.has(wk)) {
    out.push(weekBonusEvent(wk, rules))
    const run = consecutiveEndingAt(fulfilled, wk)
    // A 4-week cycle is banked each time the run reaches a multiple of cycleWeeks
    // (4, 8, 12…), keyed by the week that completed it, so it is granted once.
    if (run > 0 && run % rules.cycleWeeks === 0) out.push(cycleBonusEvent(wk, rules))
  }
  return out
}

// Key to compensate when a workout is deleted or corrected. The ledger turns this
// into a single balancing movement; it never deletes the original.
export const compensationForWorkout = workout => sessionKey(workout.id)
