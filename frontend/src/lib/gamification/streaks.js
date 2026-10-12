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
// fulfilled, otherwise 0). This is the run a newly fulfilled week completes.
export function consecutiveEndingAt(fulfilledSet, weekKey) {
  let n = 0
  let k = weekKey
  while (fulfilledSet.has(k)) {
    n++
    k = shiftWeekKey(k, -1)
  }
  return n
}

// The streak shown on the dashboard: consecutive fulfilled weeks ending at the
// current week if it is already fulfilled, otherwise ending at last week (an
// in-progress week doesn't reset anything).
export function streakOfFulfilled(fulfilledSet, currentWeek) {
  if (!fulfilledSet || !fulfilledSet.size) return 0
  let k = fulfilledSet.has(currentWeek) ? currentWeek : shiftWeekKey(currentWeek, -1)
  return consecutiveEndingAt(fulfilledSet, k)
}
