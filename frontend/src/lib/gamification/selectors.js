// GYMPACT — read-only selectors that turn raw state into what the UI shows.
// Pure and deterministic given `now`; the views never compute points themselves.

import { rulesOf } from './rules.js'
import { currentWeekKey, countInWeek, fulfilledWeekKeys, validSessions } from './weekly-goals.js'
import { streakOfFulfilled, shiftWeekKey } from './streaks.js'
import { balance, pointsEarnedInWeek, entries } from './ledger.js'
import { nextReward } from './rewards.js'

export function dashboardStats(S, now) {
  const rules = rulesOf(S)
  const tz = rules.tz
  const wk = currentWeekKey(tz, now)
  const sessions = countInWeek(S && S.workouts, wk, tz)
  const ledger = S && S.gam && S.gam.ledger
  const fulfilled = fulfilledWeekKeys(S && S.workouts, tz, rules.weeklyTarget)
  return {
    weekKey: wk,
    sessions,
    target: rules.weeklyTarget,
    goalMet: sessions >= rules.weeklyTarget,
    remainingToGoal: Math.max(0, rules.weeklyTarget - sessions),
    balance: balance(ledger),
    earnedThisWeek: pointsEarnedInWeek(ledger, wk, tz),
    streak: streakOfFulfilled(fulfilled, wk),
    fulfilledWeeks: fulfilled.size,
    nextReward: nextReward(S),
    // Distinguishes "no data yet" from "no sessions this week".
    hasData: validSessions(S && S.workouts).length > 0 || entries(ledger).length > 0
  }
}

// Sessions per week for the last `n` weeks, oldest first, ending at the current
// week (which may still be in progress).
export function recentWeeks(S, n = 8, now) {
  const rules = rulesOf(S)
  const tz = rules.tz
  let k = currentWeekKey(tz, now)
  const out = []
  for (let i = 0; i < n; i++) {
    const count = countInWeek(S && S.workouts, k, tz)
    out.unshift({ weekKey: k, count, fulfilled: count >= rules.weeklyTarget })
    k = shiftWeekKey(k, -1)
  }
  return out
}

// Share of *completed* weeks (excluding the current, possibly-unfinished one) that
// met the target. Null when there are no completed weeks to judge.
export function complianceRate(S, n = 8, now) {
  const rules = rulesOf(S)
  const tz = rules.tz
  const current = currentWeekKey(tz, now)
  let k = shiftWeekKey(current, -1)
  let done = 0, met = 0
  for (let i = 0; i < n; i++) {
    done++
    if (countInWeek(S && S.workouts, k, tz) >= rules.weeklyTarget) met++
    k = shiftWeekKey(k, -1)
  }
  return done ? { met, done, rate: met / done } : null
}
