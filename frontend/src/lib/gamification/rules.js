// GYMPACT gamification — domain rules (pure, no React, no store).
//
// The product goal is CONSTANCY, not volume: points reward finishing valid
// sessions and hitting a weekly goal, never weight moved, calories or duration.
// All values below are configurable defaults living inside the profile state
// (`S.gam.rules`), merged over these on read so an old profile without them
// still works and a user can tune them later.

export const DEFAULT_RULES = {
  sessionPoints: 100,   // per valid finished session
  weeklyTarget: 3,      // sessions needed to fulfil a week
  weeklyBonus: 150,     // when the week's target is reached
  cycleWeeks: 4,        // consecutive fulfilled weeks for the cycle bonus
  cycleBonus: 300,      // when a 4-week cycle is completed
  tz: 'America/Lima',   // weeks are defined in this zone, not the device's
  // Bumped whenever the scoring semantics above change, so every ledger movement
  // records which rule set produced it and past points stay explainable.
  ruleVersion: 1
}

// Merge the profile's overrides over the defaults. `S.gam.rules` is optional and
// may be partially set, so this is a shallow overlay, not a replace.
export function rulesOf(S) {
  const over = S && S.gam && S.gam.rules ? S.gam.rules : null
  return over ? { ...DEFAULT_RULES, ...over } : { ...DEFAULT_RULES }
}

// The target for a SPECIFIC week. A profile can override the goal for one week
// (a lighter week, a holiday) in `S.gam.weekTargets[weekKey]`; otherwise it falls
// back to the general weekly target. Used everywhere a week's fulfilment is judged.
export function targetForWeek(S, weekKey) {
  const over = S && S.gam && S.gam.weekTargets ? S.gam.weekTargets[weekKey] : null
  const n = over == null ? null : +over
  return Number.isFinite(n) && n > 0 ? Math.round(n) : rulesOf(S).weeklyTarget
}

// Weeks the user marked as planned rest (`S.gam.restWeeks`). A rest week is not a
// failure: it neither grants the weekly bonus nor breaks the streak/cycle — the run
// simply steps over it. This protects constancy from punishing a deliberate break
// (holiday, illness, deload).
export function restWeeks(S) {
  const r = S && S.gam && S.gam.restWeeks
  return r ? new Set(Object.keys(r).filter(k => r[k])) : new Set()
}
export function isRestWeek(S, weekKey) {
  return restWeeks(S).has(weekKey)
}

// A session only counts when it was finished and actually logged something:
// at least one exercise entry with at least one completed set. This mirrors how
// `doFinishWorkout` builds a workout (entries are filtered to those with a done
// set), but stays explicit so the criterion is testable and can't silently drift.
export function isValidSession(w) {
  if (!w || !Array.isArray(w.entries)) return false
  return w.entries.some(e => Array.isArray(e.sets) && e.sets.some(s => s && s.done))
}
