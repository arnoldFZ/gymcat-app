import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RULES, rulesOf, isValidSession,
  isoDateInTZ, isoWeekKeyOfDate, weekKeyOf, instantOf,
  countInWeek, fulfilledWeekKeys, currentWeekKey,
  shiftWeekKey, consecutiveEndingAt, streakOfFulfilled,
  sessionKey, weekBonusKey, cycleBonusKey,
  eventsForFinishedWorkout, compensationForWorkout,
  applyEvents, balance, hasKey, entriesForKey, compensateEvents, pointsEarnedInWeek,
  reconcileSessionEvents, familyNet,
  activeRewards, canRedeem, nextReward, tryRedeem, redemptionHistory,
  dashboardStats, recentWeeks, complianceRate, cycleProgress, lastSession, pointsByType
} from '../index.js'

/* ------------------------------------------------------------------ helpers */

const TZ = 'America/Lima'
const DAY = 86400000

const doneSet = () => ({ w: 60, r: 5, done: true })

// A finished, valid workout at an instant.
function wAt(id, ms, d) {
  return { id, d, start: ms, end: ms, entries: [{ id: 'bench', sets: [doneSet()] }] }
}
// 2026-01-05 is a Monday. 15:00Z = 10:00 in Lima (UTC−5).
const at = iso => Date.parse(iso)
const emptyS = () => ({ workouts: [], gam: { ledger: [], rewards: [] } })

// Finish a workout and fold its events into the ledger, like the app does.
function finish(S, w) {
  S.workouts.push(w)
  const evs = eventsForFinishedWorkout(S, w)
  S.gam.ledger = applyEvents(S.gam.ledger, evs, w.end)
  return evs
}

/* ------------------------------------------------- 1. invalid session = 0 */

describe('valid sessions', () => {
  it('1. an incomplete session earns no points', () => {
    const S = emptyS()
    const empty = { id: 'x', d: '2026-01-05', end: at('2026-01-05T15:00:00Z'), entries: [] }
    const unchecked = { id: 'y', d: '2026-01-05', end: at('2026-01-05T15:00:00Z'), entries: [{ id: 'bench', sets: [{ w: 60, r: 5, done: false }] }] }
    expect(isValidSession(empty)).toBe(false)
    expect(isValidSession(unchecked)).toBe(false)
    expect(eventsForFinishedWorkout(S, empty)).toEqual([])
    expect(balance(applyEvents(S.gam.ledger, eventsForFinishedWorkout(S, unchecked)))).toBe(0)
  })

  it('is valid when any exercise has any completed set', () => {
    expect(isValidSession(wAt('a', 1, '2026-01-05'))).toBe(true)
  })
})

/* ------------------------------------------- 2 & 3. 100 once, idempotent */

describe('session points and idempotency', () => {
  it('2. a valid session gives 100 points, once', () => {
    const S = emptyS()
    const w = wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05')
    finish(S, w)
    expect(balance(S.gam.ledger)).toBe(100)
    expect(entriesForKey(S.gam.ledger, sessionKey('w1'))).toHaveLength(1)
  })

  it('3. reprocessing the same event does not duplicate points', () => {
    const S = emptyS()
    const w = wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05')
    finish(S, w)
    const again = applyEvents(S.gam.ledger, eventsForFinishedWorkout(S, w), w.end)
    expect(balance(again)).toBe(100)
    expect(again).toHaveLength(S.gam.ledger.length)
  })

  it('applyEvents is pure (does not mutate its input)', () => {
    const before = []
    const after = applyEvents(before, [{ type: 'session', delta: 100, key: 'k' }], 1000)
    expect(before).toHaveLength(0)
    expect(after).toHaveLength(1)
  })
})

/* ------------------------------------------------- 4. weekly bonus once */

describe('weekly bonus', () => {
  it('4. the third valid session grants +150 once, not before', () => {
    const S = emptyS()
    finish(S, wAt('a', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    finish(S, wAt('b', at('2026-01-06T15:00:00Z'), '2026-01-06'))
    expect(balance(S.gam.ledger)).toBe(200)                 // no bonus yet
    expect(hasKey(S.gam.ledger, weekBonusKey('2026-W02'))).toBe(false)

    finish(S, wAt('c', at('2026-01-07T15:00:00Z'), '2026-01-07'))
    expect(balance(S.gam.ledger)).toBe(450)                 // 300 + 150
    expect(entriesForKey(S.gam.ledger, weekBonusKey('2026-W02'))).toHaveLength(1)

    // Reprocessing the third finish must not grant a second bonus.
    const again = applyEvents(S.gam.ledger, eventsForFinishedWorkout(S, S.workouts[2]), S.workouts[2].end)
    expect(balance(again)).toBe(450)
    expect(entriesForKey(again, weekBonusKey('2026-W02'))).toHaveLength(1)
  })
})

/* -------------------------------------------------- 5. cycle bonus once */

function weekOf(base, week) {   // 3 sessions (Mon–Wed) in the ISO week starting base+week*7
  const ms = i => at('2026-01-05T15:00:00Z') + (week * 7 + i) * DAY
  return [0, 1, 2].map(i => wAt('w' + week + '-' + i, ms(i), 'x'))
}

describe('cycle bonus', () => {
  it('5. the fourth consecutive fulfilled week grants +300 once', () => {
    const S = emptyS()
    for (let week = 0; week < 4; week++) for (const w of weekOf(0, week)) finish(S, w)
    // 12 sessions = 1200; 4 weekly bonuses = 600; one cycle bonus = 300.
    expect(balance(S.gam.ledger)).toBe(2100)
    const cycles = S.gam.ledger.filter(e => e.type === 'cycle_bonus')
    expect(cycles).toHaveLength(1)
    expect(cycles[0].delta).toBe(300)
    expect(cycles[0].key).toBe(cycleBonusKey('2026-W05'))  // week that completed the run

    // Reprocessing the completing week's last finish adds nothing.
    const again = applyEvents(S.gam.ledger, eventsForFinishedWorkout(S, S.workouts[11]), S.workouts[11].end)
    expect(again.filter(e => e.type === 'cycle_bonus')).toHaveLength(1)
    expect(balance(again)).toBe(2100)
  })

  it('a fifth fulfilled week does not repeat the cycle bonus (run 5 % 4 ≠ 0)', () => {
    const S = emptyS()
    for (let week = 0; week < 5; week++) for (const w of weekOf(0, week)) finish(S, w)
    expect(S.gam.ledger.filter(e => e.type === 'cycle_bonus')).toHaveLength(1)
  })

  it('an eighth consecutive week grants a second cycle bonus', () => {
    const S = emptyS()
    for (let week = 0; week < 8; week++) for (const w of weekOf(0, week)) finish(S, w)
    expect(S.gam.ledger.filter(e => e.type === 'cycle_bonus')).toHaveLength(2)
  })
})

/* ------------------------------------------------------ 6. streak breaks */

describe('streaks', () => {
  it('6. a missed week breaks the streak', () => {
    const fulfilled = new Set(['2026-W02', '2026-W03'])
    expect(streakOfFulfilled(fulfilled, '2026-W03')).toBe(2)   // ends on a fulfilled week
    expect(streakOfFulfilled(fulfilled, '2026-W04')).toBe(2)   // W04 in progress, not yet failed
    expect(streakOfFulfilled(fulfilled, '2026-W05')).toBe(0)   // W04 was missed → reset
  })

  it('consecutiveEndingAt counts the run that a week completes', () => {
    const fulfilled = new Set(['2026-W01', '2026-W02', '2026-W03'])
    expect(consecutiveEndingAt(fulfilled, '2026-W03')).toBe(3)
    expect(consecutiveEndingAt(fulfilled, '2026-W04')).toBe(0)
  })
})

/* -------------------------------------------------- 7. America/Lima weeks */

describe('America/Lima week boundaries', () => {
  it('7. Sunday 23:30 Lima belongs to the week that ends that Sunday', () => {
    // Sun 2026-01-04 23:30 in Lima = Mon 2026-01-05 04:30 UTC.
    const sunday = at('2026-01-05T04:30:00Z')
    // Mon 2026-01-05 00:30 in Lima = Mon 2026-01-05 05:30 UTC.
    const monday = at('2026-01-05T05:30:00Z')
    expect(isoDateInTZ(sunday, TZ)).toBe('2026-01-04')
    expect(isoDateInTZ(monday, TZ)).toBe('2026-01-05')
    expect(weekKeyOf(sunday, TZ)).toBe('2026-W01')
    expect(weekKeyOf(monday, TZ)).toBe('2026-W02')
    // The same two instants land on the SAME week in UTC — proving the zone matters.
    expect(weekKeyOf(at('2026-01-05T00:30:00Z'), 'UTC')).toBe('2026-W02')
    expect(weekKeyOf(at('2026-01-05T04:30:00Z'), 'UTC')).toBe('2026-W02')
  })

  it('handles month and year boundaries', () => {
    expect(isoWeekKeyOfDate('2025-12-29')).toBe('2026-W01')  // Monday in next ISO year
    expect(isoWeekKeyOfDate('2025-12-28')).toBe('2025-W52')  // Sunday closes the old year
    expect(isoWeekKeyOfDate('2026-02-01')).toBe('2026-W05')  // Sunday straddling Jan/Feb
    expect(shiftWeekKey('2026-W01', -1)).toBe('2025-W52')
    expect(shiftWeekKey('2026-W01', 1)).toBe('2026-W02')
  })

  it('counts a week using the zone, not the stored local date', () => {
    const S = emptyS()
    // Instants: Sun 23:00 and Mon 01:00 Lima — different weeks.
    const a = wAt('a', at('2026-01-05T04:00:00Z'), '2026-01-05') // dates mislabeled on purpose
    const b = wAt('b', at('2026-01-05T06:00:00Z'), '2026-01-05')
    S.workouts.push(a, b)
    expect(countInWeek(S.workouts, '2026-W01', TZ)).toBe(1)
    expect(countInWeek(S.workouts, '2026-W02', TZ)).toBe(1)
  })

  it('currentWeekKey reflects the zone', () => {
    const instant = at('2026-01-05T04:30:00Z')
    expect(currentWeekKey(TZ, instant)).toBe('2026-W01')
    expect(currentWeekKey('UTC', instant)).toBe('2026-W02')
  })

  it('instantOf falls back to the stored date when there is no clock', () => {
    expect(weekKeyOf(instantOf({ id: 'i', d: '2026-01-04', entries: [] }), TZ)).toBe('2026-W01')
  })
})

/* --------------------------------------------------------- rewards 8 & 9 */

const rewardS = cost => ({ workouts: [], gam: { ledger: [], rewards: [{ id: 'r1', name: 'Café', cost, active: true }] } })

describe('rewards', () => {
  it('8. cannot redeem without enough points', () => {
    const S = rewardS(200)
    S.gam.ledger = applyEvents([], [{ type: 'session', delta: 100, key: 'session:a' }])
    const res = tryRedeem(S, 'r1', 'rd1')
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('insufficient')
    expect(res.events).toEqual([])
    expect(canRedeem(S, S.gam.rewards[0])).toBe(false)
  })

  it('9. retrying a redemption does not double the discount', () => {
    const S = rewardS(100)
    S.gam.ledger = applyEvents([], [{ type: 'session', delta: 300, key: 'session:a' }])
    const first = tryRedeem(S, 'r1', 'rd1')
    S.gam.ledger = applyEvents(S.gam.ledger, first.events)
    expect(balance(S.gam.ledger)).toBe(200)

    const retry = tryRedeem(S, 'r1', 'rd1')       // same redemption id
    expect(retry.ok).toBe(true)
    expect(retry.duplicate).toBe(true)
    expect(retry.events).toEqual([])
    S.gam.ledger = applyEvents(S.gam.ledger, retry.events)
    expect(balance(S.gam.ledger)).toBe(200)       // unchanged
    expect(redemptionHistory(S)).toHaveLength(1)
  })

  it('inactive rewards are not redeemable and nextReward ignores them', () => {
    const S = rewardS(50)
    S.gam.rewards.push({ id: 'r2', name: 'Off', cost: 10, active: false })
    expect(activeRewards(S).map(r => r.id)).toEqual(['r1'])
    expect(nextReward(S).id).toBe('r1')
  })

  it('nextReward points at the cheapest unaffordable, else the dearest affordable', () => {
    const S = rewardS(100)
    S.gam.rewards.push({ id: 'r2', name: 'Big', cost: 1000, active: true })
    expect(nextReward(S).id).toBe('r1')                       // 0 pts → cheapest is the aim
    S.gam.ledger = applyEvents([], [{ type: 'session', delta: 100, key: 'k' }])
    expect(nextReward(S).id).toBe('r2')                       // r1 affordable → aim for r2
    S.gam.ledger = applyEvents(S.gam.ledger, [{ type: 'session', delta: 2000, key: 'k2' }])
    expect(nextReward(S).id).toBe('r2')                       // all affordable → dearest
  })
})

/* ------------------------------------------------- 10. deletion coherence */

describe('deletion keeps the ledger coherent', () => {
  it('10. compensating a session zeroes its points without erasing history', () => {
    const S = emptyS()
    const w = wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05')
    finish(S, w)
    expect(balance(S.gam.ledger)).toBe(100)

    S.gam.ledger = applyEvents(S.gam.ledger, compensateEvents(S.gam.ledger, compensationForWorkout(w)))
    expect(balance(S.gam.ledger)).toBe(0)
    expect(entriesForKey(S.gam.ledger, sessionKey('w1'))).toHaveLength(1)   // original kept

    // Applying the compensation again is a no-op.
    const again = applyEvents(S.gam.ledger, compensateEvents(S.gam.ledger, compensationForWorkout(w)))
    expect(balance(again)).toBe(0)
    expect(again.filter(e => e.type === 'compensation')).toHaveLength(1)
  })
})

/* --------------------------------------------- 11 & 12. history & empty UI */

describe('dashboard', () => {
  it('11. does not mutate existing training history', () => {
    const S = emptyS()
    const before = JSON.stringify(S.workouts)
    finish(S, wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    expect(JSON.stringify(S.workouts)).not.toBe(before)
    const snapshot = JSON.stringify(S.workouts)
    dashboardStats(S, at('2026-01-06T15:00:00Z'))
    recentWeeks(S, 4, at('2026-01-06T15:00:00Z'))
    compensationForWorkout(S.workouts[0])
    expect(JSON.stringify(S.workouts)).toBe(snapshot)   // selectors never mutate
  })

  it('12. dashboard works with no history at all', () => {
    const S = emptyS()
    const now = at('2026-01-06T15:00:00Z')
    const d = dashboardStats(S, now)
    expect(d.sessions).toBe(0)
    expect(d.balance).toBe(0)
    expect(d.earnedThisWeek).toBe(0)
    expect(d.streak).toBe(0)
    expect(d.nextReward).toBeNull()
    expect(d.hasData).toBe(false)
    expect(complianceRate(S, 4, now).rate).toBe(0)
    expect(recentWeeks(S, 3, now)).toHaveLength(3)
  })

  it('summarises points, goal progress and streak', () => {
    const S = emptyS()
    finish(S, wAt('a', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    finish(S, wAt('b', at('2026-01-06T15:00:00Z'), '2026-01-06'))
    const d = dashboardStats(S, at('2026-01-06T16:00:00Z'))
    expect(d.sessions).toBe(2)
    expect(d.target).toBe(3)
    expect(d.goalMet).toBe(false)
    expect(d.remainingToGoal).toBe(1)
    expect(d.balance).toBe(200)
    expect(d.earnedThisWeek).toBe(200)
  })

  it('rulesOf merges overrides over defaults', () => {    expect(rulesOf({})).toEqual(DEFAULT_RULES)
    expect(rulesOf({ gam: { rules: { weeklyTarget: 2 } } }).weeklyTarget).toBe(2)
    expect(rulesOf({ gam: { rules: { weeklyTarget: 2 } } }).tz).toBe('America/Lima')
  })

  it('pointsEarnedInWeek only sums positive movements in that week', () => {
    const S = emptyS()
    finish(S, wAt('a', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    S.gam.ledger = applyEvents(S.gam.ledger, [{ type: 'redeem', delta: -50, key: 'redeem:x' }], at('2026-01-05T16:00:00Z'))
    expect(pointsEarnedInWeek(S.gam.ledger, '2026-W02', TZ)).toBe(100)
    expect(pointsEarnedInWeek(S.gam.ledger, '2026-W03', TZ)).toBe(0)
  })
})

/* ------------------------------------------------------- fulfilledWeeks */

describe('fulfilledWeekKeys', () => {
  it('marks a week fulfilled only at the target', () => {
    const S = emptyS()
    for (const w of weekOf(0, 0)) S.workouts.push(w)
    expect(fulfilledWeekKeys(S.workouts, TZ, 3).has('2026-W02')).toBe(true)
    expect(fulfilledWeekKeys(S.workouts, TZ, 4).has('2026-W02')).toBe(false)
  })
})

/* ---------------------------------------------------- session correction */

describe('correcting a saved session', () => {
  it('marking the last set undone removes its points; marking it done restores them', () => {
    const S = emptyS()
    const w = wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05')
    finish(S, w)
    expect(balance(S.gam.ledger)).toBe(100)

    // Correct it to invalid (no done sets) through the reconciler.
    const invalid = { ...w, entries: [{ id: 'bench', sets: [{ w: 60, r: 5, done: false }] }] }
    S.gam.ledger = applyEvents(S.gam.ledger, reconcileSessionEvents(S.gam.ledger, invalid, rulesOf(S)))
    expect(familyNet(S.gam.ledger, sessionKey('w1'))).toBe(0)
    expect(balance(S.gam.ledger)).toBe(0)
    expect(entriesForKey(S.gam.ledger, sessionKey('w1'))).toHaveLength(1)   // original kept

    // Re-running reconciliation with the same (invalid) state changes nothing.
    const again = applyEvents(S.gam.ledger, reconcileSessionEvents(S.gam.ledger, invalid, rulesOf(S)))
    expect(balance(again)).toBe(0)
    expect(again).toHaveLength(S.gam.ledger.length)

    // Correct it back to valid — a fresh adjustment restores the points.
    S.gam.ledger = applyEvents(again, reconcileSessionEvents(again, w, rulesOf(S)))
    expect(familyNet(S.gam.ledger, sessionKey('w1'))).toBe(100)
    expect(balance(S.gam.ledger)).toBe(100)
    // Deleting a corrected session still zeroes the whole family.
    S.gam.ledger = applyEvents(S.gam.ledger, compensateEvents(S.gam.ledger, sessionKey('w1')))
    expect(balance(S.gam.ledger)).toBe(0)
  })

  it('records the rule version on scoring movements', () => {
    const S = emptyS()
    const evs = eventsForFinishedWorkout({ workouts: [] }, wAt('w1', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    expect(evs[0].meta.ruleVersion).toBe(DEFAULT_RULES.ruleVersion)
    const ledger = applyEvents([], evs)
    expect(ledger[0].meta.ruleVersion).toBe(1)
  })
})

/* ------------------------------------------- cycle progress + summaries */

describe('cycle progress, last session, points breakdown', () => {
  it('cycleProgress counts weeks into the current cycle', () => {
    const S = emptyS()
    for (let week = 0; week < 4; week++) for (const w of weekOf(0, week)) S.workouts.push(w)
    const c4 = cycleProgress(S, at('2026-01-26T15:00:00Z'))
    expect(c4.streak).toBe(4)
    expect(c4.into).toBe(4)
    expect(c4.onCycle).toBe(true)

    for (const w of weekOf(0, 4)) S.workouts.push(w)   // 5th fulfilled week
    const c5 = cycleProgress(S, at('2026-02-02T15:00:00Z'))
    expect(c5.streak).toBe(5)
    expect(c5.into).toBe(1)
    expect(c5.onCycle).toBe(false)
  })

  it('lastSession summarises the newest workout', () => {
    const S = emptyS()
    S.workouts.push(wAt('old', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    S.workouts.push(wAt('new', at('2026-01-07T15:00:00Z'), '2026-01-07'))
    expect(lastSession(S).id).toBe('new')
    expect(lastSession({ workouts: [] })).toBeNull()
  })

  it('pointsByType splits the ledger by movement type', () => {
    let led = applyEvents([], [{ type: 'session', delta: 100, key: 's1' }, { type: 'week_bonus', delta: 150, key: 'w1' }])
    led = applyEvents(led, [{ type: 'redeem', delta: -80, key: 'r1' }])
    expect(pointsByType(led)).toEqual({ session: 100, week_bonus: 150, redeem: -80 })
  })

  it('a custom weekly target changes when the bonus is due', () => {
    const S = { workouts: [], gam: { rules: { weeklyTarget: 2 }, ledger: [], rewards: [] } }
    finish(S, wAt('a', at('2026-01-05T15:00:00Z'), '2026-01-05'))
    expect(hasKey(S.gam.ledger, weekBonusKey('2026-W02'))).toBe(false)   // 1 session, target 2
    finish(S, wAt('b', at('2026-01-06T15:00:00Z'), '2026-01-06'))
    expect(hasKey(S.gam.ledger, weekBonusKey('2026-W02'))).toBe(true)    // 2nd session hits a target of 2
  })
})

/* -------------------------------------------------- backwards compatibility */describe('profiles written before the feature', () => {
  it('works with no `gam` key and with a partially-set one', () => {
    const legacy = { workouts: [], routines: [], bodyweight: [] }   // pre-GYMPACT state
    const d = dashboardStats(legacy, at('2026-01-06T15:00:00Z'))
    expect(d.balance).toBe(0)
    expect(d.sessions).toBe(0)
    expect(d.nextReward).toBeNull()
    expect(eventsForFinishedWorkout({ workouts: [] }, wAt('x', 1, '2026-01-05'))).toHaveLength(1) // defaults apply
    // A partially-written container must not throw either.
    expect(() => dashboardStats({ workouts: [], gam: {} }, 0)).not.toThrow()
    expect(() => compensateEvents(undefined, 'session:x')).not.toThrow()
  })

  it('a default profile does not gain points from existing history alone', () => {
    const S = { workouts: [wAt('a', at('2026-01-05T15:00:00Z'), '2026-01-05')] }  // history, no ledger
    expect(balance(S.gam && S.gam.ledger)).toBe(0)
    expect(dashboardStats(S, at('2026-01-06T15:00:00Z')).balance).toBe(0)
  })
})
