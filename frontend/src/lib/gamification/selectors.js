// GYMPACT — read-only selectors that turn raw state into what the UI shows.
// Pure and deterministic given `now`; the views never compute points themselves.

import { rulesOf, targetForWeek } from './rules.js'
import { currentWeekKey, countInWeek, fulfilledWeekKeys, validSessions } from './weekly-goals.js'
import { streakOfFulfilled, shiftWeekKey } from './streaks.js'
import { balance, pointsEarnedInWeek, entries } from './ledger.js'
import { nextReward } from './rewards.js'

// Progress toward the next 4-week cycle bonus. `into` is 1..cycleWeeks while a run is
// building (so the dashboard can say "3/4"), and equals cycleWeeks when a cycle was
// just completed. `streak` is the raw run of fulfilled weeks.
export function cycleProgress(S, now) {
  const rules = rulesOf(S)
  const tz = rules.tz
  const fulfilled = fulfilledWeekKeys(S && S.workouts, tz, k => targetForWeek(S, k))
  const streak = streakOfFulfilled(fulfilled, currentWeekKey(tz, now))
  const into = streak > 0 ? ((streak - 1) % rules.cycleWeeks) + 1 : 0
  return {
    streak,
    into,
    cycleWeeks: rules.cycleWeeks,
    bonus: rules.cycleBonus,
    onCycle: streak > 0 && into === rules.cycleWeeks
  }
}

// A compact summary of the most recent finished workout, for the dashboard.
export function lastSession(S) {
  const ws = (S && S.workouts) || []
  const w = ws[ws.length - 1]
  if (!w) return null
  const sets = (w.entries || []).reduce((n, e) => n + (e.sets ? e.sets.filter(s => s.done).length : 0), 0)
  return { id: w.id, name: w.name, d: w.d, sets, exercises: (w.entries || []).length, vol: w.vol || 0 }
}

// Ledger totals per movement type, for a points breakdown.
export function pointsByType(ledger) {
  const out = {}
  for (const e of entries(ledger)) { const k = e.type || 'other'; out[k] = (out[k] || 0) + (+e.delta || 0) }
  return out
}

export function dashboardStats(S, now) {
  const rules = rulesOf(S)
  const tz = rules.tz
  const wk = currentWeekKey(tz, now)
  const target = targetForWeek(S, wk)
  const sessions = countInWeek(S && S.workouts, wk, tz)
  const ledger = S && S.gam && S.gam.ledger
  const fulfilled = fulfilledWeekKeys(S && S.workouts, tz, k => targetForWeek(S, k))
  return {
    weekKey: wk,
    sessions,
    target,
    goalMet: sessions >= target,
    remainingToGoal: Math.max(0, target - sessions),
    customGoal: target !== rules.weeklyTarget,
    balance: balance(ledger),
    earnedThisWeek: pointsEarnedInWeek(ledger, wk, tz),
    streak: streakOfFulfilled(fulfilled, wk),
    fulfilledWeeks: fulfilled.size,
    nextReward: nextReward(S),
    cycle: cycleProgress(S, now),
    last: lastSession(S),
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
    out.unshift({ weekKey: k, count, fulfilled: count >= targetForWeek(S, k), points: pointsEarnedInWeek(S && S.gam && S.gam.ledger, k, tz) })
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
    if (countInWeek(S && S.workouts, k, tz) >= targetForWeek(S, k)) met++
    k = shiftWeekKey(k, -1)
  }
  return done ? { met, done, rate: met / done } : null
}
