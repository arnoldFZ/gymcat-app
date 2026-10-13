// GYMPACT — streaks of *fulfilled weeks* (not consecutive days).
//
// The streak the product cares about is: how many weeks in a row met the weekly
// goal. A week still in progress that hasn't reached the goal yet must not break
// the streak — it simply isn't counted until it does. This mirrors the spirit of
// the app's existing `streakWeeks`, but counts weeks that *fulfilled the goal*
// rather than weeks that merely contained a workout.

import { isoWeekKeyOfDate, isoDateInTZ } from './weekly-goals.js'

const DAY = 86400000

// Monday of ISO week `w` of year `y`, as a UTC Date.
function mondayOfISOWeek(y, w) {
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7          // Monday = 0
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day)
  const mon = new Date(week1Monday)
  mon.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7)
  return mon
}

// Monday (as an ISO date) of an ISO week key — for charting a week on a time axis.
export function weekStartISO(weekKey) {
  const [y, w] = weekKey.split('-W').map(Number)
  return mondayOfISOWeek(y, w).toISOString().slice(0, 10)
}

// Move a week key by `delta` weeks (negative = backwards), staying on ISO weeks.
export function shiftWeekKey(weekKey, delta) {
  const [y, w] = weekKey.split('-W').map(Number)
  const mon = mondayOfISOWeek(y, w)
  mon.setUTCDate(mon.getUTCDate() + delta * 7)
  return isoWeekKeyOfDate(mon.toISOString().slice(0, 10))
}

// Consecutive fulfilled weeks ending exactly at `weekKey` (which must itself be
// fulfilled, otherwise 0). `restSet` weeks are stepped over without counting or
// breaking. This is the run a newly fulfilled week completes (cycle bonus).
export function consecutiveEndingAt(fulfilledSet, weekKey, restSet) {
  let n = 0
  let k = weekKey
  let guard = 0
  while (guard++ < 1000) {
    if (fulfilledSet.has(k)) n++
    else if (restSet && restSet.has(k)) { /* planned rest: step over */ }
    else break
    k = shiftWeekKey(k, -1)
  }
  return n
}

// The streak shown on the dashboard: consecutive fulfilled weeks counting back from
// the current week. An in-progress current week doesn't reset anything, and a planned
// rest week (`restSet`) is stepped over without counting or breaking.
export function streakOfFulfilled(fulfilledSet, currentWeek, restSet) {
  if (!fulfilledSet || !fulfilledSet.size) return 0
  let n = 0
  let k = currentWeek
  let first = true
  let guard = 0
  while (guard++ < 1000) {
    if (fulfilledSet.has(k)) n++
    else if (restSet && restSet.has(k)) { /* step over */ }
    else if (!first) break
    // first week that is neither fulfilled nor rest: the current week in progress —
    // don't count it and don't let it break the run; keep walking back from it.
    first = false
    k = shiftWeekKey(k, -1)
  }
  return n
}
