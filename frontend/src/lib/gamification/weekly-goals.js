// GYMPACT — weekly goals, defined in an explicit IANA timezone.
//
// Everything here is pure and takes the zone as a parameter (defaulting to the
// profile's `America/Lima`). The app's existing date helpers use the DEVICE clock
// (`new Date().getDay()`); that is fine for showing "today" but wrong for a goal
// week, which must not move because the phone is travelling. So we never reuse
// them for scoring — we convert an instant to a calendar date *in the zone* first.
//
// Peru has no DST (UTC−5 all year), but nothing here assumes that: it goes through
// Intl, so any IANA zone — including ones with DST — resolves correctly.

import { isValidSession } from './rules.js'

// ---- calendar date in a zone -------------------------------------------------

const DAY = 86400000

function datePartsInTZ(ms, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(ms))
  const g = k => parts.find(p => p.type === k).value
  return { y: +g('year'), m: +g('month'), d: +g('day') }
}

// 'YYYY-MM-DD' for the instant `ms` as seen in `tz`. Falls back to UTC if the
// zone string is unknown, so a bad profile value can never throw inside a render.
export function isoDateInTZ(ms, tz) {
  let p
  try { p = datePartsInTZ(ms, tz) } catch { p = datePartsInTZ(ms, 'UTC') }
  return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0')
}

// ---- ISO week (Monday–Sunday) ------------------------------------------------

const isoOfUTC = d =>
  d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0')

// ISO-8601 week key 'YYYY-Www' from a plain calendar date. Computed entirely in
// UTC so the host machine's own zone can never influence the result.
export function isoWeekKeyOfDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = (dt.getUTCDay() + 6) % 7            // Monday = 0
  dt.setUTCDate(dt.getUTCDate() - day + 3)        // Thursday of that ISO week
  const jan4 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((dt - jan4) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
  return dt.getUTCFullYear() + '-W' + String(week).padStart(2, '0')
}

// Week key of an instant, as seen in the zone.
export function weekKeyOf(ms, tz) {
  return isoWeekKeyOfDate(isoDateInTZ(ms, tz))
}

// The instant a finished workout happened at. Imported rows have no clock, so the
// stored `d` is read as noon UTC — good enough that its calendar date is stable in
// any zone within ±12h (which covers Lima and every realistic profile).
export function instantOf(w) {
  if (w && typeof w.end === 'number' && w.end > 0) return w.end
  if (w && typeof w.start === 'number' && w.start > 0) return w.start
  const d = (w && w.d) || '1970-01-01'
  return Date.parse(d + 'T12:00:00Z')
}

export function sessionWeekKey(w, tz) {
  return weekKeyOf(instantOf(w), tz)
}

// ---- counting sessions per week ---------------------------------------------

export const validSessions = workouts => (workouts || []).filter(isValidSession)

export function sessionsInWeek(workouts, weekKey, tz) {
  return validSessions(workouts).filter(w => sessionWeekKey(w, tz) === weekKey)
}

export function countInWeek(workouts, weekKey, tz) {
  return sessionsInWeek(workouts, weekKey, tz).length
}

export function currentWeekKey(tz, now) {
  return weekKeyOf(now == null ? Date.now() : now, tz)
}

// Set of every week key that met its target. `target` may be a number or a function
// `weekKey => target`, so per-week goals (S.gam.weekTargets) are honoured.
export function fulfilledWeekKeys(workouts, tz, target) {
  const targetOf = typeof target === 'function' ? target : () => target
  const counts = new Map()
  for (const w of validSessions(workouts)) {
    const k = sessionWeekKey(w, tz)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const set = new Set()
  for (const [k, n] of counts) if (n >= targetOf(k)) set.add(k)
  return set
}
